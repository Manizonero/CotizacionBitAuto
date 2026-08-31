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
    let photoPendingDelete = null;

    const annotationStrokeWidth = () => {
        const canvas = $('photoCanvas');
        if (!canvas) return 12;
        return Math.max(12, Math.min(32, Math.max(canvas.width, canvas.height) / 140));
    };

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

        $('photoCount').textContent = `${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}`;
    }

    async function processFiles(event, openDetail) {
        const plate = getPlate();
        if (!plate) return;

        try {
            for (const file of event.target.files) {
                const blob = await compress(file);
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
            setStatus(`Error: ${error.message}`);
        }
        event.target.value = '';
    }

    function compress(file) {
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

    async function init() {
        const plate = getPlate();
        $('plateLabel').textContent = plate ? `PLACA: ${plate}` : 'Sin placa';

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
                drawing = true;
                points = [pointFromEvent(e)];
            });
            canvas.addEventListener('pointermove', (e) => {
                if (!drawing) return;
                const p = pointFromEvent(e);
                points.push(p);
                const ctx = canvas.getContext('2d');
                ctx.strokeStyle = '#ef2222';
                ctx.lineWidth = annotationStrokeWidth();
                ctx.lineCap = 'round';
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
            });
            canvas.addEventListener('pointerup', () => {
                if (!drawing) return;
                drawing = false;
                // Reconocimiento simple de gesto
                const first = points[0]; const last = points[points.length-1];
                const dist = Math.hypot(first.x - last.x, first.y - last.y);
                const xs = points.map(p => p.x); const ys = points.map(p => p.y);
                const w = Math.max(...xs) - Math.min(...xs); const h = Math.max(...ys) - Math.min(...ys);
                if (dist < Math.max(w,h) * 0.4 && w > 20 && h > 20) {
                    annotations.push({ type: 'circle', cx: (Math.min(...xs)+Math.max(...xs))/2, cy: (Math.min(...ys)+Math.max(...ys))/2, radius: Math.min(w,h)/2 });
                } else if (Math.max(w,h) > 20) {
                    annotations.push({ type: 'arrow', x1: first.x, y1: first.y, x2: last.x, y2: last.y });
                }
                redraw();
            });
        }

        await storage.openDB();
        await refresh();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
