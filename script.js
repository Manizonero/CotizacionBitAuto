document.addEventListener('DOMContentLoaded', () => {

    const addItemButton = document.getElementById('addItemBtn');
    const itemsTableBody = document.querySelector('#itemsTable tbody');
    const repuestosList = document.getElementById('repuestosList');

    const descripInput = document.getElementById('descrip');
    const cantInput = document.getElementById('cant');
    const dymInput = document.getElementById('dym');
    const estadoInput = document.getElementById('estado');
    const pintInput = document.getElementById('pint');
    const datInput = document.getElementById('dat');
    const fechaInput = document.getElementById('fecha');
    const placaInput = document.getElementById('placa');
    const marcaInput = document.getElementById('marca');
    const lineaInput = document.getElementById('linea');
    const modeloInput = document.getElementById('modelo');
    const colorInput = document.getElementById('color');
    const tipoClienteInput = document.getElementById('tipoCliente');
    const cilindrajeInput = document.getElementById('cilindraje');
    const vinInput = document.getElementById('vin');
    const nombreCompletoInput = document.getElementById('nombreCompleto');
    const userForm = document.getElementById('userForm');
    const userModal = document.getElementById('userModal');
    const quoteForm = document.getElementById('quoteForm');
    const quoteModal = document.getElementById('quoteModal');
    const quoteSummary = document.getElementById('quoteSummary');
    const editQuoteBtn = document.getElementById('editQuoteBtn');
    const quoteTitle = document.getElementById('quote-title');
    const quoteSubmitBtn = document.getElementById('quoteSubmitBtn');
    const cancelQuoteBtn = document.getElementById('cancelQuoteBtn');
    const photosLink = document.getElementById('photosLink');
    const deleteItemModal = document.getElementById('deleteItemModal');
    const cancelDeleteItemBtn = document.getElementById('cancelDeleteItemBtn');
    const confirmDeleteItemBtn = document.getElementById('confirmDeleteItemBtn');
    const alertModal = document.getElementById('alertModal');
    const alertMessage = document.getElementById('alertMessage');
    const closeAlertBtn = document.getElementById('closeAlertBtn');

    const showAlert = (message) => {
        alertMessage.textContent = message;
        alertModal.hidden = false;
    };
    if (closeAlertBtn) closeAlertBtn.addEventListener('click', () => { alertModal.hidden = true; });

    const storage = window.AppStorage;

    let quoteItems = [];
    let isLoading = false;
    let itemPendingDelete = null;
    let editingItem = null;

    const saveState = () => {
        if (isLoading) return;
        const currentState = storage.getState();
        const state = {
            fields: {
                fecha: fechaInput.value.trim(),
                placa: placaInput.value.trim(),
                marca: marcaInput.value.trim(),
                linea: lineaInput.value.trim(),
                modelo: modeloInput.value.trim(),
                color: colorInput.value.trim(),
                tipoCliente: tipoClienteInput.value.trim(),
                cilindraje: cilindrajeInput.value.trim(),
                vin: vinInput.value.trim()
            },
            quoteItems,
            naItems: Array.isArray(currentState.naItems) ? currentState.naItems : [],
            photosDownloaded: currentState.photosDownloaded || false,
            emailOpened: currentState.emailOpened || false,
            photosDownloadedFor: currentState.photosDownloadedFor || ''
        };
        storage.saveState(state);
    };

    const getToday = () => {
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${today.getFullYear()}-${month}-${day}`;
    };

    const toggleFields = () => {
        const marcaValue = marcaInput.value.trim().toLowerCase();
        const isSpec = (marcaValue === 'suzuki' || marcaValue === 'citroen');
        cilindrajeInput.disabled = !isSpec;
        vinInput.disabled = !isSpec;
        const cF = document.getElementById('cilindrajeField');
        const vF = document.getElementById('vinField');
        if (cF) cF.hidden = !isSpec;
        if (vF) vF.hidden = !isSpec;
        const cD = document.getElementById('quoteCilindrajeDetail');
        const vD = document.getElementById('quoteVinDetail');
        if (cD) cD.hidden = !isSpec;
        if (vD) vD.hidden = !isSpec;
    };

    const updateQuoteCard = () => {
        const hasQuote = placaInput.value.trim();
        quoteSummary.hidden = !hasQuote;
        if (!hasQuote) return;
        const values = {
            quotePlaca: placaInput.value, quoteMarca: marcaInput.value, quoteLinea: lineaInput.value,
            quoteModelo: modeloInput.value, quoteColor: colorInput.value, quoteTipoCliente: tipoClienteInput.value,
            quoteCilindraje: cilindrajeInput.value, quoteVin: vinInput.value, quoteDateDisplay: fechaInput.value
        };
        Object.entries(values).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val || '-';
        });
        toggleFields();
    };

    const openQuoteModal = (isEditing = false) => {
        quoteModal.hidden = false;
        quoteTitle.textContent = isEditing ? 'EDITAR COTIZACION' : 'NUEVA COTIZACION';
        quoteSubmitBtn.textContent = isEditing ? 'Guardar cambios' : 'Crear cotización';
        toggleFields();
        placaInput.focus();
    };

    const renderTable = () => {
        itemsTableBody.innerHTML = '';
        quoteItems.forEach((item, index) => {
            const row = itemsTableBody.insertRow();
            row.dataset.index = index; row.draggable = true;
            row.insertCell().textContent = item.descrip;
            row.insertCell().textContent = item.cant;
            row.insertCell().textContent = item.estado;
            row.insertCell().textContent = item.pint;
            const actionsCell = row.insertCell();
            actionsCell.classList.add('action-cell');
            const editBtn = document.createElement('button');
            editBtn.innerHTML = '✏️'; editBtn.className = 'action-btn edit-btn';
            editBtn.onclick = () => {
                descripInput.value = item.descrip; cantInput.value = item.cant;
                document.getElementById('dym').value = item.dym || '';
                document.getElementById('estado').value = item.estado || '';
                document.getElementById('pint').value = item.pint || '';
                datInput.value = item.dat || '';
                editingItem = item; addItemButton.textContent = 'Actualizar'; descripInput.focus();
            };
            const delBtn = document.createElement('button');
            delBtn.innerHTML = '🗑'; delBtn.className = 'action-btn delete-btn';
            delBtn.onclick = () => { itemPendingDelete = index; deleteItemModal.hidden = false; };
            actionsCell.append(editBtn, delBtn);
        });
        saveState();
    };

    const loadState = () => {
        const activeId = storage.getActiveQuoteId();
        if (!activeId) {
            window.location.replace('dashboard.html');
            return;
        }

        const state = storage.getState();
        const userName = storage.getUserName();
        if (!userName) { userModal.hidden = false; nombreCompletoInput.focus(); return; }

        try {
            isLoading = true;
            if (state.fields) {
                fechaInput.value = state.fields.fecha || ''; placaInput.value = state.fields.placa || '';
                marcaInput.value = state.fields.marca || ''; lineaInput.value = state.fields.linea || '';
                modeloInput.value = state.fields.modelo || ''; colorInput.value = state.fields.color || '';
                tipoClienteInput.value = state.fields.tipoCliente || ''; cilindrajeInput.value = state.fields.cilindraje || '';
                vinInput.value = state.fields.vin || '';
            }
            quoteItems = (Array.isArray(state.quoteItems) ? state.quoteItems : []).map(i => (i && i.id ? i : { ...i, id: storage.makeId() }));
            renderTable();
        } finally { isLoading = false; }
        updateQuoteCard();
        if (!placaInput.value.trim()) openQuoteModal();
    };

    const watchedFields = [fechaInput, placaInput, marcaInput, lineaInput, modeloInput, colorInput, tipoClienteInput, cilindrajeInput, vinInput];
    watchedFields.forEach(f => {
        if (f) {
            f.addEventListener('input', saveState);
            if (f.id !== 'modelo' && f.id !== 'cilindraje') {
                f.addEventListener('blur', () => { f.value = f.value.toUpperCase(); saveState(); updateQuoteCard(); });
            }
        }
    });

    userForm.addEventListener('submit', (e) => { e.preventDefault(); storage.setUserName(nombreCompletoInput.value.trim()); userModal.hidden = true; loadState(); });
    editQuoteBtn.addEventListener('click', () => openQuoteModal(true));
    cancelQuoteBtn?.addEventListener('click', async () => {
        const s = storage.getState();
        if (!s.fields.placa) await storage.deleteQuote(storage.getActiveQuoteId());
        window.location.replace('dashboard.html');
    });
    quoteForm.addEventListener('submit', (e) => { e.preventDefault(); fechaInput.value = getToday(); saveState(); updateQuoteCard(); quoteModal.hidden = true; window.location.replace('generales.html'); });
    confirmDeleteItemBtn.onclick = () => { quoteItems.splice(itemPendingDelete, 1); itemPendingDelete = null; deleteItemModal.hidden = true; renderTable(); };
    cancelDeleteItemBtn.onclick = () => { itemPendingDelete = null; deleteItemModal.hidden = true; };
    marcaInput.addEventListener('input', toggleFields);

    addItemButton.addEventListener('click', () => {
        const d = descripInput.value.trim(); if (!d) { showAlert('Descripción obligatoria'); return; }
        const newItem = { id: editingItem ? editingItem.id : storage.makeId(), descrip: d, cant: cantInput.value.trim(), dym: document.getElementById('dym').value, estado: document.getElementById('estado').value, pint: document.getElementById('pint').value, dat: datInput.value.trim() };
        if (editingItem) quoteItems[quoteItems.findIndex(i => i.id === editingItem.id)] = newItem; else quoteItems.push(newItem);
        editingItem = null; addItemButton.textContent = 'Agregar'; renderTable(); descripInput.value = ''; cantInput.value = ''; datInput.value = ''; descripInput.focus();
    });

    loadState();
    storage.highlightActiveNav();

    window.CoticarVoice = {
        register(item) { if (!item.descrip) return false; quoteItems.push({ ...item, id: storage.makeId() }); renderTable(); return true; },
        removeLast() { if (quoteItems.length) { quoteItems.pop(); renderTable(); return true; } return false; },
        getItemsCount() { return quoteItems.length; }
    };
});
