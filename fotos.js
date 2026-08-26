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
    let repuestoToDelete;
    const annotationStrokeWidth = () => Math.max(12, Math.min(32, Math.max($('photoCanvas').width, $('photoCanvas').height) / 140));

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
    function makeId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }
    function savedRepuestos() {
        let state = {};
        try { state = JSON.parse(localStorage.getItem('coticarQuoteState') || '{}'); } catch (error) { state = {}; }
        let items = Array.isArray(state.quoteItems) ? state.quoteItems : [];
        let changed = false;
        items = items.map((item) => {
            if (!item || item.id) return item;
            changed = true;
            return { ...item, id: makeId() };
        });
        if (changed) {
            try { state.quoteItems = items; localStorage.setItem('coticarQuoteState', JSON.stringify(state)); } catch (error) {}
        }
        return items;
    }
    function savedNaIds() {
        try {
            const state = JSON.parse(localStorage.getItem('coticarQuoteState') || '{}');
            return new Set(Array.isArray(state.naItems) ? state.naItems : []);
        } catch (error) { return new Set(); }
    }
    function saveNaIds(idSet) {
        try {
            const state = JSON.parse(localStorage.getItem('coticarQuoteState') || '{}');
            state.naItems = Array.isArray(idSet) ? idSet : [...idSet];
            localStorage.setItem('coticarQuoteState', JSON.stringify(state));
        } catch (error) {}
    }
    function updateEditorPartSuggestions(filter = '') {
        const menu = $('editorPartsMenu');
        if (!menu) return;
        const query = filter.trim().toLowerCase();
        const descriptions = savedPartDescriptions(); menu.innerHTML = '';
        descriptions.filter((description) => !query || description.toLowerCase().includes(query)).forEach((description) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'editor-part-option';
            option.setAttribute('role', 'option');
            option.value = description;
            option.textContent = description;
            option.addEventListener('click', () => addTextAnnotation(description));
            menu.appendChild(option);
        });
        if (menu.children.length) menu.hidden = false;
        else if (!descriptions.length) menu.hidden = true;
    }
    function addTextAnnotation(value) {
        if (!value.trim()) return;
        const canvas = $('photoCanvas');
        annotations.push({ type: 'text', text: value.trim(), x: canvas.width / 2, y: canvas.height / 2 });
        redraw();
        const s = $('damageSelect');
        if (s) s.value = '';
    }
    function addRepuestoAnnotation(value) {
        if (!value.trim()) return;
        const canvas = $('photoCanvas');
        annotations.push({ type: 'repuesto', text: value.trim(), x: canvas.width / 2, y: canvas.height / 2 });
        redraw();
        const inp = $('repuestoSelect');
        if (inp) inp.value = '';
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
    function compress(file, label) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            const url = URL.createObjectURL(file);
            image.onload = () => {
                const scale = Math.min(1, MAX_WIDTH / image.width, MAX_HEIGHT / image.height);
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(image.width * scale));
                canvas.height = Math.max(1, Math.round(image.height * scale));
                const ctx = canvas.getContext('2d');
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                if (label) {
                    const fontSize = Math.max(12, Math.floor(canvas.width / 55));
                    ctx.font = `700 ${fontSize}px Oxanium, sans-serif`;
                    ctx.textBaseline = 'alphabetic';
                    const textWidth = ctx.measureText(label).width;
                    const pad = Math.max(4, Math.floor(canvas.width * 0.012));
                    const lineHeight = Math.ceil(fontSize * 1.35);
                    const boxX = canvas.width - textWidth - pad * 2;
                    const boxW = textWidth + pad * 2;
                    const boxH = lineHeight + pad * 2;
                    const boxY = canvas.height - boxH;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                    ctx.fillRect(boxX, boxY, boxW, boxH);
                    ctx.fillStyle = '#111827';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(label, boxX + pad, boxY + pad + lineHeight / 2);
                }
                canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
            };
            image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagen no valida')); };
            image.src = url;
        });
    }
    function renderPhotoCards(grid, photoList, showDelete) {
        photoList.forEach((photo) => {
            const card = document.createElement('div');
            card.className = 'photo-card';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `photo-thumb${photo.marked ? ' photo-thumb-marked' : ''}`;
            const image = document.createElement('img');
            image.src = URL.createObjectURL(photo.blob);
            image.alt = photo.marked ? 'Foto marcada' : 'Foto de inspeccion';
            button.appendChild(image);
            button.addEventListener('click', () => openEditor(photo));
            card.appendChild(button);
            if (showDelete) {
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'photo-delete-btn';
                delBtn.innerHTML = '&#128465;';
                delBtn.title = 'Eliminar foto';
                delBtn.setAttribute('aria-label', 'Eliminar foto');
                delBtn.addEventListener('click', (event) => { event.stopPropagation(); deletePhoto(photo); });
                card.appendChild(delBtn);
            }
            grid.appendChild(card);
        });
    }
    function buildRepuestoCard(item) {
        const isNa = savedNaIds().has(item.id);
        const card = document.createElement('div');
        card.className = 'repuesto-card' + (isNa ? ' repuesto-card-na' : '');
        if (isNa) {
            const label = document.createElement('span');
            label.className = 'repuesto-na-name';
            label.textContent = item.descrip || item.id;
            const tag = document.createElement('span');
            tag.className = 'repuesto-na-tag';
            tag.textContent = 'N/A';
            card.appendChild(label);
            card.appendChild(tag);
            card.title = 'Pulsa para quitar el N/A';
            card.setAttribute('role', 'button');
            card.tabIndex = 0;
            card.addEventListener('click', () => toggleNa(item));
                        card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleNa(item); } });
            return card;
        }
        const id = item.id;
        const repPhotos = photos.filter((photo) => String(photo.repuestoId) === String(id));
        const name = document.createElement('div');
        name.className = 'repuesto-name';
        name.textContent = item.descrip || item.id;
        name.title = item.descrip || '';
        const row = document.createElement('div');
        row.className = 'repuesto-row';
        const media = document.createElement('div');
        media.className = 'repuesto-media';
        if (repPhotos.length) renderPhotoCards(media, repPhotos);
        else {
            const empty = document.createElement('div');
            empty.className = 'repuesto-empty';
            empty.textContent = 'Sin foto';
            media.appendChild(empty);
        }
        const icons = document.createElement('div');
        icons.className = 'repuesto-icons';
        const inputId = 'repPhoto_' + String(id);
        const input = document.createElement('input');
        input.id = inputId;
        input.className = 'visually-hidden';
        input.type = 'file';
        input.accept = 'image/*';
        input.setAttribute('capture', 'environment');
        input.multiple = true;
        input.addEventListener('change', (event) => processFiles(event, false, item));
        const cameraBtn = document.createElement('button');
        cameraBtn.type = 'button';
        cameraBtn.className = 'repuesto-icon-btn repuesto-camera-btn';
        cameraBtn.innerHTML = '&#128247;';
        cameraBtn.title = 'Tomar foto de ' + name.textContent;
        cameraBtn.setAttribute('aria-label', 'Tomar foto de ' + name.textContent);
        cameraBtn.addEventListener('click', () => input.click());
        const naBtn = document.createElement('button');
        naBtn.type = 'button';
        naBtn.className = 'repuesto-icon-btn repuesto-na-btn';
        naBtn.textContent = 'N/A';
        naBtn.title = 'Marcar como no aplica foto';
        naBtn.setAttribute('aria-pressed', String(savedNaIds().has(id)));
        naBtn.classList.toggle('is-na', savedNaIds().has(id));
        naBtn.addEventListener('click', () => toggleNa(item));
        const trashBtn = document.createElement('button');
        trashBtn.type = 'button';
        trashBtn.className = 'repuesto-icon-btn repuesto-delete-btn';
        trashBtn.innerHTML = '&#128465;';
        trashBtn.title = 'Eliminar fotos de ' + name.textContent;
        trashBtn.setAttribute('aria-label', 'Eliminar fotos de ' + name.textContent);
        trashBtn.disabled = !repPhotos.length;
        trashBtn.addEventListener('click', (event) => { event.stopPropagation(); repuestoToDelete = item; photoPendingDelete = null; $('deleteModal').hidden = false; });
        icons.appendChild(cameraBtn);
        icons.appendChild(naBtn);
        icons.appendChild(trashBtn);
        row.appendChild(media);
        row.appendChild(icons);
        const counter = document.createElement('div');
        counter.className = 'repuesto-count';
        counter.textContent = `${repPhotos.length} ${repPhotos.length === 1 ? 'foto' : 'fotos'}`;
        card.appendChild(name);
        card.appendChild(row);
        card.appendChild(counter);
        return card;
    }
        function renderRepuestos() {
        const container = $('repuestosList');
        const naWrapper = $('repuestosNa');
        const naList = $('repuestosNaList');
        if (!container) return;
        container.innerHTML = '';
        naList.innerHTML = '';
        const repuestos = savedRepuestos();
        const naIds = savedNaIds();
        let naCount = 0;
        repuestos.forEach((item) => {
            const card = buildRepuestoCard(item);
            if (naIds.has(item.id)) { naCount++; naList.appendChild(card); }
            else container.appendChild(card);
        });
        naWrapper.hidden = naCount === 0;
        if (!repuestos.length) {
            const empty = document.createElement('p');
            empty.className = 'panel-heading-caption';
            empty.textContent = 'No hay repuestos registrados. Vuelve a Datos y agrega los repuestos.';
            container.appendChild(empty);
        }
    }
    function toggleNa(item) {
        const naIds = savedNaIds();
        if (naIds.has(item.id)) naIds.delete(item.id);
        else naIds.add(item.id);
        saveNaIds(naIds);
        render();
    }
    function render() {
        const grid = $('photoGrid'); grid.innerHTML = '';
        const generalPhotos = photos.filter((photo) => !photo.repuestoId);
        renderPhotoCards(grid, generalPhotos, true);
        $('photoCount').textContent = `${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}`;
        renderRepuestos();
    }
    async function refresh() {
        photos = getPlate() ? await recordsForPlate() : [];
        render();
        setStatus(getPlate() ? `${photos.length} fotos guardadas localmente para ${getPlate()}.` : 'Vuelve a la cotizacion y registra una placa.');
    }
    async function processFiles(event, openDetail, repuesto) {
        if (!getPlate()) { setStatus('No hay placa activa.'); return; }
        try { for (const file of event.target.files) await save({ placaVehiculo: getPlate(), blob: await compress(file, repuesto && repuesto.descrip), marked: false, createdAt: Date.now(), repuestoId: repuesto && repuesto.id ? String(repuesto.id) : undefined, repuesto: repuesto && repuesto.descrip ? repuesto.descrip : undefined }); await refresh(); if (openDetail && photos.length) openEditor(photos[photos.length - 1]); } catch (error) { setStatus(`No se pudo guardar la foto: ${error.message}`); }
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
            if (annotation.type === 'text' || annotation.type === 'repuesto') { const isRep = annotation.type === 'repuesto'; const borderColor = isRep ? '#315ddc' : '#ef2222'; context.save(); const padding = 10; const fontSize = Math.max(12, Math.min(30, Math.max($('photoCanvas').width, $('photoCanvas').height) / 34)); context.font = `700 ${fontSize}px Oxanium, sans-serif`; const textWidth = context.measureText(annotation.text).width; const boxW = textWidth + padding * 2; const boxH = fontSize + padding * 2; const cx = annotation.x; const cy = annotation.y; const x = Math.max(0, Math.min($('photoCanvas').width - boxW, cx - boxW / 2)); const y = Math.max(0, Math.min($('photoCanvas').height - boxH, cy - boxH / 2)); context.fillStyle = '#fff'; context.fillRect(x, y, boxW, boxH); context.fillStyle = isRep ? '#0a1e4f' : '#111827'; context.textBaseline = 'middle'; context.textAlign = 'left'; context.fillText(annotation.text, x + padding, y + boxH / 2); context.strokeStyle = borderColor; context.lineWidth = isRep ? 4 : 3; context.strokeRect(x, y, boxW, boxH); context.restore(); }
        });
    }
    function annotationAt(point) {
        for (let index = annotations.length - 1; index >= 0; index -= 1) {
            const annotation = annotations[index];
            let hit = false;
            if (annotation.type === 'circle') hit = Math.abs(distance(point, { x: annotation.cx, y: annotation.cy }) - annotation.radius) < 35;
            else if (annotation.type === 'arrow') hit = distanceToSegment(point, annotation) < 35;
            else if (annotation.type === 'text' || annotation.type === 'repuesto') {
                const context = $('photoCanvas').getContext('2d');
                const fontSize = Math.max(12, Math.min(30, Math.max($('photoCanvas').width, $('photoCanvas').height) / 34));
                context.font = `700 ${fontSize}px Oxanium, sans-serif`;
                const pad = 10;
                const w = context.measureText(annotation.text).width + pad * 2 + 12;
                const h = fontSize + pad * 2 + 12;
                hit = point.x >= annotation.x - w / 2 && point.x <= annotation.x + w / 2 && point.y >= annotation.y - h / 2 && point.y <= annotation.y + h / 2;
            }
            if (hit) return annotation;
        }
        return null;
    }
    function distanceToSegment(point, annotation) { const dx = annotation.x2 - annotation.x1; const dy = annotation.y2 - annotation.y1; const length = dx * dx + dy * dy || 1; const ratio = Math.max(0, Math.min(1, ((point.x - annotation.x1) * dx + (point.y - annotation.y1) * dy) / length)); return distance(point, { x: annotation.x1 + ratio * dx, y: annotation.y1 + ratio * dy }); }
    function redraw() { const context = $('photoCanvas').getContext('2d'); context.clearRect(0, 0, $('photoCanvas').width, $('photoCanvas').height); context.drawImage(sourceImage, 0, 0); drawAnnotations(); }
    function startDraw(event) { const point = pointFromEvent(event); movingAnnotation = annotationAt(point); if (movingAnnotation) { if (movingAnnotation.type === 'circle') moveOffset = { x: point.x - movingAnnotation.cx, y: point.y - movingAnnotation.cy }; else if (movingAnnotation.type === 'text' || movingAnnotation.type === 'repuesto') moveOffset = { x: point.x - movingAnnotation.x, y: point.y - movingAnnotation.y }; else moveOffset = { x: point.x - movingAnnotation.x1, y: point.y - movingAnnotation.y1 }; event.preventDefault(); return; } drawing = true; points = [point]; const context = $('photoCanvas').getContext('2d'); context.beginPath(); context.moveTo(point.x, point.y); event.preventDefault(); }
    function continueDraw(event) { const point = pointFromEvent(event); if (movingAnnotation) { if (movingAnnotation.type === 'circle') { movingAnnotation.cx = point.x - moveOffset.x; movingAnnotation.cy = point.y - moveOffset.y; } else if (movingAnnotation.type === 'text' || movingAnnotation.type === 'repuesto') { movingAnnotation.x = point.x - moveOffset.x; movingAnnotation.y = point.y - moveOffset.y; } else { const dx = point.x - moveOffset.x - movingAnnotation.x1; const dy = point.y - moveOffset.y - movingAnnotation.y1; movingAnnotation.x1 += dx; movingAnnotation.y2 += dx; movingAnnotation.y1 += dy; movingAnnotation.y2 += dy; } redraw(); event.preventDefault(); return; } if (!drawing) return; points.push(point); const context = $('photoCanvas').getContext('2d'); context.lineTo(point.x, point.y); context.stroke(); event.preventDefault(); }
    function finishDraw() { movingAnnotation = null; moveOffset = null; if (!drawing) return; drawing = false; recognizeGesture(points); redraw(); points = []; }
    function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function recognizeGesture(path) {
        if (path.length < 2) return;
        const first = path[0]; const last = path[path.length - 1];
        const xs = path.map((p) => p.x); const ys = path.map((p) => p.y);
        const width = Math.max(...xs) - Math.min(...xs); const height = Math.max(...ys) - Math.min(...ys); const size = Math.max(width, height);
        if (size < 20) return;
        const endDistance = distance(first, last);
        const closed = endDistance < size * 0.4 && width > 20 && height > 20;
        if (annotationMode === 'circle' || (annotationMode === 'auto' && closed)) {
            annotations.push({ type: 'circle', cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2, radius: Math.min(width, height) / 2 }); annotationMode = 'auto'; redraw(); return;
        }
        annotations.push({ type: 'arrow', x1: first.x, y1: first.y, x2: last.x, y2: last.y }); annotationMode = 'auto'; redraw();
    }
    function openEditor(photo) { currentPhoto = photo; annotations = []; sourceImage = new Image(); sourceImage.onload = () => { const canvas = $('photoCanvas'); canvas.width = sourceImage.width; canvas.height = sourceImage.height; redraw(); }; sourceImage.src = URL.createObjectURL(photo.blob); $('photoEditor').hidden = false; if (history.pushState && !editorHistoryGuardAttached) { history.pushState(null, ''); window.addEventListener('popstate', closeEditorOnBack); editorHistoryGuardAttached = true; } }
    let editorHistoryGuardAttached = false;
    function closeEditorOnBack(event) { if ($('photoEditor') && !$('photoEditor').hidden) { event.preventDefault(); $('photoEditor').hidden = true; if (editorHistoryGuardAttached) { history.pushState(null, ''); } } }
    function undoLastStroke() { if (!annotations.length) { if (sourceImage) redraw(); return; } annotations.pop(); if (sourceImage) redraw(); }
    function deleteRecord(id) {
        return new Promise((resolve, reject) => { const request = store('readwrite').delete(id); request.onsuccess = resolve; request.onerror = () => reject(request.error); });
    }
    function deletePhoto(photo) {
        if (!photo) return;
        photoPendingDelete = photo;
        $('deleteModal').hidden = false;
    }
    async function confirmDeletePhoto() {
        const photo = photoPendingDelete;
        const repuesto = repuestoToDelete;
        photoPendingDelete = null;
        repuestoToDelete = null;
        $('deleteModal').hidden = true;
        if (repuesto) {
            let allRecords = [];
            try { allRecords = await recordsForPlate(); } catch (error) { setStatus(`No se pudieron cargar las fotos: ${error.message}`); return; }
            const toRemove = allRecords.filter((photo) => String(photo.repuestoId) === String(repuesto.id));
            if (toRemove.length) setStatus(`Eliminando ${toRemove.length} foto(s)...`);
            for (const photo of toRemove) {
                try { await deleteRecord(photo.id); } catch (error) { setStatus('No se pudo eliminar una foto: ' + error.message); }
            }
            await refresh();
            return;
        }
        if (!photo) return;
        await deleteRecord(photo.id);
        await refresh();
    }
    async function saveMarked() { const blob = await new Promise((resolve) => $('photoCanvas').toBlob(resolve, 'image/jpeg', JPEG_QUALITY)); await save({ ...currentPhoto, blob, marked: true }); $('photoEditor').hidden = true; await refresh(); }
    async function downloadAll() {
        const records = await recordsForPlate();
        if (!records.length) { setStatus('No hay fotos para descargar.'); return; }
        setStatus(`Preparando ${records.length} fotos para descargar...`);
        for (const [index, photo] of records.entries()) {
            const link = document.createElement('a');
            const objectUrl = URL.createObjectURL(photo.blob);
            link.href = objectUrl;
            link.download = `${getPlate()}_${String(index + 1).padStart(2, '0')}${photo.marked ? '_MARCADA' : ''}.jpg`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
            setStatus(`Descargando foto ${index + 1} de ${records.length}...`);
            await new Promise((resolve) => setTimeout(resolve, 350));
        }
        try {
            const state = JSON.parse(localStorage.getItem('coticarQuoteState') || '{}');
            state.photosDownloadedFor = getPlate();
            localStorage.setItem('coticarQuoteState', JSON.stringify(state));
            setStatus(`${records.length} fotos enviadas a Descargas.`);
        } catch (error) { setStatus(`${records.length} fotos descargadas.`); }
    }

    function savedState() {
        try { return JSON.parse(localStorage.getItem('coticarQuoteState') || '{}'); } catch (error) { return {}; }
    }

    function getSuzukiMarca() {
        if (params.get('marca')) return params.get('marca').trim().toUpperCase();
        return String((savedState().fields || {}).marca || '').trim().toUpperCase();
    }

    async function generateSuzukiSpreadsheet(state) {
        const fields = state.fields || {};
        const missingCommon = ['placa', 'marca', 'linea', 'modelo', 'color', 'tipoCliente'].filter((field) => !String(fields[field] || '').trim());
        if (missingCommon.length) { alert(`Faltan datos obligatorios: ${missingCommon.map((f) => f.toUpperCase()).join(', ')}`); return; }
        const missingSuzuki = [];
        if (!String(fields.cilindraje || '').trim()) missingSuzuki.push('cilindraje');
        if (!String(fields.vin || '').trim()) missingSuzuki.push('vin');
        if (missingSuzuki.length) { alert(`Para Suzuki faltan datos: ${missingSuzuki.map((f) => f.toUpperCase()).join(', ')}`); return; }
        try {
            const workbook = new ExcelJS.Workbook();
            const response = await fetch('./template2.xlsx');
            const arrayBuffer = await response.arrayBuffer();
            const loadedWorkbook = await workbook.xlsx.load(arrayBuffer);
            const worksheet = loadedWorkbook.getWorksheet(1);
            worksheet.getCell('B6').value = (fields.placa || '').toUpperCase();
            worksheet.getCell('B3').value = (fields.linea || '').toUpperCase();
            worksheet.getCell('B2').value = fields.modelo || '';
            worksheet.getCell('B4').value = fields.cilindraje || '';
            worksheet.getCell('B7').value = (fields.tipoCliente || '').toUpperCase();
            worksheet.getCell('B5').value = (fields.vin || '').toUpperCase();
            let startRow = 14;
            const items = Array.isArray(state.quoteItems) ? state.quoteItems : [];
            items.forEach((item) => {
                const estado = String(item.estado || '').trim().toUpperCase();
                if (estado !== 'CAMBIO') return;
                worksheet.getCell(`A${startRow}`).value = item.descrip;
                worksheet.getCell(`B${startRow}`).value = item.cant;
                startRow++;
            });
            const placa = fields.placa || 'cotizacion';
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${placa} Cotizacion Repuestos Suzuki.xlsx`.toUpperCase();
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) { }
    }

    function setupSuzukiExport() {
        const button = $('createSuzukiBtn');
        if (!button) return;
        const marca = getSuzukiMarca().toLowerCase();
        const isEligible = marca === 'suzuki' || marca === 'citroen';
        button.hidden = !isEligible;
        if (!isEligible) return;
        button.addEventListener('click', () => generateSuzukiSpreadsheet(savedState()));
    }

    async function init() {
        setupSuzukiExport();
        $('plateLabel').textContent = getPlate() ? `PLACA: ${getPlate()}` : 'Sin placa seleccionada';
        try { await openDatabase(); await refresh(); } catch (error) { setStatus('IndexedDB no esta disponible en este navegador.'); return; }
        $('photoInput').addEventListener('change', (event) => processFiles(event, false)); $('detailPhotoInput').addEventListener('change', (event) => processFiles(event, true)); $('downloadPhotosBtn').addEventListener('click', downloadAll); $('cancelDeleteBtn').addEventListener('click', () => { photoPendingDelete = null; repuestoToDelete = null; $('deleteModal').hidden = true; }); $('confirmDeleteBtn').addEventListener('click', confirmDeletePhoto); $('cancelEditBtn').addEventListener('click', () => { $('photoEditor').hidden = true; }); $('clearDrawingBtn').addEventListener('click', undoLastStroke); $('saveMarkedBtn').addEventListener('click', saveMarked);
        const damageSelect = $('damageSelect'); if (damageSelect) damageSelect.addEventListener('change', () => { if (damageSelect.value) addTextAnnotation(damageSelect.value); }); const repuestoSelect = $('repuestoSelect'); if (repuestoSelect) { savedPartDescriptions().forEach((description) => { const opt = document.createElement('option'); opt.value = description; opt.textContent = description; repuestoSelect.appendChild(opt); }); repuestoSelect.addEventListener('change', () => { if (repuestoSelect.value) addRepuestoAnnotation(repuestoSelect.value); }); } const canvas = $('photoCanvas'); canvas.addEventListener('pointerdown', startDraw); canvas.addEventListener('pointermove', continueDraw); canvas.addEventListener('pointerup', finishDraw); canvas.addEventListener('pointercancel', finishDraw); const context = canvas.getContext('2d'); context.strokeStyle = '#ef2222'; context.lineWidth = annotationStrokeWidth(); context.lineCap = 'round';
    }
    window.descargarFotosMasivas = downloadAll;
    document.addEventListener('DOMContentLoaded', init);
})();
