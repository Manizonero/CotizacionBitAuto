(() => {
    'use strict';

    const DB_NAME = 'TallerDB';
    const STORE_NAME = 'inspecciones';
    const MAX_WIDTH = 1280;
    const MAX_HEIGHT = 960;
    const JPEG_QUALITY = 0.75;
    const params = new URLSearchParams(location.search);
    const $ = (id) => document.getElementById(id);
    let db;
    let photos = [];
    let currentPhoto;
    let sourceImage;
    let drawing = false;
    let points = [];
    let annotations = [];
    let movingAnnotation;
    let moveOffset;
    let annotationMode = 'auto';
    let photoPendingDelete;
    const annotationStrokeWidth = () => Math.max(10, Math.min(24, Math.max($('photoCanvas').width, $('photoCanvas').height) / 160));

    function getPlate() {
        if (params.get('placa')) return params.get('placa').trim().toUpperCase();
        try { return (JSON.parse(localStorage.getItem('coticarQuoteState'))?.fields?.placa || '').trim().toUpperCase(); } catch (error) { return ''; }
    }
    function savedPartDescriptions() {
        try {
            const state = JSON.parse(localStorage.getItem('coticarQuoteState'));
            return [...new Set((Array.isArray(state?.quoteItems) ? state.quoteItems : []).map((item) => item.descrip?.trim()).filter(Boolean))];
        } catch (error) { return []; }
    }
    function updateEditorPartSuggestions(filter = '') {
        const menu = $('editorPartsMenu');
        if (!menu) return;
        const query = filter.trim().toLowerCase();
        menu.innerHTML = '';
        savedPartDescriptions().filter((description) => description.toLowerCase().includes(query)).forEach((description) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'editor-part-option';
            option.setAttribute('role', 'option');
            option.value = description;
            option.textContent = description;
            option.addEventListener('click', () => addTextAnnotation(description));
            menu.appendChild(option);
        });
        menu.hidden = !menu.children.length;
    }
    function addTextAnnotation(value) {
        if (!value.trim()) return;
        annotations.push({ type: 'text', text: value.trim() });
        redraw();
        $('editorVoiceStatus').textContent = 'Repuesto agregado en la esquina inferior derecha de la foto.';
        $('editorCommandInput').value = '';
        $('editorPartsMenu').hidden = true;
    }
    function setStatus(text) { $('photoStatus').textContent = text; }
    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => { const store = request.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true }); store.createIndex('placaVehiculo', 'placaVehiculo'); };
            request.onsuccess = () => { db = request.result; resolve(); };
            request.onerror = () => reject(request.error);
        });
    }
    function store(mode) { return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME); }
    function save(record) {
        return new Promise((resolve, reject) => { const request = store('readwrite').put(record); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    }
    function recordsForPlate() {
        return new Promise((resolve, reject) => { const request = store('readonly').index('placaVehiculo').getAll(getPlate()); request.onsuccess = () => resolve(request.result.filter((record) => record.blob?.size).sort((a, b) => a.createdAt - b.createdAt)); request.onerror = () => reject(request.error); });
    }
    function compress(file) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            const url = URL.createObjectURL(file);
            image.onload = () => { const scale = Math.min(1, MAX_WIDTH / image.width, MAX_HEIGHT / image.height); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale)); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url); canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY); };
            image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagen no valida')); };
            image.src = url;
        });
    }
    function render() {
        const grid = $('photoGrid'); grid.innerHTML = '';
        photos.forEach((photo) => { const card = document.createElement('div'); card.className = 'photo-card'; const button = document.createElement('button'); button.type = 'button'; button.className = `photo-thumb${photo.marked ? ' photo-thumb-marked' : ''}`; const image = document.createElement('img'); image.src = URL.createObjectURL(photo.blob); image.alt = photo.marked ? 'Foto marcada' : 'Foto de inspeccion'; button.appendChild(image); button.addEventListener('click', () => openEditor(photo)); const deleteButton = document.createElement('button'); deleteButton.type = 'button'; deleteButton.className = 'delete-photo-button'; deleteButton.innerHTML = '&#128465;'; deleteButton.title = 'Eliminar foto'; deleteButton.setAttribute('aria-label', 'Eliminar foto'); deleteButton.addEventListener('click', (event) => { event.stopPropagation(); deletePhoto(photo); }); card.appendChild(button); card.appendChild(deleteButton); grid.appendChild(card); });
        $('photoCount').textContent = `${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}`;
    }
    async function refresh() {
        photos = getPlate() ? await recordsForPlate() : [];
        render();
        setStatus(getPlate() ? `${photos.length} fotos guardadas localmente para ${getPlate()}.` : 'Vuelve a la cotizacion y registra una placa.');
    }
    async function processFiles(event, openDetail) {
        if (!getPlate()) { setStatus('No hay placa activa.'); return; }
        try { for (const file of event.target.files) await save({ placaVehiculo: getPlate(), blob: await compress(file), marked: false, createdAt: Date.now() }); await refresh(); if (openDetail && photos.length) openEditor(photos[photos.length - 1]); } catch (error) { setStatus(`No se pudo guardar la foto: ${error.message}`); }
        event.target.value = '';
    }
    function pointFromEvent(event) { const canvas = $('photoCanvas'); const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }; }
    function drawAnnotations() {
        const context = $('photoCanvas').getContext('2d');
        annotations.forEach((annotation) => {
            context.save(); context.strokeStyle = '#ef2222'; context.lineWidth = annotationStrokeWidth(); context.lineCap = 'round'; context.beginPath();
            if (annotation.type === 'circle') context.arc(annotation.cx, annotation.cy, annotation.radius, 0, Math.PI * 2);
            else if (annotation.type === 'arrow') { context.moveTo(annotation.x1, annotation.y1); context.lineTo(annotation.x2, annotation.y2); const angle = Math.atan2(annotation.y2 - annotation.y1, annotation.x2 - annotation.x1); const size = 28; context.moveTo(annotation.x2, annotation.y2); context.lineTo(annotation.x2 - size * Math.cos(angle - Math.PI / 6), annotation.y2 - size * Math.sin(angle - Math.PI / 6)); context.moveTo(annotation.x2, annotation.y2); context.lineTo(annotation.x2 - size * Math.cos(angle + Math.PI / 6), annotation.y2 - size * Math.sin(angle + Math.PI / 6)); }
            context.stroke(); context.restore();
            if (annotation.type === 'text') { context.save(); const padding = 18; const fontSize = Math.max(32, Math.min(64, Math.max($('photoCanvas').width, $('photoCanvas').height) / 20)); context.font = `700 ${fontSize}px Oxanium, sans-serif`; const textWidth = context.measureText(annotation.text).width; const x = $('photoCanvas').width - textWidth - padding * 2; const y = $('photoCanvas').height - fontSize - padding * 2; context.fillStyle = '#fff'; context.fillRect(Math.max(0, x), Math.max(0, y), Math.min(textWidth + padding * 2, $('photoCanvas').width), fontSize + padding * 2); context.fillStyle = '#111827'; context.textBaseline = 'top'; context.fillText(annotation.text, Math.max(padding, x + padding), Math.max(padding, y + padding)); context.restore(); }
        });
    }
    function annotationAt(point) {
        for (let index = annotations.length - 1; index >= 0; index -= 1) { const annotation = annotations[index]; const hit = annotation.type === 'circle' ? Math.abs(distance(point, { x: annotation.cx, y: annotation.cy }) - annotation.radius) < 35 : distanceToSegment(point, annotation) < 35; if (hit) return annotation; }
        return null;
    }
    function distanceToSegment(point, annotation) { const dx = annotation.x2 - annotation.x1; const dy = annotation.y2 - annotation.y1; const length = dx * dx + dy * dy || 1; const ratio = Math.max(0, Math.min(1, ((point.x - annotation.x1) * dx + (point.y - annotation.y1) * dy) / length)); return distance(point, { x: annotation.x1 + ratio * dx, y: annotation.y1 + ratio * dy }); }
    function redraw() { const context = $('photoCanvas').getContext('2d'); context.clearRect(0, 0, $('photoCanvas').width, $('photoCanvas').height); context.drawImage(sourceImage, 0, 0); drawAnnotations(); }
    function startDraw(event) { const point = pointFromEvent(event); movingAnnotation = annotationAt(point); if (movingAnnotation) { moveOffset = movingAnnotation.type === 'circle' ? { x: point.x - movingAnnotation.cx, y: point.y - movingAnnotation.cy } : { x: point.x - movingAnnotation.x1, y: point.y - movingAnnotation.y1 }; event.preventDefault(); return; } drawing = true; points = [point]; const context = $('photoCanvas').getContext('2d'); context.beginPath(); context.moveTo(point.x, point.y); event.preventDefault(); }
    function continueDraw(event) { const point = pointFromEvent(event); if (movingAnnotation) { if (movingAnnotation.type === 'circle') { movingAnnotation.cx = point.x - moveOffset.x; movingAnnotation.cy = point.y - moveOffset.y; } else { const dx = point.x - moveOffset.x - movingAnnotation.x1; const dy = point.y - moveOffset.y - movingAnnotation.y1; movingAnnotation.x1 += dx; movingAnnotation.y2 += dx; movingAnnotation.y1 += dy; movingAnnotation.y2 += dy; } redraw(); event.preventDefault(); return; } if (!drawing) return; points.push(point); const context = $('photoCanvas').getContext('2d'); context.lineTo(point.x, point.y); context.stroke(); event.preventDefault(); }
    function finishDraw() { movingAnnotation = null; moveOffset = null; if (!drawing) return; drawing = false; recognizeGesture(points); redraw(); points = []; }
    function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function recognizeGesture(path) {
        if (path.length < 8) return;
        const first = path[0]; const last = path[path.length - 1]; const pathLength = path.slice(1).reduce((total, point, index) => total + distance(path[index], point), 0); const xs = path.map((point) => point.x); const ys = path.map((point) => point.y); const width = Math.max(...xs) - Math.min(...xs); const height = Math.max(...ys) - Math.min(...ys); const size = Math.max(width, height); const endDistance = distance(first, last);
        const closed = endDistance < size * 0.42 && width > 28 && height > 28 && pathLength > size * 1.3;
        const straightness = pathLength ? endDistance / pathLength : 0;
        const linear = size > 35 && pathLength > size * 1.05 && straightness > 0.55;
        if (annotationMode === 'circle' || (annotationMode === 'auto' && closed)) {
            annotations.push({ type: 'circle', cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2, radius: Math.min(width, height) / 2 }); annotationMode = 'auto'; redraw(); return;
        }
        if (annotationMode === 'arrow' || (annotationMode === 'auto' && linear)) {
            annotations.push({ type: 'arrow', x1: first.x, y1: first.y, x2: last.x, y2: last.y }); redraw();
        }
        annotationMode = 'auto';
    }
    function openEditor(photo) { currentPhoto = photo; annotations = []; sourceImage = new Image(); sourceImage.onload = () => { const canvas = $('photoCanvas'); canvas.width = sourceImage.width; canvas.height = sourceImage.height; redraw(); }; sourceImage.src = URL.createObjectURL(photo.blob); $('photoEditor').hidden = false; }
    function clearDrawing() { annotations = []; if (sourceImage) redraw(); }
    function deleteRecord(id) {
        return new Promise((resolve, reject) => { const request = store('readwrite').delete(id); request.onsuccess = resolve; request.onerror = () => reject(request.error); });
    }
    function deletePhoto(photo) {
        if (!photo) return;
        photoPendingDelete = photo;
        $('deleteModal').hidden = false;
    }
    async function confirmDeletePhoto() {
        if (!photoPendingDelete) return;
        await deleteRecord(photoPendingDelete.id);
        photoPendingDelete = null;
        $('deleteModal').hidden = true;
        await refresh();
    }
    async function saveMarked() { const blob = await new Promise((resolve) => $('photoCanvas').toBlob(resolve, 'image/jpeg', JPEG_QUALITY)); await save({ placaVehiculo: getPlate(), blob, marked: true, createdAt: Date.now() }); $('photoEditor').hidden = true; await refresh(); }
    function downloadAll() { recordsForPlate().then((records) => records.forEach((photo, index) => { const link = document.createElement('a'); link.href = URL.createObjectURL(photo.blob); link.download = `${getPlate()}_${String(index + 1).padStart(2, '0')}${photo.marked ? '_MARCADA' : ''}.jpg`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); })); }

    function applyEditorCommand(value) {
        const text = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        $('editorCommandInput').value = value;
        if (text.includes('circulo')) { annotationMode = 'circle'; $('editorVoiceStatus').textContent = 'Modo circulo activo. Dibuja sobre la foto.'; }
        else if (text.includes('flecha')) { annotationMode = 'arrow'; $('editorVoiceStatus').textContent = 'Modo flecha activo. Dibuja sobre la foto.'; }
        else if (text.includes('limpiar')) { clearDrawing(); $('editorVoiceStatus').textContent = 'Trazos limpiados.'; }
        else if (text.includes('guardar')) saveMarked();
        else if (value.trim()) addTextAnnotation(value);
        else $('editorVoiceStatus').textContent = 'Escribe un texto para agregarlo a la foto.';
    }

    async function init() {
        $('plateLabel').textContent = getPlate() ? `PLACA: ${getPlate()}` : 'Sin placa seleccionada';
        try { await openDatabase(); await refresh(); } catch (error) { setStatus('IndexedDB no esta disponible en este navegador.'); return; }
        $('photoInput').addEventListener('change', (event) => processFiles(event, false)); $('detailPhotoInput').addEventListener('change', (event) => processFiles(event, true)); $('downloadPhotosBtn').addEventListener('click', downloadAll); $('cancelDeleteBtn').addEventListener('click', () => { photoPendingDelete = null; $('deleteModal').hidden = true; }); $('confirmDeleteBtn').addEventListener('click', confirmDeletePhoto); $('cancelEditBtn').addEventListener('click', () => { $('photoEditor').hidden = true; }); $('clearDrawingBtn').addEventListener('click', clearDrawing); $('saveMarkedBtn').addEventListener('click', saveMarked);
        $('togglePartsBtn').addEventListener('click', () => { updateEditorPartSuggestions($('editorCommandInput').value); $('editorPartsMenu').hidden = !$('editorPartsMenu').hidden; }); $('editorCommandInput').addEventListener('input', (event) => updateEditorPartSuggestions(event.target.value)); const canvas = $('photoCanvas'); canvas.addEventListener('pointerdown', startDraw); canvas.addEventListener('pointermove', continueDraw); canvas.addEventListener('pointerup', finishDraw); canvas.addEventListener('pointercancel', finishDraw); const context = canvas.getContext('2d'); context.strokeStyle = '#ef2222'; context.lineWidth = annotationStrokeWidth(); context.lineCap = 'round'; $('editorCommandInput').addEventListener('keydown', (event) => { if (event.key === 'Enter') applyEditorCommand(event.target.value); });
    }
    window.descargarFotosMasivas = downloadAll;
    document.addEventListener('DOMContentLoaded', init);
})();
