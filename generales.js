(() => {
    'use strict';

    const storage = window.AppStorage;
    const MAX_WIDTH = 1280;
    const MAX_HEIGHT = 960;
    const JPEG_QUALITY = 0.75;
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
        return storage.getPlate();
    }

    function setStatus(text) {
        const el = $('photoStatus');
        if (el) el.textContent = text;
    }

    async function refresh() {
        const plate = getPlate();
        if (plate) {
            const allPhotos = await storage.getPhotosByPlate(plate);
            // Filtramos solo las fotos generales (sin repuestoId)
            photos = allPhotos.filter(p => !p.repuestoId);
        } else {
            photos = [];
        }
        render();
        setStatus(plate ? `${photos.length} fotos generales para ${plate}.` : 'Sin placa seleccionada.');
    }

    function render() {
        const grid = $('photoGrid');
        if (!grid) return;
        grid.innerHTML = '';

        photos.forEach((photo) => {
            const card = document.createElement('div');
            card.className = 'photo-card';

            const button = document.createElement('button');
            button.type = 'button';
            button.className = `photo-thumb${photo.marked ? ' photo-thumb-marked' : ''}`;

            const image = document.createElement('img');
            image.src = URL.createObjectURL(photo.blob);
            image.alt = 'Foto general';

            button.appendChild(image);
            button.addEventListener('click', () => openEditor(photo));
            card.appendChild(button);

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'photo-delete-btn';
            delBtn.innerHTML = '&#128465;';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                photoPendingDelete = photo;
                $('deleteModal').hidden = false;
            });
            card.appendChild(delBtn);

            grid.appendChild(card);
        });

        const countEl = $('photoCount');
        if (countEl) countEl.textContent = `${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}`;
    }

    async function processFiles(event, openDetail) {
        const plate = getPlate();
        if (!plate) { setStatus('No hay placa activa para guardar fotos.'); return; }

        try {
            for (const file of event.target.files) {
                // Usamos la placa como etiqueta para la foto general
                const blob = await compress(file, plate);
                await storage.savePhoto({
                    placaVehiculo: plate,
                    blob: blob,
                    marked: false,
                    createdAt: Date.now()
                });
            }
            await refresh();
            if (openDetail && photos.length) openEditor(photos[photos.length - 1]);
        } catch (error) {
            setStatus(`Error al guardar: ${error.message}`);
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
        annotations.forEach(ann => {
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

            if (ann.type === 'text') {
                const fontSize = Math.max(12, Math.min(30, canvas.width / 34));
                context.font = `700 ${fontSize}px Oxanium, sans-serif`;
                const pad = 10;
                const txtW = context.measureText(ann.text).width;
                const boxW = txtW + pad * 2;
                const boxH = fontSize + pad * 2;
                const x = Math.max(0, Math.min(canvas.width - boxW, ann.x - boxW/2));
                const y = Math.max(0, Math.min(canvas.height - boxH, ann.y - boxH/2));
                context.fillStyle = '#fff'; context.fillRect(x, y, boxW, boxH);
                context.fillStyle = '#111827'; context.textBaseline = 'middle';
                context.fillText(ann.text, x + pad, y + boxH/2);
                context.strokeStyle = '#ef2222'; context.lineWidth = 3;
                context.strokeRect(x, y, boxW, boxH);
            }
            context.restore();
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
    }

    function addTextAnnotation(val) {
        if (!val) return;
        const canvas = $('photoCanvas');
        annotations.push({ type: 'text', text: val, x: canvas.width / 2, y: canvas.height / 2 });
        redraw();
    }

    function recognizeGesture(path) {
        if (path.length < 2) return;
        const first = path[0]; const last = path[path.length - 1];
        const xs = points.map(p => p.x); const ys = points.map(p => p.y);
        const w = Math.max(...xs) - Math.min(...xs); const h = Math.max(...ys) - Math.min(...ys);
        const dist = Math.hypot(first.x - last.x, first.y - last.y);
        if (dist < Math.max(w,h) * 0.4 && w > 20 && h > 20) {
            annotations.push({ type: 'circle', cx: (Math.min(...xs)+Math.max(...xs))/2, cy: (Math.min(...ys)+Math.max(...ys))/2, radius: Math.min(w,h)/2 });
        } else if (Math.max(w,h) > 20) {
            annotations.push({ type: 'arrow', x1: first.x, y1: first.y, x2: last.x, y2: last.y });
        }
    }

    function annotationAt(point) {
        const canvas = $('photoCanvas');
        const context = canvas.getContext('2d');
        for (let i = annotations.length - 1; i >= 0; i--) {
            const ann = annotations[i];
            let hit = false;
            if (ann.type === 'circle') hit = Math.abs(distance(point, { x: ann.cx, y: ann.cy }) - ann.radius) < 35;
            else if (ann.type === 'arrow') hit = distanceToSegment(point, ann) < 35;
            else if (ann.type === 'text') {
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

    async function init() {
        const plate = getPlate();
        $('plateLabel').textContent = plate ? `PLACA: ${plate}` : 'Sin placa';

        await storage.openDB();
        await refresh();

        $('photoInput').addEventListener('change', (e) => processFiles(e, false));
        $('detailPhotoInput').addEventListener('change', (e) => processFiles(e, true));

        $('cancelEditBtn').addEventListener('click', () => { $('photoEditor').hidden = true; });
        $('clearDrawingBtn').addEventListener('click', () => { annotations.pop(); redraw(); });
        $('saveMarkedBtn').addEventListener('click', async () => {
            const blob = await new Promise(res => $('photoCanvas').toBlob(res, 'image/jpeg', JPEG_QUALITY));
            await storage.savePhoto({ ...currentPhoto, blob, marked: true });
            $('photoEditor').hidden = true;
            await refresh();
        });

        $('cancelDeleteBtn').addEventListener('click', () => $('deleteModal').hidden = true);
        $('confirmDeleteBtn').addEventListener('click', async () => {
            if (photoPendingDelete) await storage.deletePhoto(photoPendingDelete.id);
            photoPendingDelete = null;
            $('deleteModal').hidden = true;
            await refresh();
        });

        $('damageSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                addTextAnnotation(e.target.value);
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
                    } else if (movingAnnotation.type === 'text') {
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
                    } else if (movingAnnotation.type === 'text') {
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
        storage.highlightActiveNav();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
