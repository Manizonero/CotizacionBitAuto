(() => {
    'use strict';

    const storage = window.AppStorage;
    const MAX_WIDTH = 1280;
    const MAX_HEIGHT = 960;
    const JPEG_QUALITY = 0.75;
    const params = new URLSearchParams(location.search);
    const $ = (id) => document.getElementById(id);

    let photos = [];
    let currentPhoto;
    let sourceImage;
    let drawing = false;
    let points = [];
    let annotations = [];
    let movingAnnotation = null;
    let moveOffset = null;
    let photoPendingDelete = null;
    let repuestoToDelete = null;

    const annotationStrokeWidth = () => {
        const canvas = $('photoCanvas');
        if (!canvas) return 12;
        return Math.max(12, Math.min(32, Math.max(canvas.width, canvas.height) / 140));
    };

    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    function distanceToSegment(p, ann) {
        const dx = ann.x2 - ann.x1;
        const dy = ann.y2 - ann.y1;
        const lengthSq = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((p.x - ann.x1) * dx + (p.y - ann.y1) * dy) / lengthSq));
        return distance(p, { x: ann.x1 + t * dx, y: ann.y1 + t * dy });
    }

    function getPlate() {
        if (params.get('placa')) return params.get('placa').trim().toUpperCase();
        return storage.getPlate();
    }

    function savedPartDescriptions() {
        const state = storage.getState();
        return [...new Set((Array.isArray(state?.quoteItems) ? state.quoteItems : []).map((item) => item.descrip?.trim()).filter(Boolean))];
    }

    function savedRepuestos() {
        const state = storage.getState();
        let items = Array.isArray(state.quoteItems) ? state.quoteItems : [];
        let changed = false;
        items = items.map((item) => {
            if (!item || item.id) return item;
            changed = true;
            return { ...item, id: storage.makeId() };
        });
        if (changed) {
            storage.updateQuoteItems(items);
        }
        return items;
    }

    function savedNaIds() {
        return storage.getNaIds();
    }

    function toggleNa(item) {
        const naIds = savedNaIds();
        if (naIds.has(item.id)) naIds.delete(item.id);
        else naIds.add(item.id);
        storage.saveNaIds(naIds);
        render();
    }

    function setStatus(text) {
        const el = $('photoStatus');
        if (el) el.textContent = text;
    }

    async function refresh() {
        const plate = getPlate();
        photos = plate ? await storage.getPhotosByPlate(plate) : [];
        render();
        setStatus(plate ? `${photos.length} fotos guardadas para ${plate}.` : 'Vuelve a la cotización y registra una placa.');
    }

    function render() {
        renderRepuestos();
    }

    function renderPhotoCards(grid, photoList) {
        grid.innerHTML = '';
        photoList.forEach((photo) => {
            const card = document.createElement('div');
            card.className = 'photo-card';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `photo-thumb${photo.marked ? ' photo-thumb-marked' : ''}`;
            const image = document.createElement('img');
            image.src = URL.createObjectURL(photo.blob);
            image.alt = photo.marked ? 'Foto marcada' : 'Foto de inspección';
            button.appendChild(image);
            button.addEventListener('click', () => openEditor(photo));
            card.appendChild(button);

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'photo-delete-btn';
            delBtn.innerHTML = '&#128465;';
            delBtn.title = 'Eliminar foto';
            delBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                photoPendingDelete = photo;
                repuestoToDelete = null;
                $('deleteModal').hidden = false;
            });
            card.appendChild(delBtn);
            grid.appendChild(card);
        });
    }

    function buildRepuestoCard(item) {
        const isNa = savedNaIds().has(item.id);
        const card = document.createElement('div');
        card.className = 'repuesto-card' + (isNa ? ' repuesto-card-na' : '');

        if (isNa) {
            card.innerHTML = `
                <span class="repuesto-na-name">${item.descrip || item.id}</span>
                <span class="repuesto-na-tag">N/A</span>
            `;
            card.title = 'Pulsa para quitar el N/A';
            card.setAttribute('role', 'button');
            card.tabIndex = 0;
            card.addEventListener('click', () => toggleNa(item));
            return card;
        }

        const id = item.id;
        const repPhotos = photos.filter((photo) => String(photo.repuestoId) === String(id));

        const name = document.createElement('div');
        name.className = 'repuesto-name';
        name.textContent = item.descrip || item.id;

        const row = document.createElement('div');
        row.className = 'repuesto-row';

        const media = document.createElement('div');
        media.className = 'repuesto-media';
        if (repPhotos.length) {
            renderPhotoCards(media, repPhotos);
        } else {
            media.innerHTML = '<div class="repuesto-empty">Sin foto</div>';
        }

        const icons = document.createElement('div');
        icons.className = 'repuesto-icons';

        const cameraBtn = document.createElement('button');
        cameraBtn.type = 'button';
        cameraBtn.className = 'repuesto-icon-btn repuesto-camera-btn';
        cameraBtn.innerHTML = '&#128247;';
        cameraBtn.title = 'Tomar foto';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.capture = 'environment';
        fileInput.multiple = true;
        fileInput.className = 'visually-hidden';
        fileInput.addEventListener('change', (e) => processFiles(e, false, item));

        cameraBtn.addEventListener('click', () => fileInput.click());

        const naBtn = document.createElement('button');
        naBtn.type = 'button';
        naBtn.className = 'repuesto-icon-btn repuesto-na-btn';
        naBtn.textContent = 'N/A';
        naBtn.addEventListener('click', () => toggleNa(item));

        const trashBtn = document.createElement('button');
        trashBtn.type = 'button';
        trashBtn.className = 'repuesto-icon-btn repuesto-delete-btn';
        trashBtn.innerHTML = '&#128465;';
        trashBtn.disabled = !repPhotos.length;
        trashBtn.addEventListener('click', () => {
            repuestoToDelete = item;
            photoPendingDelete = null;
            $('deleteModal').hidden = false;
        });

        icons.append(cameraBtn, naBtn, trashBtn, fileInput);
        row.append(media, icons);

        const counter = document.createElement('div');
        counter.className = 'repuesto-count';
        counter.textContent = `${repPhotos.length} ${repPhotos.length === 1 ? 'foto' : 'fotos'}`;

        card.append(name, row, counter);
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
            if (naIds.has(item.id)) {
                naCount++;
                naList.appendChild(card);
            } else {
                container.appendChild(card);
            }
        });

        naWrapper.hidden = naCount === 0;
        if (!repuestos.length) {
            container.innerHTML = '<p class="panel-heading-caption">No hay repuestos registrados. Vuelve a Datos y agrega los repuestos.</p>';
        }
    }

    async function processFiles(event, openDetail, repuesto) {
        const plate = getPlate();
        if (!plate) { setStatus('No hay placa activa.'); return; }

        try {
            for (const file of event.target.files) {
                const blob = await compress(file, repuesto?.descrip);
                await storage.savePhoto({
                    placaVehiculo: plate,
                    blob: blob,
                    marked: false,
                    createdAt: Date.now(),
                    repuestoId: repuesto?.id ? String(repuesto.id) : undefined,
                    repuesto: repuesto?.descrip || undefined
                });
            }
            await refresh();
            if (openDetail && photos.length) openEditor(photos[photos.length - 1]);
        } catch (error) {
            setStatus(`Error: ${error.message}`);
        }
        event.target.value = '';
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
            image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagen no válida')); };
            image.src = url;
        });
    }

    // --- Lógica del Editor ---

    function annotationAt(point) {
        const canvas = $('photoCanvas');
        const context = canvas.getContext('2d');
        for (let i = annotations.length - 1; i >= 0; i--) {
            const ann = annotations[i];
            let hit = false;
            if (ann.type === 'circle') hit = Math.abs(distance(point, { x: ann.cx, y: ann.cy }) - ann.radius) < 35;
            else if (ann.type === 'arrow') hit = distanceToSegment(point, ann) < 35;
            else if (ann.type === 'text' || ann.type === 'repuesto') {
                const fontSize = Math.max(12, Math.min(30, canvas.width / 34));
                context.font = `700 ${fontSize}px Oxanium, sans-serif`;
                const pad = 10;
                const w = context.measureText(ann.text).width + pad * 2;
                const h = fontSize + pad * 2;
                hit = point.x >= ann.x - w/2 && point.x <= ann.x + w/2 && point.y >= ann.y - h/2 && point.y <= ann.y + h/2;
            }
            if (hit) return ann;
        }
        return null;
    }

    function pointFromEvent(event) {
        const canvas = $('photoCanvas');
        const rect = canvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * canvas.width / rect.width,
            y: (event.clientY - rect.top) * canvas.height / rect.height
        };
    }

    function redraw() {
        const canvas = $('photoCanvas');
        const context = canvas.getContext('2d');
        if (!sourceImage) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(sourceImage, 0, 0);
        drawAnnotations();
    }

    function drawAnnotations() {
        const canvas = $('photoCanvas');
        const context = canvas.getContext('2d');
        annotations.forEach((ann) => {
            context.save();
            context.strokeStyle = '#ef2222';
            context.lineWidth = annotationStrokeWidth();
            context.lineCap = 'round';
            context.beginPath();

            if (ann.type === 'circle') {
                context.arc(ann.cx, ann.cy, ann.radius, 0, Math.PI * 2);
            } else if (ann.type === 'arrow') {
                context.moveTo(ann.x1, ann.y1);
                context.lineTo(ann.x2, ann.y2);
                const angle = Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1);
                const size = 28;
                context.moveTo(ann.x2, ann.y2);
                context.lineTo(ann.x2 - size * Math.cos(angle - Math.PI / 6), ann.y2 - size * Math.sin(angle - Math.PI / 6));
                context.moveTo(ann.x2, ann.y2);
                context.lineTo(ann.x2 - size * Math.cos(angle + Math.PI / 6), ann.y2 - size * Math.sin(angle + Math.PI / 6));
            }
            context.stroke();
            context.restore();

            if (ann.type === 'text' || ann.type === 'repuesto') {
                const isRep = ann.type === 'repuesto';
                const borderColor = isRep ? '#315ddc' : '#ef2222';
                context.save();
                const padding = 10;
                const fontSize = Math.max(12, Math.min(30, canvas.width / 34));
                context.font = `700 ${fontSize}px Oxanium, sans-serif`;
                const textWidth = context.measureText(ann.text).width;
                const boxW = textWidth + padding * 2;
                const boxH = fontSize + padding * 2;
                const x = Math.max(0, Math.min(canvas.width - boxW, ann.x - boxW / 2));
                const y = Math.max(0, Math.min(canvas.height - boxH, ann.y - boxH / 2));

                context.fillStyle = '#fff';
                context.fillRect(x, y, boxW, boxH);
                context.fillStyle = isRep ? '#0a1e4f' : '#111827';
                context.textBaseline = 'middle';
                context.fillText(ann.text, x + padding, y + boxH / 2);
                context.strokeStyle = borderColor;
                context.lineWidth = isRep ? 4 : 3;
                context.strokeRect(x, y, boxW, boxH);
                context.restore();
            }
        });
    }

    function openEditor(photo) {
        currentPhoto = photo;
        annotations = [];
        sourceImage = new Image();
        sourceImage.onload = () => {
            const canvas = $('photoCanvas');
            canvas.width = sourceImage.width;
            canvas.height = sourceImage.height;
            redraw();
        };
        sourceImage.src = URL.createObjectURL(photo.blob);
        $('photoEditor').hidden = false;

        const repuestoSelect = $('repuestoSelect');
        if (repuestoSelect) {
            repuestoSelect.innerHTML = '<option value="">SELECCIONA UN REPUESTO</option>';
            savedPartDescriptions().forEach((desc) => {
                const opt = document.createElement('option');
                opt.value = desc;
                opt.textContent = desc;
                repuestoSelect.appendChild(opt);
            });
        }
    }

    function addTextAnnotation(value, type = 'text') {
        if (!value) return;
        const canvas = $('photoCanvas');
        annotations.push({
            type: type,
            text: value,
            x: canvas.width / 2,
            y: canvas.height / 2
        });
        redraw();
    }

    function recognizeGesture(path) {
        if (path.length < 2) return;
        const first = path[0];
        const last = path[path.length - 1];
        const xs = path.map(p => p.x);
        const ys = path.map(p => p.y);
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
        const dist = Math.hypot(first.x - last.x, first.y - last.y);

        if (dist < Math.max(width, height) * 0.4 && width > 20 && height > 20) {
            annotations.push({
                type: 'circle',
                cx: (Math.min(...xs) + Math.max(...xs)) / 2,
                cy: (Math.min(...ys) + Math.max(...ys)) / 2,
                radius: Math.min(width, height) / 2
            });
        } else if (dist > 20) {
            annotations.push({
                type: 'arrow',
                x1: first.x, y1: first.y,
                x2: last.x, y2: last.y
            });
        }
    }

    async function init() {
        const plate = getPlate();
        const plateLabel = $('plateLabel');
        if (plateLabel) plateLabel.textContent = plate ? `PLACA: ${plate}` : 'Sin placa';

        await storage.openDB();
        await refresh();

        $('downloadPhotosBtn')?.addEventListener('click', downloadAll);

        $('cancelDeleteBtn')?.addEventListener('click', () => { $('deleteModal').hidden = true; });
        $('confirmDeleteBtn')?.addEventListener('click', async () => {
            if (repuestoToDelete) {
                const all = await storage.getPhotosByPlate(getPlate());
                const toDelete = all.filter(p => String(p.repuestoId) === String(repuestoToDelete.id));
                for (const p of toDelete) await storage.deletePhoto(p.id);
            } else if (photoPendingDelete) {
                await storage.deletePhoto(photoPendingDelete.id);
            }
            $('deleteModal').hidden = true;
            await refresh();
        });

        $('cancelEditBtn')?.addEventListener('click', () => { $('photoEditor').hidden = true; });
        $('clearDrawingBtn')?.addEventListener('click', () => { annotations.pop(); redraw(); });
        $('saveMarkedBtn')?.addEventListener('click', async () => {
            const blob = await new Promise(res => $('photoCanvas').toBlob(res, 'image/jpeg', JPEG_QUALITY));
            await storage.savePhoto({ ...currentPhoto, blob, marked: true });
            $('photoEditor').hidden = true;
            await refresh();
        });

        $('damageSelect')?.addEventListener('change', (e) => {
            if (e.target.value) {
                addTextAnnotation(e.target.value, 'text');
                e.target.value = '';
            }
        });

        $('repuestoSelect')?.addEventListener('change', (e) => {
            if (e.target.value) {
                addTextAnnotation(e.target.value, 'repuesto');
                e.target.value = '';
            }
        });

        const canvas = $('photoCanvas');
        if (canvas) {
            canvas.addEventListener('pointerdown', (e) => {
                const p = pointFromEvent(e);
                movingAnnotation = annotationAt(p);
                if (movingAnnotation) {
                    if (movingAnnotation.type === 'circle') {
                        moveOffset = { x: p.x - movingAnnotation.cx, y: p.y - movingAnnotation.cy };
                    } else if (movingAnnotation.type === 'text' || movingAnnotation.type === 'repuesto') {
                        moveOffset = { x: p.x - movingAnnotation.x, y: p.y - movingAnnotation.y };
                    } else {
                        moveOffset = { x: p.x - movingAnnotation.x1, y: p.y - movingAnnotation.y1 };
                    }
                    return;
                }
                drawing = true;
                points = [p];
            });

            canvas.addEventListener('pointermove', (e) => {
                const p = pointFromEvent(e);
                if (movingAnnotation) {
                    if (movingAnnotation.type === 'circle') {
                        movingAnnotation.cx = p.x - moveOffset.x;
                        movingAnnotation.cy = p.y - moveOffset.y;
                    } else if (movingAnnotation.type === 'text' || movingAnnotation.type === 'repuesto') {
                        movingAnnotation.x = p.x - moveOffset.x;
                        movingAnnotation.y = p.y - moveOffset.y;
                    } else {
                        const dx = p.x - moveOffset.x - movingAnnotation.x1;
                        const dy = p.y - moveOffset.y - movingAnnotation.y1;
                        movingAnnotation.x1 += dx; movingAnnotation.x2 += dx;
                        movingAnnotation.y1 += dy; movingAnnotation.y2 += dy;
                    }
                    redraw();
                    return;
                }
                if (!drawing) return;
                points.push(p);

                redraw();
                const ctx = canvas.getContext('2d');
                ctx.save();
                ctx.strokeStyle = '#ef2222';
                ctx.lineWidth = annotationStrokeWidth();
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.stroke();
                ctx.restore();
            });

            canvas.addEventListener('pointerup', () => {
                if (movingAnnotation) {
                    movingAnnotation = null;
                    return;
                }
                if (!drawing) return;
                drawing = false;
                recognizeGesture(points);
                redraw();
            });
        }
    }

    async function downloadAll() {
        const plate = getPlate();
        const records = await storage.getPhotosByPlate(plate);
        if (!records.length) { setStatus('No hay fotos para descargar.'); return; }

        setStatus(`Preparando ${records.length} fotos...`);
        for (const [index, photo] of records.entries()) {
            const link = document.createElement('a');
            const url = URL.createObjectURL(photo.blob);
            link.href = url;
            link.download = `${plate}_${String(index + 1).padStart(2, '0')}${photo.marked ? '_MARCADA' : ''}.jpg`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
            await new Promise(res => setTimeout(res, 400));
        }

        const state = storage.getState();
        state.photosDownloaded = true;
        storage.saveState(state);
        setStatus('Descarga completada.');
    }

    document.addEventListener('DOMContentLoaded', init);
    window.AppStorage.highlightActiveNav();
})();
