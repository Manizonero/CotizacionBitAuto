(() => {
    'use strict';
    const STATE_KEY = 'coticarQuoteState';
    const CONTACTS_KEY = 'coticarEmailContacts';
    const SETTINGS_KEY = 'coticarEmailSettings';
    const $ = (id) => document.getElementById(id);
    const state = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
    const fields = state.fields || {};
    let contacts = JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]');
    let settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const items = Array.isArray(state.quoteItems) ? state.quoteItems : [];
    let editingContactIndex = null;

    const subject = () => `COTIZACION ${fields.marca || ''} ${fields.placa || ''} ${fields.linea || ''} ${fields.tipoCliente || ''}`.replace(/\s+/g, ' ').trim();
    const fitCell = (value, width) => String(value || '-').replace(/[\r\n]+/g, ' ').slice(0, width).padEnd(width, ' ');
    const partsGrid = () => {
        const columns = [['No.', 4], ['Descripcion', 30], ['Cantidad', 9], ['Estado', 12], ['Pint.', 7], ['Dato', 18]];
        const line = `+${columns.map(([, width]) => '-'.repeat(width + 2)).join('+')}+`;
        const header = `| ${columns.map(([label, width]) => fitCell(label, width)).join(' | ')} |`;
        const rows = items.map((item, index) => `| ${[index + 1, item.descrip, item.cant, item.estado, item.pint, item.dat].map((value, columnIndex) => fitCell(value, columns[columnIndex][1])).join(' | ')} |`);
        return [line, header, line, ...rows, line].join('\n');
    };
    const escapeHtml = (value) => String(value || '-').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    const richBody = () => {
        const rows = items.length ? items.map((item, index) => { const isChange = String(item.estado || '').trim().toUpperCase() === 'CAMBIO'; const color = isChange ? '#ff0000' : '#000000'; return `<tr style="color:${color};"><td>${index + 1}</td><td>${escapeHtml(item.descrip)}</td><td>${escapeHtml(item.cant)}</td><td>${escapeHtml(item.dym)}</td><td>${escapeHtml(item.estado)}</td><td>${escapeHtml(item.pint)}</td><td>${escapeHtml(item.dat)}</td></tr>`; }).join('') : '<tr><td colspan="7">No hay repuestos registrados.</td></tr>';
        const headerStyle = 'background-color:#c6dcf0;color:#000000;font-weight:700;';
        const tableStyle = 'border-collapse:collapse;border:1px solid #000000;color:#000000;font-family:Arial,sans-serif;font-size:14px;';
        const cellStyle = 'border:1px solid #000000;padding:6px 8px;';
        return `<div style="color:#000000;font-family:Arial,sans-serif;">${escapeHtml($('greetingInput').value.trim() || 'Cordial saludo,').replace(/\n/g, '<br>')}</div><br><div style="color:#000000;font-family:Arial,sans-serif;"><strong>Datos del vehiculo</strong></div><table border="1" cellpadding="6" cellspacing="0" style="${tableStyle}"><tr style="${headerStyle}"><th style="${cellStyle}">Fecha</th><th style="${cellStyle}">Placa</th><th style="${cellStyle}">Marca</th><th style="${cellStyle}">Linea</th><th style="${cellStyle}">Modelo</th><th style="${cellStyle}">Color</th><th style="${cellStyle}">Tipo de cliente</th></tr><tr style="color:#000000;"><td style="${cellStyle}">${escapeHtml(fields.fecha)}</td><td style="${cellStyle}">${escapeHtml(fields.placa)}</td><td style="${cellStyle}">${escapeHtml(fields.marca)}</td><td style="${cellStyle}">${escapeHtml(fields.linea)}</td><td style="${cellStyle}">${escapeHtml(fields.modelo)}</td><td style="${cellStyle}">${escapeHtml(fields.color)}</td><td style="${cellStyle}">${escapeHtml(fields.tipoCliente)}</td></tr></table><br><div style="color:#000000;font-family:Arial,sans-serif;"><strong>Repuestos solicitados</strong></div><table border="1" cellpadding="6" cellspacing="0" style="${tableStyle}"><thead><tr style="${headerStyle}"><th style="${cellStyle}">N°</th><th style="${cellStyle}">DESCRIPCIÓN</th><th style="${cellStyle}">CANT</th><th style="${cellStyle}">DYM</th><th style="${cellStyle}">NIVEL DAÑO</th><th style="${cellStyle}">PINT</th><th style="${cellStyle}">OBSERVACIÓN</th></tr></thead><tbody>${rows}</tbody></table>`;
    };
    const body = () => {
        const grid = items.length ? partsGrid() : 'No hay repuestos registrados.';
        return `${$('greetingInput').value.trim() || 'Cordial saludo,'}\n\nDatos del vehiculo\nFecha: ${fields.fecha || '-'}\nPlaca: ${fields.placa || '-'}\nMarca: ${fields.marca || '-'}\nLinea: ${fields.linea || '-'}\nModelo: ${fields.modelo || '-'}\nColor: ${fields.color || '-'}\nTipo de cliente: ${fields.tipoCliente || '-'}${fields.cilindraje ? `\nCilindraje: ${fields.cilindraje}` : ''}${fields.vin ? `\nVIN: ${fields.vin}` : ''}\n\nRepuestos solicitados\n${grid}`;
    };
    const saveContacts = () => localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
    const saveSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    const renderContacts = () => {
        const list = $('contactsList'); list.innerHTML = '';
        contacts.forEach((contact, index) => {
            const row = document.createElement('div'); row.className = 'contact-row';
            row.innerHTML = `<label class="contact-choice"><input type="checkbox" data-index="${index}" ${contact.selected ? 'checked' : ''}><span><strong>${contact.name}</strong><small>${contact.email}</small></span></label><button type="button" class="contact-action edit-contact" data-index="${index}" title="Editar correo">Editar</button><button type="button" class="contact-action delete-contact" data-index="${index}" title="Eliminar correo">Eliminar</button>`;
            list.appendChild(row);
        });
        const selected = contacts.filter((contact) => contact.selected).length;
        $('selectedRecipients').textContent = selected ? contacts.filter((contact) => contact.selected).map((contact) => contact.name).join(', ') : 'Ningun correo seleccionado';
    };
    const renderItemsTable = () => {
        $('mailItemsTableBody').innerHTML = '';
        items.forEach((item) => {
            const row = document.createElement('tr');
            [String(items.indexOf(item) + 1), item.descrip, item.cant, item.estado, item.pint, item.dat].forEach((value) => {
                const cell = document.createElement('td');
                cell.textContent = value || '-';
                row.appendChild(cell);
            });
            $('mailItemsTableBody').appendChild(row);
        });
    };
    const renderVehiclePreview = () => {
        $('mailPreviewGreeting').textContent = $('greetingInput').value.trim() || 'Cordial saludo,';
        const table = document.createElement('table');
        table.className = 'mail-vehicle-table';
        const fieldsToShow = [['Fecha', fields.fecha], ['Placa', fields.placa], ['Marca', fields.marca], ['Linea', fields.linea], ['Modelo', fields.modelo], ['Color', fields.color], ['Tipo de cliente', fields.tipoCliente]];
        const header = document.createElement('tr');
        fieldsToShow.forEach(([label]) => { const cell = document.createElement('th'); cell.textContent = label; header.appendChild(cell); });
        const values = document.createElement('tr');
        fieldsToShow.forEach(([, value]) => { const cell = document.createElement('td'); cell.textContent = value || '-'; values.appendChild(cell); });
        table.append(header, values);
        $('mailVehicleTableWrap').replaceChildren(table);
    };
    const updatePreview = () => { $('subjectInput').value = settings.subject || subject(); renderVehiclePreview(); renderItemsTable(); };
    const addContact = (event) => { event.preventDefault(); const name = $('contactName').value.trim(); const email = $('contactEmail').value.trim().toLowerCase(); const duplicate = contacts.some((contact, index) => contact.email === email && index !== editingContactIndex); if (duplicate) { $('contactStatus').textContent = 'Ese correo ya esta registrado.'; return; } if (editingContactIndex === null) contacts.push({ name, email, selected: true }); else { contacts[editingContactIndex] = { ...contacts[editingContactIndex], name, email }; } editingContactIndex = null; saveContacts(); event.target.reset(); $('contactForm').hidden = true; $('contactStatus').textContent = 'Correo guardado.'; renderContacts(); };
    $('contactForm').addEventListener('submit', addContact);
    $('contactsList').addEventListener('change', (event) => { if (!event.target.matches('input[type="checkbox"]')) return; contacts[Number(event.target.dataset.index)].selected = event.target.checked; saveContacts(); renderContacts(); });
    $('contactsList').addEventListener('click', (event) => { const button = event.target.closest('button'); if (!button) return; const index = Number(button.dataset.index); if (button.classList.contains('delete-contact')) { contacts.splice(index, 1); saveContacts(); renderContacts(); return; } const contact = contacts[index]; editingContactIndex = index; $('contactName').value = contact.name; $('contactEmail').value = contact.email; $('contactForm').hidden = false; $('contactName').focus(); });
    $('openRecipientsBtn').addEventListener('click', () => { $('recipientsModal').hidden = false; renderContacts(); });
    $('closeRecipientsBtn').addEventListener('click', () => { $('recipientsModal').hidden = true; });
    $('saveRecipientsBtn').addEventListener('click', () => { $('recipientsModal').hidden = true; renderContacts(); });
    $('addContactBtn').addEventListener('click', () => { editingContactIndex = null; $('contactForm').reset(); $('contactForm').hidden = false; $('contactName').focus(); });
    $('cancelContactBtn').addEventListener('click', () => { editingContactIndex = null; $('contactForm').reset(); $('contactForm').hidden = true; });
    $('greetingInput').value = settings.greeting || '';
    $('greetingInput').addEventListener('input', () => { settings.greeting = $('greetingInput').value; saveSettings(); updatePreview(); });
    $('subjectInput').addEventListener('input', () => { settings.subject = $('subjectInput').value; saveSettings(); });
    const copyRichBody = async () => {
        const html = richBody();
        if (navigator.clipboard?.write && window.ClipboardItem) {
            await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([body()], { type: 'text/plain' }) })]);
            return;
        }
        const copySurface = document.createElement('div');
        copySurface.contentEditable = 'true';
        copySurface.setAttribute('aria-hidden', 'true');
        copySurface.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;background:#fff;';
        copySurface.innerHTML = html;
        document.body.appendChild(copySurface);
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(copySurface);
        selection.removeAllRanges();
        selection.addRange(range);
        const copied = document.execCommand('copy');
        selection.removeAllRanges();
        copySurface.remove();
        if (!copied) throw new Error('El navegador no permitio copiar la tabla');
    };
    $('openGmailBtn').addEventListener('click', async () => { const selected = contacts.filter((contact) => contact.selected); if (!selected.length) { $('mailStatus').textContent = 'Selecciona al menos un correo.'; return; } const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(selected.map((contact) => contact.email).join(','))}&su=${encodeURIComponent($('subjectInput').value)}`; const gmailWindow = window.open('about:blank', '_blank'); try { await copyRichBody(); if (gmailWindow) gmailWindow.location.href = url; $('mailStatus').textContent = 'Tabla copiada. Pegala en el cuerpo del correo de Gmail.'; } catch (error) { if (gmailWindow) gmailWindow.location.href = url; $('mailStatus').textContent = 'Gmail se abrio. Puedes pegar la tabla en el mensaje.'; } });
    $('mailVehicleLabel').textContent = `${fields.marca || '-'} ${fields.linea || '-'} / ${fields.placa || '-'}`;
    renderContacts(); updatePreview(); if (!contacts.length) { $('recipientsModal').hidden = false; $('contactForm').hidden = false; $('contactName').focus(); }
})();
