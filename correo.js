(() => {
    'use strict';
    const storage = window.AppStorage;
    const $ = (id) => document.getElementById(id);

    const state = storage.getState();
    const fields = state.fields || {};
    let contacts = storage.getContacts();
    let groups = storage.getGroups();
    let settings = storage.getSettings();
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

    let editingContactIndex = null;
    let editingGroupIndex = null;

    const subject = () => {
        const freshState = storage.getState();
        const f = freshState.fields || {};
        return `COTIZACION ${f.marca || ''} ${f.placa || ''} ${f.linea || ''} ${f.tipoCliente || ''}`.replace(/\s+/g, ' ').trim();
    };
    const fitCell = (value, width) => String(value || '-').replace(/[\r\n]+/g, ' ').slice(0, width).padEnd(width, ' ');

    const partsGrid = () => {
        const columns = [['No.', 4], ['Descripcion', 30], ['Cantidad', 9], ['Estado', 12], ['Pint.', 7], ['Dato', 18]];
        const line = `+${columns.map(([, width]) => '-'.repeat(width + 2)).join('+')}+`;
        const header = `| ${columns.map(([label, width]) => fitCell(label, width)).join(' | ')} |`;
        const rows = orderedItems.map((item, index) => `| ${[index + 1, item.descrip, item.cant, item.estado, item.pint, item.dat].map((value, columnIndex) => fitCell(value, columns[columnIndex][1])).join(' | ')} |`);
        return [line, header, line, ...rows, line].join('\n');
    };

    const escapeHtml = (value) => String(value || '-').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

    const richBody = () => {
        const rows = orderedItems.length ? orderedItems.map((item, index) => {
            const isChange = String(item.estado || '').trim().toUpperCase() === 'CAMBIO';
            const color = isChange ? '#ff0000' : '#000000';
            return `<tr style="color:${color};"><td>${index + 1}</td><td>${escapeHtml(item.descrip)}</td><td>${escapeHtml(item.cant)}</td><td>${escapeHtml(item.dym)}</td><td>${escapeHtml(item.estado)}</td><td>${escapeHtml(item.pint)}</td><td>${escapeHtml(item.dat)}</td></tr>`;
        }).join('') : '<tr><td colspan="7">No hay repuestos registrados.</td></tr>';

        const headerStyle = 'background-color:#c6dcf0;color:#000000;font-weight:700;';
        const tableStyle = 'border-collapse:collapse;border:1px solid #000000;color:#000000;font-family:Arial,sans-serif;font-size:14px;';
        const cellStyle = 'border:1px solid #000000;padding:6px 8px;';

        return `<div style="color:#000000;font-family:Arial,sans-serif;">${escapeHtml($('greetingInput').value.trim() || 'Cordial saludo,').replace(/\n/g, '<br>')}</div><br><div style="color:#000000;font-family:Arial,sans-serif;"><strong>Datos del vehiculo</strong></div><table border="1" cellpadding="6" cellspacing="0" style="${tableStyle}"><tr style="${headerStyle}"><th style="${cellStyle}">Fecha</th><th style="${cellStyle}">Placa</th><th style="${cellStyle}">Marca</th><th style="${cellStyle}">Linea</th><th style="${cellStyle}">Modelo</th><th style="${cellStyle}">Color</th><th style="${cellStyle}">Tipo de cliente</th></tr><tr style="color:#000000;"><td style="${cellStyle}">${escapeHtml(fields.fecha)}</td><td style="${cellStyle}">${escapeHtml(fields.placa)}</td><td style="${cellStyle}">${escapeHtml(fields.marca)}</td><td style="${cellStyle}">${escapeHtml(fields.linea)}</td><td style="${cellStyle}">${escapeHtml(fields.modelo)}</td><td style="${cellStyle}">${escapeHtml(fields.color)}</td><td style="${cellStyle}">${escapeHtml(fields.tipoCliente)}</td></tr></table><br><div style="color:#000000;font-family:Arial,sans-serif;"><strong>Repuestos solicitados</strong></div><table border="1" cellpadding="6" cellspacing="0" style="${tableStyle}"><thead><tr style="${headerStyle}"><th style="${cellStyle}">N°</th><th style="${cellStyle}">DESCRIPCIÓN</th><th style="${cellStyle}">CANT</th><th style="${cellStyle}">DYM</th><th style="${cellStyle}">NIVEL DAÑO</th><th style="${cellStyle}">PINT</th><th style="${cellStyle}">OBSERVACIÓN</th></tr></thead><tbody>${rows}</tbody></table>`;
    };

    const bodyText = () => {
        const grid = orderedItems.length ? partsGrid() : 'No hay repuestos registrados.';
        return `${$('greetingInput').value.trim() || 'Cordial saludo,'}\n\nDatos del vehiculo\nFecha: ${fields.fecha || '-'}\nPlaca: ${fields.placa || '-'}\nMarca: ${fields.marca || '-'}\nLinea: ${fields.linea || '-'}\nModelo: ${fields.modelo || '-'}\nColor: ${fields.color || '-'}\nTipo de cliente: ${fields.tipoCliente || '-'}${fields.cilindraje ? `\nCilindraje: ${fields.cilindraje}` : ''}${fields.vin ? `\nVIN: ${fields.vin}` : ''}\n\nRepuestos solicitados\n${grid}`;
    };

    const saveContacts = () => storage.saveContacts(contacts);
    const saveGroups = () => storage.saveGroups(groups);
    const saveSettings = () => storage.saveSettings(settings);

    const renderContacts = () => {
        const list = $('contactsList');
        if (!list) return;
        list.innerHTML = '';
        contacts.forEach((contact, index) => {
            const row = document.createElement('div'); row.className = 'contact-row';
            row.innerHTML = `<span><strong>${contact.name}</strong><small>${contact.email}</small></span><button type="button" class="contact-action edit-contact" data-index="${index}">Editar</button><button type="button" class="contact-action delete-contact" data-index="${index}">Eliminar</button>`;
            list.appendChild(row);
        });
    };

    const renderGroups = () => {
        const list = $('groupsList');
        if (!list) return;
        list.innerHTML = '';
        groups.forEach((group, index) => {
            const row = document.createElement('div'); row.className = 'contact-row';
            row.innerHTML = `<span><strong>${group.name}</strong><small>${group.emails.length} correos</small></span><button type="button" class="contact-action edit-group" data-index="${index}">Editar</button><button type="button" class="contact-action delete-group" data-index="${index}">Eliminar</button>`;
            list.appendChild(row);
        });
    };

    const updateGroupSelector = () => {
        const selector = $('groupSelector');
        if (!selector) return;
        selector.innerHTML = '<option value="">Selecciona un grupo...</option>';
        groups.forEach((group, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = group.name;
            selector.appendChild(opt);
        });
    };

    const renderGroupContactsSelector = (selectedEmails = []) => {
        const list = $('groupContactsList');
        if (!list) return;
        list.innerHTML = '';
        contacts.forEach(contact => {
            const label = document.createElement('label');
            label.style.display = 'block';
            label.style.marginBottom = '5px';
            const isChecked = selectedEmails.includes(contact.email);
            label.innerHTML = `<input type="checkbox" value="${contact.email}" ${isChecked ? 'checked' : ''}> ${contact.name} (${contact.email})`;
            list.appendChild(label);
        });
    };

    const renderItemsTable = () => {
        const body = $('mailItemsTableBody');
        if (!body) return;
        body.innerHTML = '';
        orderedItems.forEach((item, index) => {
            const row = document.createElement('tr');
            [String(index + 1), item.descrip, item.cant, item.estado, item.pint, item.dat].forEach((value) => {
                const cell = document.createElement('td');
                cell.textContent = value || '-';
                row.appendChild(cell);
            });
            body.appendChild(row);
        });
    };

    const renderVehiclePreview = () => {
        const greeting = $('mailPreviewGreeting');
        if (greeting) greeting.textContent = $('greetingInput').value.trim() || 'Cordial saludo,';
        const wrap = $('mailVehicleTableWrap');
        if (!wrap) return;
        const table = document.createElement('table');
        table.className = 'mail-vehicle-table';
        const fieldsToShow = [['Fecha', fields.fecha], ['Placa', fields.placa], ['Marca', fields.marca], ['Linea', fields.linea], ['Modelo', fields.modelo], ['Color', fields.color], ['Tipo de cliente', fields.tipoCliente]];
        const header = document.createElement('tr');
        fieldsToShow.forEach(([label]) => { const cell = document.createElement('th'); cell.textContent = label; header.appendChild(cell); });
        const values = document.createElement('tr');
        fieldsToShow.forEach(([, value]) => { const cell = document.createElement('td'); cell.textContent = value || '-'; values.appendChild(cell); });
        table.append(header, values);
        wrap.replaceChildren(table);
    };

    const updatePreview = () => {
        const sub = $('subjectInput');
        if (sub) sub.value = subject();
        renderVehiclePreview();
        renderItemsTable();
    };

    const copyRichBody = async () => {
        const html = richBody();
        if (navigator.clipboard?.write && window.ClipboardItem) {
            await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([bodyText()], { type: 'text/plain' }) })]);
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

    // Event Listeners
    document.addEventListener('DOMContentLoaded', () => {
        $('greetingInput').value = settings.greeting || '';
        $('greetingInput').addEventListener('input', () => { settings.greeting = $('greetingInput').value; saveSettings(); updatePreview(); });

        $('openRecipientsBtn').addEventListener('click', () => { $('recipientsModal').hidden = false; renderContacts(); renderGroups(); });
        $('closeRecipientsBtn').addEventListener('click', () => { $('recipientsModal').hidden = true; updateGroupSelector(); });
        $('saveRecipientsBtn').addEventListener('click', () => { $('recipientsModal').hidden = true; updateGroupSelector(); });

        // Tabs
        $('tabContacts').addEventListener('click', () => {
            $('contactsSection').hidden = false; $('groupsSection').hidden = true;
            $('tabContacts').className = 'button primary'; $('tabGroups').className = 'button secondary';
        });
        $('tabGroups').addEventListener('click', () => {
            $('contactsSection').hidden = true; $('groupsSection').hidden = false;
            $('tabGroups').className = 'button primary'; $('tabContacts').className = 'button secondary';
            renderGroupContactsSelector();
        });

        // Gestión de Contactos
        $('addContactBtn').addEventListener('click', () => { editingContactIndex = null; $('contactForm').reset(); $('contactForm').hidden = false; });
        $('cancelContactBtn').addEventListener('click', () => { $('contactForm').hidden = true; });
        $('contactForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = $('contactName').value.trim();
            const email = $('contactEmail').value.trim().toLowerCase();
            if (editingContactIndex === null) contacts.push({ name, email });
            else contacts[editingContactIndex] = { name, email };
            saveContacts(); renderContacts(); $('contactForm').hidden = true;
        });
        $('contactsList').addEventListener('click', (e) => {
            const btn = e.target;
            const index = Number(btn.dataset.index);
            if (btn.classList.contains('delete-contact')) { contacts.splice(index, 1); saveContacts(); renderContacts(); }
            if (btn.classList.contains('edit-contact')) {
                editingContactIndex = index;
                $('contactName').value = contacts[index].name;
                $('contactEmail').value = contacts[index].email;
                $('contactForm').hidden = false;
            }
        });

        // Gestión de Grupos
        $('addGroupBtn').addEventListener('click', () => { editingGroupIndex = null; $('groupForm').reset(); $('groupForm').hidden = false; renderGroupContactsSelector(); });
        $('cancelGroupBtn').addEventListener('click', () => { $('groupForm').hidden = true; });
        $('groupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = $('groupName').value.trim();
            const selectedEmails = Array.from($('groupContactsList').querySelectorAll('input:checked')).map(cb => cb.value);
            if (selectedEmails.length === 0) { alert('Selecciona al menos un contacto para el grupo.'); return; }
            if (editingGroupIndex === null) groups.push({ name, emails: selectedEmails });
            else groups[editingGroupIndex] = { name, emails: selectedEmails };
            saveGroups(); renderGroups(); $('groupForm').hidden = true;
        });
        $('groupsList').addEventListener('click', (e) => {
            const btn = e.target;
            const index = Number(btn.dataset.index);
            if (btn.classList.contains('delete-group')) { groups.splice(index, 1); saveGroups(); renderGroups(); }
            if (btn.classList.contains('edit-group')) {
                editingGroupIndex = index;
                $('groupName').value = groups[index].name;
                $('groupForm').hidden = false;
                renderGroupContactsSelector(groups[index].emails);
            }
        });

        // Selector de Grupo Principal
        $('groupSelector').addEventListener('change', (e) => {
            const groupIndex = e.target.value;
            if (groupIndex === "") { $('groupRecipients').textContent = ""; return; }
            const group = groups[groupIndex];
            $('groupRecipients').textContent = "Enviar a: " + group.emails.join(", ");
        });

        // Enviar Correo
        $('openGmailBtn').addEventListener('click', async () => {
            const groupIndex = $('groupSelector').value;
            if (groupIndex === "") {
                const alertModal = $('alertModal');
                $('alertMessage').textContent = 'Debes elegir a qué grupo enviar el correo antes de continuar.';
                alertModal.hidden = false;
                return;
            }

            const group = groups[groupIndex];
            const recipients = group.emails.join(',');
            const subjectValue = subject();

            const currentState = storage.getState();
            if (!currentState.photosDownloaded) {
                $('alertMessage').textContent = 'No puedes abrir el correo sin antes haber descargado las imágenes del vehículo.';
                $('alertModal').hidden = false;
                return;
            }

            let copied = true;
            try { await copyRichBody(); } catch (error) { copied = false; }
            storage.setEmailOpened(true);

            const webUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipients)}&su=${encodeURIComponent(subjectValue)}`;
            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

            if (isMobile) {
                const composeQuery = `to=${encodeURIComponent(recipients)}&subject=${encodeURIComponent(subjectValue)}`;
                const gmailAppUrl = /Android/i.test(navigator.userAgent)
                    ? `intent://compose?${composeQuery}#Intent;scheme=mailto;package=com.google.android.gm;end`
                    : `googlegmail://co?${composeQuery}`;
                window.location.href = gmailAppUrl;
                setTimeout(() => { if (document.visibilityState === 'visible') window.location.href = webUrl; }, 1200);
            } else {
                window.open(webUrl, '_blank') || (window.location.href = webUrl);
            }
            $('mailStatus').textContent = copied ? 'Tabla copiada. Pegala en Gmail.' : 'Gmail abierto. Copia la tabla manualmente.';
        });

        $('closeAlertBtn').addEventListener('click', () => $('alertModal').hidden = true);

        $('mailVehicleLabel').textContent = `${fields.marca || '-'} ${fields.linea || '-'} / ${fields.placa || '-'}`;
        updateGroupSelector();
        updatePreview();
        storage.highlightActiveNav();
    });
})();
