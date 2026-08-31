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
    const newQuoteWarningModal = document.getElementById('newQuoteWarningModal');
    const cancelNewQuoteBtn = document.getElementById('cancelNewQuoteBtn');
    const confirmNewQuoteBtn = document.getElementById('confirmNewQuoteBtn');
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

    // Gestión del estado centralizada mediante AppStorage (storage.js)
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
            naItems: Array.isArray(currentState.naItems) ? currentState.naItems.filter((id) => quoteItems.some((item) => item.id === id)) : [],
            photosDownloaded: currentState.photosDownloaded || false,
            emailOpened: currentState.emailOpened || false,
            photosDownloadedFor: currentState.photosDownloadedFor === placaInput.value.trim().toUpperCase()
                ? currentState.photosDownloadedFor
                : ''
        };
        storage.saveState(state);
        const placaParam = encodeURIComponent(placaInput.value.trim().toUpperCase());
        const marcaParam = encodeURIComponent(marcaInput.value.trim());
        if (photosLink) photosLink.href = `fotos.html?placa=${placaParam}&marca=${marcaParam}`;
    };

    const getToday = () => {
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${today.getFullYear()}-${month}-${day}`;
    };

    const updateQuoteCard = () => {
        const hasQuote = placaInput.value.trim();
        quoteSummary.hidden = !hasQuote;
        if (!hasQuote) return;
        const values = {
            quotePlaca: placaInput.value,
            quoteMarca: marcaInput.value,
            quoteLinea: lineaInput.value,
            quoteModelo: modeloInput.value,
            quoteColor: colorInput.value,
            quoteTipoCliente: tipoClienteInput.value,
            quoteCilindraje: cilindrajeInput.value,
            quoteVin: vinInput.value,
            quoteDateDisplay: fechaInput.value
        };
        Object.entries(values).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value || '-';
        });
        const cilDetail = document.getElementById('quoteCilindrajeDetail');
        const vinDetail = document.getElementById('quoteVinDetail');
        if (cilDetail) cilDetail.hidden = cilindrajeInput.disabled;
        if (vinDetail) vinDetail.hidden = vinInput.disabled;
    };

    const openQuoteModal = (isEditing = false) => {
        quoteModal.hidden = false;
        quoteTitle.textContent = isEditing ? 'EDITAR COTIZACION' : 'NUEVA COTIZACION';
        quoteSubmitBtn.textContent = isEditing ? 'Guardar cambios' : 'Crear cotización';
        toggleFields();
        placaInput.focus();
    };

    const closeQuoteModal = () => {
        quoteModal.hidden = true;
        updateQuoteCard();
    };

    const renderTable = () => {
        itemsTableBody.innerHTML = '';
        updatePartSuggestions(descripInput.value);

        quoteItems.forEach((item, index) => {
            const newRow = itemsTableBody.insertRow();
            newRow.dataset.index = index; 
            newRow.draggable = true;

            newRow.addEventListener('dragstart', handleDragStart);
            newRow.addEventListener('dragover', handleDragOver);
            newRow.addEventListener('dragleave', handleDragLeave);
            newRow.addEventListener('drop', handleDrop);
            newRow.addEventListener('dragend', handleDragEnd);

            newRow.addEventListener('touchstart', handleTouchStart);
            newRow.addEventListener('touchmove', handleTouchMove);
            newRow.addEventListener('touchend', handleTouchEnd);
            newRow.addEventListener('touchcancel', handleTouchEnd); 

            newRow.insertCell().textContent = item.descrip;
            newRow.insertCell().textContent = item.cant;
            newRow.insertCell().textContent = item.estado;
            newRow.insertCell().textContent = item.pint;

            const actionsCell = newRow.insertCell();
            actionsCell.classList.add('action-cell');
            const editButton = document.createElement('button');
            editButton.innerHTML = '✏️';
            editButton.classList.add('action-btn');
            editButton.classList.add('edit-btn');
            editButton.title = 'Editar ítem';
            editButton.addEventListener('click', () => {
                descripInput.value = item.descrip;
                cantInput.value = item.cant;
                const dymSel = document.getElementById('dym');
                const estSel = document.getElementById('estado');
                const pinSel = document.getElementById('pint');
                if (dymSel) dymSel.value = item.dym || '';
                if (estSel) estSel.value = item.estado || '';
                if (pinSel) pinSel.value = item.pint || '';
                datInput.value = item.dat || '';
                editingItem = item;
                addItemButton.textContent = 'Actualizar';
                descripInput.focus();
            });
            actionsCell.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '🗑';
            deleteButton.classList.add('action-btn');
            deleteButton.classList.add('delete-btn');
            deleteButton.title = 'Eliminar ítem';
            deleteButton.addEventListener('click', () => {
                itemPendingDelete = index;
                deleteItemModal.hidden = false;
            });
            actionsCell.appendChild(deleteButton);
        });

        saveState();
    };

    const updatePartSuggestions = (filter = '') => {
        if (!repuestosList) return;
        const query = filter.trim().toLowerCase();
        const descriptions = [...new Set(quoteItems.map((item) => item.descrip).filter(Boolean))]
            .filter((description) => description.toLowerCase().includes(query));
        repuestosList.innerHTML = '';
        descriptions.forEach((description) => {
            const option = document.createElement('option');
            option.value = description;
            repuestosList.appendChild(option);
        });
    };

    const loadState = () => {
        const state = storage.getState();
        const userName = storage.getUserName();

        if (!userName) {
            userModal.hidden = false;
            nombreCompletoInput.focus();
            return;
        }

        try {
            isLoading = true;
            if (state.fields) {
                fechaInput.value = state.fields.fecha || '';
                placaInput.value = state.fields.placa || '';
                marcaInput.value = state.fields.marca || '';
                lineaInput.value = state.fields.linea || '';
                modeloInput.value = state.fields.modelo || '';
                colorInput.value = state.fields.color || '';
                tipoClienteInput.value = state.fields.tipoCliente || '';
                cilindrajeInput.value = state.fields.cilindraje || '';
                vinInput.value = state.fields.vin || '';
            }
            quoteItems = (Array.isArray(state.quoteItems) ? state.quoteItems : []).map((item) => (item && item.id ? item : { ...item, id: storage.makeId() }));
            renderTable();
        } catch (error) {
            console.warn('Error loadState:', error);
        } finally {
            isLoading = false;
        }

        saveState();
        updateQuoteCard();
        if (!placaInput.value.trim()) {
            openQuoteModal();
        }
    };

    const watchedFields = [fechaInput, placaInput, marcaInput, lineaInput, modeloInput, colorInput, tipoClienteInput, cilindrajeInput, vinInput];

    watchedFields.forEach((field) => {
        if (field) {
            field.addEventListener('input', saveState);
            if (field.id !== 'modelo' && field.id !== 'cilindraje') {
                field.addEventListener('blur', () => {
                    field.value = field.value.toUpperCase();
                    saveState();
                    updateQuoteCard();
                });
            }
        }
    });

    descripInput.addEventListener('input', () => updatePartSuggestions(descripInput.value));

    userForm.addEventListener('submit', (event) => {
        event.preventDefault();
        storage.setUserName(nombreCompletoInput.value.trim());
        userModal.hidden = true;
        if (!placaInput.value.trim()) openQuoteModal();
    });

    if (cancelQuoteBtn) {
        cancelQuoteBtn.addEventListener('click', async () => {
            const state = storage.getState();
            // Si el usuario cancela una cotización que aún no tiene placa (recién creada)
            if (!state.fields.placa) {
                const currentId = storage.getActiveQuoteId();
                await storage.deleteQuote(currentId);
            }
            window.location.href = 'dashboard.html';
        });
    }

    editQuoteBtn.addEventListener('click', () => openQuoteModal(true));

    quoteForm.addEventListener('submit', (event) => {
        event.preventDefault();
        fechaInput.value = getToday();
        saveState();
        updateQuoteCard();
        closeQuoteModal();
        window.location.href = 'generales.html';
    });

    const resetFormFields = () => {
        watchedFields.forEach(f => { if(f) f.value = ''; });
        descripInput.value = '';
        cantInput.value = '';
        datInput.value = '';
    };

    confirmDeleteItemBtn.addEventListener('click', () => {
        if (itemPendingDelete === null) return;
        quoteItems.splice(itemPendingDelete, 1);
        itemPendingDelete = null;
        deleteItemModal.hidden = true;
        renderTable();
    });

    cancelDeleteItemBtn.addEventListener('click', () => { itemPendingDelete = null; deleteItemModal.hidden = true; });

    const toggleFields = () => {
        const marcaValue = marcaInput.value.trim().toLowerCase();
        const isSpec = (marcaValue === 'suzuki' || marcaValue === 'citroen');
        cilindrajeInput.disabled = !isSpec;
        vinInput.disabled = !isSpec;
        document.getElementById('cilindrajeField').hidden = !isSpec;
        document.getElementById('vinField').hidden = !isSpec;
        updateQuoteCard();
    };

    marcaInput.addEventListener('input', toggleFields);

    // --- Drag & Drop ---
    let draggedRow = null;
    function handleDragStart() { draggedRow = this; this.classList.add('dragging'); }
    function handleDragOver(e) { e.preventDefault(); this.classList.add('drop-target'); }
    function handleDragLeave() { this.classList.remove('drop-target'); }
    function handleDrop(e) {
        e.preventDefault();
        this.classList.remove('drop-target');
        if (this === draggedRow) return;
        const fromIdx = parseInt(draggedRow.dataset.index);
        const toIdx = parseInt(this.dataset.index);
        const [item] = quoteItems.splice(fromIdx, 1);
        quoteItems.splice(toIdx, 0, item);
        renderTable();
    }
    function handleDragEnd() { this.classList.remove('dragging'); }

    // --- Touch ---
    let longPressTimer = null;
    let isTouchDragging = false;
    function handleTouchStart(e) {
        draggedRow = this;
        longPressTimer = setTimeout(() => {
            isTouchDragging = true;
            this.classList.add('dragging');
            if (navigator.vibrate) navigator.vibrate(50);
        }, 400);
    }
    function handleTouchMove(e) {
        if (!isTouchDragging) { clearTimeout(longPressTimer); return; }
        e.preventDefault();
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('tr');
        if (target && target !== draggedRow && target.closest('tbody')) {
            document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
            target.classList.add('drop-target');
        }
    }
    function handleTouchEnd() {
        clearTimeout(longPressTimer);
        if (isTouchDragging) {
            const target = document.querySelector('.drop-target');
            if (target) {
                const fromIdx = parseInt(draggedRow.dataset.index);
                const toIdx = parseInt(target.dataset.index);
                const [item] = quoteItems.splice(fromIdx, 1);
                quoteItems.splice(toIdx, 0, item);
                renderTable();
            }
        }
        isTouchDragging = false;
        if (draggedRow) draggedRow.classList.remove('dragging');
        document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    }

    addItemButton.addEventListener('click', () => {
        const descrip = descripInput.value.trim();
        if (!descrip) { showAlert('La descripción es obligatoria.'); return; }
        const newItem = {
            id: editingItem ? editingItem.id : storage.makeId(),
            descrip,
            cant: cantInput.value.trim(),
            dym: document.getElementById('dym').value,
            estado: document.getElementById('estado').value,
            pint: document.getElementById('pint').value,
            dat: datInput.value.trim()
        };
        if (editingItem) {
            const idx = quoteItems.findIndex(i => i.id === editingItem.id);
            if (idx !== -1) quoteItems[idx] = newItem;
            editingItem = null;
            addItemButton.textContent = 'Agregar';
        } else {
            quoteItems.push(newItem);
        }
        renderTable();
        descripInput.value = ''; cantInput.value = ''; datInput.value = ''; descripInput.focus();
    });

    loadState();

    window.CoticarVoice = {
        register(item) {
            if (!item || !item.descrip) return false;
            quoteItems.push({ ...item, id: storage.makeId() });
            renderTable();
            return true;
        },
        removeLast() {
            if (quoteItems.length) { quoteItems.pop(); renderTable(); return true; }
            return false;
        },
        getItemsCount() { return quoteItems.length; }
    };
});
