(() => {
    'use strict';
    const storage = window.AppStorage;
    const $ = (id) => document.getElementById(id);

    // Función para obtener los datos más recientes
    const getFreshData = () => {
        const state = storage.getState();
        const fields = state.fields || {};
        const items = Array.isArray(state.quoteItems) ? state.quoteItems : [];
        const statusOrder = { CAMBIO: 0, RECUPERACION: 1, FUERTE: 2, MEDIO: 3, LEVE: 4 };

        const orderedItems = items
            .map((item, index) => ({ item, index }))
            .sort((a, b) => {
                const orderA = statusOrder[String(a.item.estado || '').trim().toUpperCase()] ?? 5;
                const orderB = statusOrder[String(b.item.estado || '').trim().toUpperCase()] ?? 5;
                return orderA - orderB || a.index - b.index;
            })
            .map(({ item }) => item);

        return { fields, orderedItems, state };
    };

    const getSubjectText = () => {
        const { fields } = getFreshData();
        return `COTIZACION ${fields.marca || ''} ${fields.placa || ''} ${fields.linea || ''} ${fields.tipoCliente || ''}`.replace(/\s+/g, ' ').trim();
    };

    const escapeHtml = (v) => String(v || '-').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const richBody = () => {
        const { fields, orderedItems } = getFreshData();
        const rows = orderedItems.length ? orderedItems.map((item, index) => {
            const isChange = String(item.estado || '').trim().toUpperCase() === 'CAMBIO';
            const color = isChange ? '#ff0000' : '#000000';
            return `<tr style="color:${color};"><td>${index + 1}</td><td>${escapeHtml(item.descrip)}</td><td>${escapeHtml(item.cant)}</td><td>${escapeHtml(item.dym)}</td><td>${escapeHtml(item.estado)}</td><td>${escapeHtml(item.pint)}</td><td>${escapeHtml(item.dat)}</td></tr>`;
        }).join('') : '<tr><td colspan="7">No hay repuestos registrados.</td></tr>';

        const headerStyle = 'background-color:#c6dcf0;color:#000000;font-weight:700;border:1px solid #000;padding:6px;';
        const cellStyle = 'border:1px solid #000;padding:6px;';

        return `<div style="font-family:Arial,sans-serif;">${escapeHtml($('greetingInput').value.trim() || 'Cordial saludo,').replace(/\n/g, '<br>')}</div><br>
                <strong>Datos del vehiculo</strong><br>
                <table border="1" cellspacing="0" style="border-collapse:collapse;width:100%;">
                    <tr style="background:#c6dcf0;">
                        <th style="${cellStyle}">Fecha</th><th style="${cellStyle}">Placa</th><th style="${cellStyle}">Marca</th><th style="${cellStyle}">Linea</th>
                    </tr>
                    <tr>
                        <td style="${cellStyle}">${escapeHtml(fields.fecha)}</td><td style="${cellStyle}">${escapeHtml(fields.placa)}</td><td style="${cellStyle}">${escapeHtml(fields.marca)}</td><td style="${cellStyle}">${escapeHtml(fields.linea)}</td>
                    </tr>
                </table><br>
                <strong>Repuestos solicitados</strong><br>
                <table border="1" cellspacing="0" style="border-collapse:collapse;width:100%;">
                    <thead><tr style="background:#c6dcf0;"><th style="${cellStyle}">N°</th><th style="${cellStyle}">DESCRIPCIÓN</th><th style="${cellStyle}">CANT</th><th style="${cellStyle}">DYM</th><th style="${cellStyle}">DAÑO</th><th style="${cellStyle}">PINT</th><th style="${cellStyle}">OBS</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>`;
    };

    const updatePreview = () => {
        const { fields, orderedItems } = getFreshData();

        // Actualizar Asunto
        const subInput = $('subjectInput');
        if (subInput) subInput.value = getSubjectText();

        // Actualizar Label superior
        const label = $('mailVehicleLabel');
        if (label) label.textContent = `${fields.marca || '-'} ${fields.linea || '-'} / ${fields.placa || '-'}`;

        // Vista previa del Saludo
        const prevGreeting = $('mailPreviewGreeting');
        if (prevGreeting) prevGreeting.textContent = $('greetingInput').value.trim() || 'Cordial saludo,';

        // Vista previa de la Tabla
        const body = $('mailItemsTableBody');
        if (body) {
            body.innerHTML = '';
            orderedItems.forEach((item, index) => {
                const row = document.createElement('tr');
                [String(index + 1), item.descrip, item.cant, item.estado, item.pint, item.dat].forEach(text => {
                    const td = document.createElement('td');
                    td.textContent = text || '-';
                    row.appendChild(td);
                });
                body.appendChild(row);
            });
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        const settings = storage.getSettings();
        const greetingInput = $('greetingInput');
        if (greetingInput) {
            greetingInput.value = settings.greeting || 'Cordial saludo,';
            greetingInput.addEventListener('input', () => {
                const s = storage.getSettings();
                s.greeting = greetingInput.value;
                storage.saveSettings(s);
                updatePreview();
            });
        }

        $('openGmailBtn')?.addEventListener('click', async () => {
            const groupIdx = $('groupSelector').value;
            if (groupIdx === "") { alert('Elige un grupo.'); return; }

            const group = storage.getGroups()[groupIdx];
            const recipients = group.emails.join(',');
            const subject = getSubjectText();
            const { state } = getFreshData();

            if (!state.photosDownloaded) { alert('Descarga las fotos primero.'); return; }

            // Copiar tabla al portapapeles
            try {
                const html = richBody();
                const blob = new Blob([html], { type: 'text/html' });
                const item = new ClipboardItem({ 'text/html': blob });
                await navigator.clipboard.write([item]);
            } catch (e) { console.error('Error copiando tabla'); }

            storage.setEmailOpened(true);
            const webUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipients)}&su=${encodeURIComponent(subject)}`;
            window.open(webUrl, '_blank') || (window.location.href = webUrl);
        });

        $('openRecipientsBtn')?.addEventListener('click', () => { $('recipientsModal').hidden = false; });
        $('closeRecipientsBtn')?.addEventListener('click', () => { $('recipientsModal').hidden = true; });

        updatePreview();
        storage.highlightActiveNav();
    });
})();
