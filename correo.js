(() => {
    'use strict';
    const storage = window.AppStorage;
    const $ = (id) => document.getElementById(id);

    let state, fields, contacts, groups, settings, orderedItems;
    let editingContactIndex = null;
    let editingGroupIndex = null;

    const refreshLocalData = () => {
        state = storage.getState();
        fields = state.fields || {};
        contacts = storage.getContacts();
        groups = storage.getGroups();
        settings = storage.getSettings();
        const items = Array.isArray(state.quoteItems) ? state.quoteItems : [];
        const statusOrder = { CAMBIO: 0, RECUPERACION: 1, FUERTE: 2, MEDIO: 3, LEVE: 4 };

        orderedItems = items
            .map((item, index) => ({ item, index }))
            .sort((a, b) => {
                const orderA = statusOrder[String(a.item.estado || '').trim().toUpperCase()] ?? 5;
                const orderB = statusOrder[String(b.item.estado || '').trim().toUpperCase()] ?? 5;
                return orderA - orderB || a.index - b.index;
            })
            .map(({ item }) => item);
    };

    const getSubjectText = () => {
        refreshLocalData();
        return `COTIZACION ${fields.marca || ''} ${fields.placa || ''} ${fields.linea || ''} ${fields.tipoCliente || ''}`.replace(/\s+/g, ' ').trim();
    };

    const escapeHtml = (v) => String(v || '-').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const richBody = () => {
        refreshLocalData();
        const rows = orderedItems.length ? orderedItems.map((item, index) => {
            const isChange = String(item.estado || '').trim().toUpperCase() === 'CAMBIO';
            const color = isChange ? '#ff0000' : '#000000';
            return `<tr style="color:${color};"><td>${index + 1}</td><td>${escapeHtml(item.descrip)}</td><td>${escapeHtml(item.cant)}</td><td>${escapeHtml(item.dym)}</td><td>${escapeHtml(item.estado)}</td><td>${escapeHtml(item.pint)}</td><td>${escapeHtml(item.dat)}</td></tr>`;
        }).join('') : '<tr><td colspan="7">No hay repuestos registrados.</td></tr>';

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

    const renderContacts = () => {
        const list = $('contactsList');
        if (!list) return;
        list.innerHTML = '';
        contacts.forEach((contact, index) => {
            const row = document.createElement('div');
            row.className = 'contact-row';
            row.innerHTML = `
                <span style="flex:1;"><strong>${contact.name}</strong><br><small>${contact.email}</small></span>
                <button type="button" class="contact-action edit-contact" data-index="${index}">Editar</button>
                <button type="button" class="contact-action delete-contact" data-index="${index}" style="background:#fff0f2;color:#b52d40;">Borrar</button>
            `;
            list.appendChild(row);
        });
    };

    const renderGroups = () => {
        const list = $('groupsList');
        if (!list) return;
        list.innerHTML = '';
        groups.forEach((group, index) => {
            const row = document.createElement('div');
            row.className = 'contact-row';
            row.innerHTML = `
                <span style="flex:1;"><strong>${group.name}</strong><br><small>${group.emails.length} correos</small></span>
                <button type="button" class="contact-action edit-group" data-index="${index}">Editar</button>
                <button type="button" class="contact-action delete-group" data-index="${index}" style="background:#fff0f2;color:#b52d40;">Borrar</button>
            `;
            list.appendChild(row);
        });
    };

    const updateGroupSelector = () => {
        const selector = $('groupSelector');
        if (!selector) return;
        const currentVal = selector.value;
        selector.innerHTML = '<option value="">Selecciona un grupo...</option>';
        groups.forEach((group, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = group.name;
            selector.appendChild(opt);
        });
        selector.value = currentVal;
    };

    const renderGroupContactsSelector = (selectedEmails = []) => {
        const list = $('groupContactsList');
        if (!list) return;
        list.innerHTML = '';
        if (contacts.length === 0) {
            list.innerHTML = '<p class="muted">No hay contactos registrados.</p>';
            return;
        }
        contacts.forEach(contact => {
            const label = document.createElement('label');
            const isChecked = selectedEmails.includes(contact.email);
            label.innerHTML = `<input type="checkbox" value="${contact.email}" ${isChecked ? 'checked' : ''}> ${contact.name} (${contact.email})`;
            list.appendChild(label);
        });
    };

    const updatePreview = () => {
        refreshLocalData();
        const subInput = $('subjectInput');
        if (subInput) subInput.value = getSubjectText();

        const label = $('mailVehicleLabel');
        if (label) label.textContent = `${fields.marca || '-'} ${fields.linea || '-'} / ${fields.placa || '-'}`;

        const prevGreeting = $('mailPreviewGreeting');
        if (prevGreeting) prevGreeting.textContent = $('greetingInput').value.trim() || 'Cordial saludo,';

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
        refreshLocalData();

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

        $('openRecipientsBtn')?.addEventListener('click', () => {
            $('recipientsModal').hidden = false;
            renderContacts();
            renderGroups();
        });

        $('closeRecipientsBtn')?.addEventListener('click', () => {
            $('recipientsModal').hidden = true;
            updateGroupSelector();
        });

        $('saveRecipientsBtn')?.addEventListener('click', () => {
            $('recipientsModal').hidden = true;
            updateGroupSelector();
        });

        $('tabContacts')?.addEventListener('click', () => {
            $('contactsSection').hidden = false;
            $('groupsSection').hidden = true;
            $('tabContacts').className = 'button primary';
            $('tabGroups').className = 'button secondary';
        });

        $('tabGroups')?.addEventListener('click', () => {
            $('contactsSection').hidden = true;
            $('groupsSection').hidden = false;
            $('tabGroups').className = 'button primary';
            $('tabContacts').className = 'button secondary';
            renderGroupContactsSelector();
        });

        $('addContactBtn')?.addEventListener('click', () => {
            editingContactIndex = null;
            $('contactForm').reset();
            $('contactForm').hidden = false;
        });

        $('cancelContactBtn')?.addEventListener('click', () => {
            $('contactForm').hidden = true;
        });

        $('contactForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = $('contactName').value.trim();
            const email = $('contactEmail').value.trim().toLowerCase();

            if (editingContactIndex === null) {
                contacts.push({ name, email });
            } else {
                contacts[editingContactIndex] = { name, email };
            }

            storage.saveContacts(contacts);
            renderContacts();
            $('contactForm').hidden = true;
            $('contactStatus').textContent = 'Contacto guardado.';
            setTimeout(() => { $('contactStatus').textContent = ''; }, 2000);
        });

        $('contactsList')?.addEventListener('click', (e) => {
            if (!e.target.classList.contains('contact-action')) return;
            const index = parseInt(e.target.dataset.index);

            if (e.target.classList.contains('delete-contact')) {
                contacts.splice(index, 1);
                storage.saveContacts(contacts);
                renderContacts();
            } else if (e.target.classList.contains('edit-contact')) {
                editingContactIndex = index;
                $('contactName').value = contacts[index].name;
                $('contactEmail').value = contacts[index].email;
                $('contactForm').hidden = false;
            }
        });

        $('addGroupBtn')?.addEventListener('click', () => {
            editingGroupIndex = null;
            $('groupForm').reset();
            $('groupForm').hidden = false;
            renderGroupContactsSelector();
        });

        $('cancelGroupBtn')?.addEventListener('click', () => {
            $('groupForm').hidden = true;
        });

        $('groupForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = $('groupName').value.trim();
            const selectedEmails = Array.from($('groupContactsList').querySelectorAll('input:checked')).map(cb => cb.value);

            if (selectedEmails.length === 0) {
                alert('Selecciona al menos un contacto.');
                return;
            }

            if (editingGroupIndex === null) {
                groups.push({ name, emails: selectedEmails });
            } else {
                groups[editingGroupIndex] = { name, emails: selectedEmails };
            }

            storage.saveGroups(groups);
            renderGroups();
            $('groupForm').hidden = true;
            $('contactStatus').textContent = 'Grupo guardado.';
            setTimeout(() => { $('contactStatus').textContent = ''; }, 2000);
        });

        $('groupsList')?.addEventListener('click', (e) => {
            if (!e.target.classList.contains('contact-action')) return;
            const index = parseInt(e.target.dataset.index);

            if (e.target.classList.contains('delete-group')) {
                groups.splice(index, 1);
                storage.saveGroups(groups);
                renderGroups();
            } else if (e.target.classList.contains('edit-group')) {
                editingGroupIndex = index;
                $('groupName').value = groups[index].name;
                $('groupForm').hidden = false;
                renderGroupContactsSelector(groups[index].emails);
            }
        });

        $('groupSelector')?.addEventListener('change', (e) => {
            const idx = e.target.value;
            if (idx === "") { $('groupRecipients').textContent = ""; return; }
            const group = groups[idx];
            if (group) $('groupRecipients').textContent = "Enviar a: " + group.emails.join(", ");
        });

        $('openGmailBtn')?.addEventListener('click', async () => {
            const groupIdx = $('groupSelector').value;
            if (groupIdx === "") {
                $('alertMessage').textContent = 'Debes elegir un grupo.';
                $('alertModal').hidden = false;
                return;
            }

            const group = groups[groupIdx];
            const recipients = group.emails.join(',');
            const subject = getSubjectText();

            if (!state.photosDownloaded) {
                $('alertMessage').textContent = 'Descarga las fotos primero.';
                $('alertModal').hidden = false;
                return;
            }

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

        $('closeAlertBtn')?.addEventListener('click', () => { $('alertModal').hidden = true; });

        updateGroupSelector();
        updatePreview();
        storage.highlightActiveNav();
    });
})();
