(() => {
    'use strict';
    const storage = window.AppStorage;
    const $ = (id) => document.getElementById(id);

    let contacts = [];
    let groups = [];
    let editingContactIndex = null;
    let editingGroupIndex = null;

    const refreshData = () => {
        contacts = storage.getContacts();
        groups = storage.getGroups();
    };

    const getSubjectText = () => {
        const state = storage.getState();
        const f = state.fields || {};
        return `COTIZACION ${f.marca || ''} ${f.placa || ''} ${f.linea || ''} ${f.tipoCliente || ''}`.replace(/\s+/g, ' ').trim();
    };

    const escapeHtml = (v) => String(v || '-').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const richBody = () => {
        const state = storage.getState();
        const fields = state.fields || {};
        const items = state.quoteItems || [];
        const statusOrder = { CAMBIO: 0, RECUPERACION: 1, FUERTE: 2, MEDIO: 3, LEVE: 4 };

        const ordered = [...items].sort((a, b) => {
            const oa = statusOrder[String(a.estado || '').trim().toUpperCase()] ?? 5;
            const ob = statusOrder[String(b.estado || '').trim().toUpperCase()] ?? 5;
            return oa - ob;
        });

        const rows = ordered.length ? ordered.map((item, index) => {
            const isChange = String(item.estado || '').trim().toUpperCase() === 'CAMBIO';
            const color = isChange ? '#ff0000' : '#000000';
            return `<tr style="color:${color};"><td>${index + 1}</td><td>${escapeHtml(item.descrip)}</td><td>${escapeHtml(item.cant)}</td><td>${escapeHtml(item.dym)}</td><td>${escapeHtml(item.estado)}</td><td>${escapeHtml(item.pint)}</td><td>${escapeHtml(item.dat)}</td></tr>`;
        }).join('') : '<tr><td colspan="7">No hay repuestos registrados.</td></tr>';

        const cellStyle = 'border:1px solid #000;padding:6px;';

        return `<div style="font-family:Arial,sans-serif;">${escapeHtml(storage.getSettings().greeting || 'Cordial saludo,').replace(/\n/g, '<br>')}</div><br>
                <strong>Datos del vehiculo</strong><br>
                <table border="1" cellspacing="0" style="border-collapse:collapse;width:100%;">
                    <tr style="background:#c6dcf0;"><th style="${cellStyle}">Fecha</th><th style="${cellStyle}">Placa</th><th style="${cellStyle}">Marca</th><th style="${cellStyle}">Linea</th></tr>
                    <tr><td style="${cellStyle}">${escapeHtml(fields.fecha)}</td><td style="${cellStyle}">${escapeHtml(fields.placa)}</td><td style="${cellStyle}">${escapeHtml(fields.marca)}</td><td style="${cellStyle}">${escapeHtml(fields.linea)}</td></tr>
                </table><br>
                <strong>Repuestos solicitados</strong><br>
                <table border="1" cellspacing="0" style="border-collapse:collapse;width:100%;">
                    <thead><tr style="background:#c6dcf0;"><th style="${cellStyle}">N°</th><th style="${cellStyle}">DESCRIPCIÓN</th><th style="${cellStyle}">CANT</th><th style="${cellStyle}">DYM</th><th style="${cellStyle}">DAÑO</th><th style="${cellStyle}">PINT</th><th style="${cellStyle}">OBS</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>`;
    };

    const updatePreview = () => {
        const state = storage.getState();
        const f = state.fields || {};

        const subInput = $('subjectInput');
        if (subInput) subInput.value = getSubjectText();

        const label = $('mailVehicleLabel');
        if (label) label.textContent = `${f.marca || '-'} ${f.linea || '-'} / ${f.placa || '-'}`;

        const body = $('mailItemsTableBody');
        if (body) {
            body.innerHTML = '';
            const items = state.quoteItems || [];
            items.forEach((item, index) => {
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

    const renderContacts = () => {
        const list = $('contactsList');
        if (!list) return;
        list.innerHTML = '';
        contacts.forEach((contact, index) => {
            const row = document.createElement('div');
            row.className = 'contact-row';
            row.innerHTML = `
                <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;"><strong>${contact.name}</strong><br><small>${contact.email}</small></span>
                <button type="button" class="contact-action edit-contact" data-idx="${index}">Editar</button>
                <button type="button" class="contact-action delete-contact" data-idx="${index}" style="background:#fff0f2;color:#b52d40;">Borrar</button>
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
                <button type="button" class="contact-action edit-group" data-idx="${index}">Editar</button>
                <button type="button" class="contact-action delete-group" data-idx="${index}" style="background:#fff0f2;color:#b52d40;">Borrar</button>
            `;
            list.appendChild(row);
        });
    };

    const renderGroupContactsSelector = (selectedEmails = []) => {
        const list = $('groupContactsList');
        if (!list) return;
        list.innerHTML = contacts.length ? '' : '<p class="muted">No hay contactos.</p>';
        contacts.forEach(c => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${c.email}" ${selectedEmails.includes(c.email) ? 'checked' : ''}> ${c.name}`;
            list.appendChild(label);
        });
    };

    const updateGroupSelector = () => {
        const sel = $('groupSelector');
        if (!sel) return;
        const old = sel.value;
        sel.innerHTML = '<option value="">Selecciona un grupo...</option>';
        groups.forEach((g, i) => {
            const opt = document.createElement('option');
            opt.value = i; opt.textContent = g.name;
            sel.appendChild(opt);
        });
        sel.value = old;
    };

    document.addEventListener('DOMContentLoaded', () => {
        refreshData();
        const set = storage.getSettings();
        if ($('greetingInput')) {
            $('greetingInput').value = set.greeting || 'Cordial saludo,';
            $('greetingInput').oninput = () => { set.greeting = $('greetingInput').value; storage.saveSettings(set); };
        }

        $('openRecipientsBtn').onclick = () => { $('recipientsModal').hidden = false; renderContacts(); renderGroups(); };
        $('closeRecipientsBtn').onclick = () => { $('recipientsModal').hidden = true; updateGroupSelector(); };
        $('saveRecipientsBtn').onclick = () => { $('recipientsModal').hidden = true; updateGroupSelector(); };

        $('tabContacts').onclick = () => {
            $('contactsSection').hidden = false; $('groupsSection').hidden = true;
            $('tabContacts').className = 'primary'; $('tabGroups').className = 'secondary';
        };
        $('tabGroups').onclick = () => {
            $('contactsSection').hidden = true; $('groupsSection').hidden = false;
            $('tabGroups').className = 'primary'; $('tabContacts').className = 'secondary';
            renderGroupContactsSelector();
        };

        $('addContactBtn').onclick = () => { editingContactIndex = null; $('contactForm').reset(); $('contactForm').hidden = false; };
        $('cancelContactBtn').onclick = () => $('contactForm').hidden = true;
        $('contactForm').onsubmit = (e) => {
            e.preventDefault();
            const c = { name: $('contactName').value.trim(), email: $('contactEmail').value.trim().toLowerCase() };
            if (editingContactIndex === null) contacts.push(c); else contacts[editingContactIndex] = c;
            storage.saveContacts(contacts); renderContacts(); $('contactForm').hidden = true;
        };

        $('contactsList').onclick = (e) => {
            const i = e.target.dataset.idx; if (i === undefined) return;
            if (e.target.classList.contains('delete-contact')) { contacts.splice(i, 1); storage.saveContacts(contacts); renderContacts(); }
            if (e.target.classList.contains('edit-contact')) { editingContactIndex = i; $('contactName').value = contacts[i].name; $('contactEmail').value = contacts[i].email; $('contactForm').hidden = false; }
        };

        $('addGroupBtn').onclick = () => { editingGroupIndex = null; $('groupForm').reset(); $('groupForm').hidden = false; renderGroupContactsSelector(); };
        $('cancelGroupBtn').onclick = () => $('groupForm').hidden = true;
        $('groupForm').onsubmit = (e) => {
            e.preventDefault();
            const selected = Array.from($('groupContactsList').querySelectorAll('input:checked')).map(cb => cb.value);
            if (!selected.length) return;
            const g = { name: $('groupName').value.trim(), emails: selected };
            if (editingGroupIndex === null) groups.push(g); else groups[editingGroupIndex] = g;
            storage.saveGroups(groups); renderGroups(); $('groupForm').hidden = true;
        };

        $('groupsList').onclick = (e) => {
            const i = e.target.dataset.idx; if (i === undefined) return;
            if (e.target.classList.contains('delete-group')) { groups.splice(i, 1); storage.saveGroups(groups); renderGroups(); }
            if (e.target.classList.contains('edit-group')) { editingGroupIndex = i; $('groupName').value = groups[i].name; $('groupForm').hidden = false; renderGroupContactsSelector(groups[i].emails); }
        };

        $('openGmailBtn').onclick = async () => {
            const idx = $('groupSelector').value;
            if (idx === "") { $('alertMessage').textContent = 'Elige un grupo.'; $('alertModal').hidden = false; return; }

            const state = storage.getState();
            if (!state.photosDownloaded) { $('alertMessage').textContent = 'Descarga las fotos primero.'; $('alertModal').hidden = false; return; }

            const group = groups[idx];
            const recipients = group.emails.join(',');
            const subject = getSubjectText();

            try {
                const html = richBody();
                const blob = new Blob([html], { type: 'text/html' });
                await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
            } catch (err) { console.error(err); }

            storage.setEmailOpened(true);
            const webUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipients)}&su=${encodeURIComponent(subject)}`;
            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            if (isMobile) {
                const q = `to=${encodeURIComponent(recipients)}&subject=${encodeURIComponent(subject)}`;
                window.location.href = /Android/i.test(navigator.userAgent) ? `intent://compose?${q}#Intent;scheme=mailto;package=com.google.android.gm;end` : `googlegmail://co?${q}`;
                setTimeout(() => { if (document.visibilityState === 'visible') window.location.href = webUrl; }, 1200);
            } else {
                window.open(webUrl, '_blank') || (window.location.href = webUrl);
            }
        };

        $('closeAlertBtn').onclick = () => $('alertModal').hidden = true;
        updateGroupSelector();
        updatePreview();
        storage.highlightActiveNav();
    });
})();
