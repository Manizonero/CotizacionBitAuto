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
    const userNameDisplay = document.getElementById('userNameDisplay');
    const quoteForm = document.getElementById('quoteForm');
    const quoteModal = document.getElementById('quoteModal');
    const quoteSummary = document.getElementById('quoteSummary');
    const editQuoteBtn = document.getElementById('editQuoteBtn');
    const quoteTitle = document.getElementById('quote-title');
    const quoteSubmitBtn = document.getElementById('quoteSubmitBtn');
    const newQuoteBtn = document.getElementById('newQuoteBtn');
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

    // Array para almacenar los ítems de la cotización
    let quoteItems = [];
    let isLoading = false;
    let itemPendingDelete = null;

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
                vin: vinInput.value.trim(),
                nombreCompleto: nombreCompletoInput.value.trim()
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

    const clearState = () => {
        storage.clearState();
    };

    const updateUserDisplay = () => {
        const userName = nombreCompletoInput.value.trim();
        userNameDisplay.textContent = userName;
        userNameDisplay.title = userName ? 'Editar usuario' : '';
    };

    const openUserModal = () => {
        userModal.hidden = false;
        nombreCompletoInput.focus();
    };

    const closeUserModal = () => {
        userModal.hidden = true;
        updateUserDisplay();
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
            document.getElementById(id).textContent = value || '-';
        });
        document.getElementById('quoteCilindrajeDetail').hidden = cilindrajeInput.disabled;
        document.getElementById('quoteVinDetail').hidden = vinInput.disabled;
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

    const setSelectValue = (select, value) => {
        const normalizedValue = String(value || '').trim().toUpperCase();
        const option = [...select.options].find((item) => item.value.trim().toUpperCase() === normalizedValue);
        select.value = option ? option.value : '';
    };

    // Función para renderizar la tabla desde el array quoteItems
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

            // Insertar celdas (<td>) en la fila con los datos
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
                setSelectValue(dymInput, item.dym);
                setSelectValue(estadoInput, item.estado);
                setSelectValue(pintInput, item.pint);
                datInput.value = item.dat;
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
        const hasData = state && (state.fields.nombreCompleto || state.fields.placa || (state.quoteItems && state.quoteItems.length > 0));

        if (!hasData) {
            updateUserDisplay();
            openUserModal();
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
                nombreCompletoInput.value = state.fields.nombreCompleto || '';
            }

            quoteItems = (Array.isArray(state.quoteItems) ? state.quoteItems : []).map((item) => (item && item.id ? item : { ...item, id: storage.makeId() }));
            renderTable();
        } catch (error) {
            console.warn('No se pudo cargar el estado guardado:', error);
        } finally {
            isLoading = false;
        }

        saveState();
        updateUserDisplay();
        updateQuoteCard();
        if (!nombreCompletoInput.value.trim()) {
            openUserModal();
        } else if (!placaInput.value.trim()) {
            openQuoteModal();
        }
    };

    const watchedFields = [
        fechaInput,
        placaInput,
        marcaInput,
        lineaInput,
        modeloInput,
        colorInput,
        tipoClienteInput,
        cilindrajeInput,
        vinInput,
        nombreCompletoInput,
    ];

    const uppercaseFields = [placaInput, marcaInput, lineaInput, colorInput, tipoClienteInput];
    const normalizeUppercaseFields = () => {
        uppercaseFields.forEach((field) => {
            if (field) field.value = field.value.toUpperCase();
        });
    };

    uppercaseFields.forEach((field) => {
        if (field) {
            field.addEventListener('input', saveState);
            field.addEventListener('blur', () => {
                field.value = field.value.toUpperCase();
                saveState();
                updateQuoteCard();
            });
        }
    });

    watchedFields.forEach((field) => {
        if (field) {
            field.addEventListener('input', saveState);
        }
    });

    descripInput.addEventListener('input', () => updatePartSuggestions(descripInput.value));

    userForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!userForm.reportValidity()) return;
        saveState();
        closeUserModal();
        if (!placaInput.value.trim()) openQuoteModal();
    });

    userNameDisplay.addEventListener('click', openUserModal);
    editQuoteBtn.addEventListener('click', () => openQuoteModal(true));
    quoteForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!quoteForm.reportValidity()) return;
        normalizeUppercaseFields();
        fechaInput.value = getToday();
        saveState();
        updateQuoteCard();
        closeQuoteModal();
        // Redirigir a Generales después de guardar datos del vehículo
        window.location.href = 'generales.html';
    });

    const resetFormFields = () => {
        fechaInput.value = '';
        placaInput.value = '';
        marcaInput.value = '';
        lineaInput.value = '';
        modeloInput.value = '';
        colorInput.value = '';
        tipoClienteInput.value = '';
        cilindrajeInput.value = '';
        vinInput.value = '';
        updateUserDisplay();
        descripInput.value = '';
        cantInput.value = '';
        dymInput.value = '';
        estadoInput.value = '';
        pintInput.value = '';
        datInput.value = '';
    };

    const handleNewQuote = () => {
        const state = storage.getState();
        if (!state.photosDownloaded) {
            showAlert('No puedes iniciar una nueva cotización sin antes haber descargado las imágenes.');
            return;
        }
        if (!state.emailOpened) {
            showAlert('No puedes iniciar una nueva cotización sin antes haber enviado el correo (abierto Gmail).');
            return;
        }
        newQuoteWarningModal.hidden = false;
    };

    const confirmNewQuote = async () => {
        const currentPlate = placaInput.value.trim().toUpperCase();
        try {
            await storage.deletePhotosByPlate(currentPlate);
        } catch (error) {
            newQuoteWarningModal.hidden = true;
            alert('No se pudieron eliminar las fotos de la placa actual.');
            return;
        }
        newQuoteWarningModal.hidden = true;
        quoteItems = [];
        resetFormFields();
        storage.clearState();
        // Aseguramos que el nuevo estado empiece limpio (flags en false)
        const newState = storage.getInitialState();
        newState.fields.nombreCompleto = nombreCompletoInput.value.trim(); // Preservar nombre del asesor
        storage.saveState(newState);

        renderTable();
        addItemButton.textContent = 'Agregar';
        toggleFields();
        openQuoteModal();
    };

    cancelNewQuoteBtn.addEventListener('click', () => { newQuoteWarningModal.hidden = true; });
    confirmNewQuoteBtn.addEventListener('click', confirmNewQuote);
    cancelDeleteItemBtn.addEventListener('click', () => { itemPendingDelete = null; deleteItemModal.hidden = true; });
    confirmDeleteItemBtn.addEventListener('click', () => {
        if (itemPendingDelete === null) return;
        quoteItems.splice(itemPendingDelete, 1);
        itemPendingDelete = null;
        deleteItemModal.hidden = true;
        renderTable();
    });

    // Lógica para habilitar/deshabilitar campos (Marca, Cilindraje, VIN)
    // Deshabilitar los campos por defecto al cargar la página
    cilindrajeInput.disabled = true;
    vinInput.disabled = true;

    const toggleFields = () => {
        const marcaValue = marcaInput.value.trim().toLowerCase();
        if (marcaValue === 'suzuki' || marcaValue === 'citroen') {
            cilindrajeInput.disabled = false;
            vinInput.disabled = false;
            document.getElementById('cilindrajeField').hidden = false;
            document.getElementById('vinField').hidden = false;
        } else {
            cilindrajeInput.disabled = true;
            vinInput.value = ''; // Limpiar el valor del input si se deshabilita
            vinInput.disabled = true;
            cilindrajeInput.value = ''; // Limpiar el valor del input si se deshabilita
            document.getElementById('cilindrajeField').hidden = true;
            document.getElementById('vinField').hidden = true;
        }
        updateQuoteCard();
    };

    marcaInput.addEventListener('input', toggleFields);

    loadState();
    normalizeUppercaseFields();
    
    // Verificar estado de marca después de cargar datos guardados
    toggleFields();

    // Variable para almacenar la fila que se está arrastrando
    let draggedRow = null;
    let longPressTimer = null; // Temporizador para el toque largo
    const LONG_PRESS_DELAY = 400; // Milisegundos para un toque largo
    let initialTouchY = 0; 
    let initialTouchX = 0; 
    const MOVEMENT_TOLERANCE = 5;

    let currentDragTarget = null; 
    let isTouchDragging = false;
    let editingItem = null;

    function handleDragStart(e) {
        draggedRow = this;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.outerHTML);
        setTimeout(() => {
            this.classList.add('dragging');
        }, 0);
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (this !== draggedRow) {
            this.classList.add('drop-target');
        }
    }

    function handleDragLeave() {
        this.classList.remove('drop-target');
    }

    async function handleDrop(e) {
        e.preventDefault();
        this.classList.remove('drop-target');
        if (this === draggedRow) {
            return;
        }
        const draggedIndex = parseInt(draggedRow.dataset.index);
        const targetIndex = parseInt(this.dataset.index);
        const [movedItem] = quoteItems.splice(draggedIndex, 1);
        quoteItems.splice(targetIndex, 0, movedItem);
        renderTable();
    }

    function handleDragEnd() {
        this.classList.remove('dragging');
        const dropTargets = document.querySelectorAll('#itemsTable tbody tr.drop-target');
        dropTargets.forEach(target => target.classList.remove('drop-target'));
        draggedRow = null;
    }

    function handleTouchStart(e) {
        if (e.touches.length !== 1) return;
        
        if (longPressTimer) {
            clearTimeout(longPressTimer);
        }

        draggedRow = this;
        initialTouchY = e.touches[0].clientY;
        initialTouchX = e.touches[0].clientX;
        isTouchDragging = false;

        longPressTimer = setTimeout(() => {
            const currentY = e.touches[0].clientY;
            const currentX = e.touches[0].clientX;
            const deltaY = Math.abs(currentY - initialTouchY);
            const deltaX = Math.abs(currentX - initialTouchX);
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (distance < MOVEMENT_TOLERANCE) {
                isTouchDragging = true;
                draggedRow.classList.add('dragging');
                e.preventDefault(); 
                if (navigator.vibrate) {
                    navigator.vibrate(50); 
                }
            } else {
                handleTouchEnd(); 
            }
        }, LONG_PRESS_DELAY);
    }

    function handleTouchMove(e) {
        if (!isTouchDragging) {
            const currentY = e.touches[0].clientY;
            const currentX = e.touches[0].clientX;
            const deltaY = Math.abs(currentY - initialTouchY);
            const deltaX = Math.abs(currentX - initialTouchX);
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (longPressTimer && distance > MOVEMENT_TOLERANCE) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
                return;
            }
            return;
        }

        e.preventDefault();

        const touchY = e.touches[0].clientY;
        const touchX = e.touches[0].clientX;
        const targetElement = document.elementFromPoint(touchX, touchY);

        let newDropTarget = null;
        if (targetElement) {
            newDropTarget = targetElement.closest('tr');
            if (newDropTarget && newDropTarget.closest('#itemsTable tbody') && newDropTarget !== draggedRow) {
                if (currentDragTarget && currentDragTarget !== newDropTarget) {
                    currentDragTarget.classList.remove('drop-target');
                }
                newDropTarget.classList.add('drop-target');
                currentDragTarget = newDropTarget;
            } else {
                if (currentDragTarget) {
                    currentDragTarget.classList.remove('drop-target');
                    currentDragTarget = null;
                }
            }
        }
        
    }

    function handleTouchEnd() {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        if (!isTouchDragging) {
            draggedRow = null; 
            return;
        }

        if (draggedRow) {
            draggedRow.classList.remove('dragging');
        }

        if (currentDragTarget && currentDragTarget !== draggedRow) {
            const draggedIndex = parseInt(draggedRow.dataset.index);
            const targetIndex = parseInt(currentDragTarget.dataset.index);

            const [movedItem] = quoteItems.splice(draggedIndex, 1);
            quoteItems.splice(targetIndex, 0, movedItem);
            
            renderTable();
        }

        if (currentDragTarget) {
            currentDragTarget.classList.remove('drop-target');
        }
        draggedRow = null;
        currentDragTarget = null;
        initialTouchY = 0;
        initialTouchX = 0;
        isTouchDragging = false;
    }

    addItemButton.addEventListener('click', () => {
        const descrip = descripInput.value.trim();
        const cant = cantInput.value.trim();
        const dym = dymInput.value.trim();
        const estado = estadoInput.value.trim().toUpperCase();
        const pint = pintInput.value.trim();
        const dat = datInput.value.trim();

        if (!descrip) {
            alert('La descripción es obligatoria para agregar un ítem.');
            return;
        }

        const newItem = {
            id: editingItem ? editingItem.id : storage.makeId(),
            descrip,
            cant,
            dym,
            estado,
            pint,
            dat
        };

        if (editingItem !== null) {
            const itemIndex = quoteItems.indexOf(editingItem);
            if (itemIndex !== -1) quoteItems[itemIndex] = { ...editingItem, ...newItem };
            editingItem = null;
            addItemButton.textContent = 'Agregar';
        } else {
            quoteItems.push(newItem); 
        }

        renderTable(); 
        descripInput.value = '';
        cantInput.value = '';
        dymInput.value = '';
        estadoInput.value = '';
        pintInput.value = '';
        datInput.value = '';
        descripInput.focus();
    });

    if (newQuoteBtn) {
        newQuoteBtn.addEventListener('click', handleNewQuote);
    }

/* --- Puente para integración por voz (voice.js) ---
       Expone un API mínima para que voice.js registre/elimine ítems
       reutilizando la lógica existente de quoteItems. */
    window.CoticarVoice = {
        register(item) {
            if (!item || !item.descrip) return false;
            quoteItems.push({ ...item, id: item.id || storage.makeId() });
            renderTable();
            saveState();
            return true;
        },
        removeLast() {
            if (quoteItems.length) {
                quoteItems.pop();
                renderTable();
                saveState();
                return true;
            }
            return false;
        },
        getItemsCount() {
            return quoteItems.length;
        }
    };
});
