document.addEventListener('DOMContentLoaded', () => {

    const addItemButton = document.getElementById('addItemBtn');
    const itemsTableBody = document.querySelector('#itemsTable tbody');

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
    const especialidadInput = document.getElementById('especialidad');
    const empresaInput = document.getElementById('empresa');
    const userForm = document.getElementById('userForm');
    const userModal = document.getElementById('userModal');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const quoteForm = document.getElementById('quoteForm');
    const quoteModal = document.getElementById('quoteModal');
    const quoteSummary = document.getElementById('quoteSummary');
    const newQuoteBtn = document.getElementById('newQuoteBtn');
    const photosLink = document.getElementById('photosLink');

    const STORAGE_KEY = 'coticarQuoteState';

    // Array para almacenar los ítems de la cotización
    let quoteItems = [];
    let isLoading = false;

    const saveState = () => {
        if (isLoading) return;
        
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
                nombreCompleto: nombreCompletoInput.value.trim(),
                especialidad: especialidadInput.value.trim(),
                empresa: empresaInput.value.trim()
            },
            quoteItems
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        if (photosLink) photosLink.href = `fotos.html?placa=${encodeURIComponent(placaInput.value.trim().toUpperCase())}`;
    };

    const clearState = () => {
        localStorage.removeItem(STORAGE_KEY);
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
    const openQuoteModal = () => {
        quoteModal.hidden = false;
        toggleFields();
        placaInput.focus();
    };
    const closeQuoteModal = () => {
        quoteModal.hidden = true;
        updateQuoteCard();
    };

    // Función para renderizar la tabla desde el array quoteItems
    const renderTable = () => {
        itemsTableBody.innerHTML = '';

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
                dymInput.value = item.dym;
                estadoInput.value = item.estado;
                pintInput.value = item.pint;
                datInput.value = item.dat;
                editingIndex = index;
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
                quoteItems.splice(index, 1);
                renderTable(); 
            });
            actionsCell.appendChild(deleteButton);
        });

        saveState();
    };

    const loadState = () => {
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (!savedState) {
            updateUserDisplay();
            openUserModal();
            return;
        }

        try {
            isLoading = true;
            const state = JSON.parse(savedState);
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
                especialidadInput.value = state.fields.especialidad || '';
                empresaInput.value = state.fields.empresa || '';
            }

            quoteItems = Array.isArray(state.quoteItems) ? state.quoteItems : [];
            renderTable();
        } catch (error) {
            console.warn('No se pudo cargar el estado guardado:', error);
        } finally {
            isLoading = false;
        }

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
        especialidadInput,
        empresaInput
    ];

    watchedFields.forEach((field) => {
        if (field) {
            field.addEventListener('input', saveState);
        }
    });

    userForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!userForm.reportValidity()) return;
        saveState();
        closeUserModal();
        if (!placaInput.value.trim()) openQuoteModal();
    });

    userNameDisplay.addEventListener('click', openUserModal);
    quoteForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!quoteForm.reportValidity()) return;
        fechaInput.value = getToday();
        saveState();
        updateQuoteCard();
        closeQuoteModal();
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
        if (!confirm('¿Deseas iniciar una nueva cotización y borrar los datos actuales?')) return;
        quoteItems = [];
        resetFormFields();
        clearState();
        renderTable();
        addItemButton.textContent = 'Agregar';
        toggleFields();
        openQuoteModal();
    };

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
    let editingIndex = null;

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
            descrip,
            cant,
            dym,
            estado,
            pint,
            dat
        };

        if (editingIndex !== null) {
            quoteItems[editingIndex] = newItem;
            editingIndex = null;
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

    const getRequiredValue = (id) => document.getElementById(id)?.value.trim() || '';

    const getMissingMainFields = () => {
        const required = ['placa', 'marca', 'linea', 'modelo', 'color', 'tipoCliente'];
        return required.filter(field => !getRequiredValue(field));
    };

    const validateCommonDownload = () => {
        const missing = getMissingMainFields();
        if (missing.length) {
            alert(`Faltan datos obligatorios: ${missing.map(f => f.toUpperCase()).join(', ')}`);
            return false;
        }
        return true;
    };

    const validateSuzukiDownload = () => {
        if (!validateCommonDownload()) return false;
        const missingSuzuki = [];
        if (!getRequiredValue('cilindraje')) missingSuzuki.push('cilindraje');
        if (!getRequiredValue('vin')) missingSuzuki.push('vin');
        if (missingSuzuki.length) {
            alert(`Para Suzuki faltan datos: ${missingSuzuki.map(f => f.toUpperCase()).join(', ')}`);
            return false;
        }
        return true;
    };

    /* --- Exportar Excel con nombre de placa --- */
    document.getElementById('cecxel').addEventListener('click', async () => {
        if (!validateCommonDownload()) return;

        try {
            const workbook = new ExcelJS.Workbook();
            const response = await fetch('./template.xlsx');
            const arrayBuffer = await response.arrayBuffer();
            await workbook.xlsx.load(arrayBuffer);

            const worksheet = workbook.getWorksheet(1); // Selecciona la primera hoja de la plantilla

            worksheet.getCell('C2').value = document.getElementById('fecha').value || '';
            worksheet.getCell('C3').value = (document.getElementById('placa').value || '').toUpperCase();
            worksheet.getCell('E2').value = (document.getElementById('marca').value || '').toUpperCase();
            worksheet.getCell('E3').value = (document.getElementById('linea').value || '').toUpperCase();
            worksheet.getCell('C4').value = document.getElementById('modelo')?.value || '';
            worksheet.getCell('E4').value = (document.getElementById('color')?.value || '').toUpperCase();
            worksheet.getCell('C5').value = (document.getElementById('tipoCliente')?.value || '').toUpperCase();


            let startRow = 8; // Comienza a escribir desde la fila 8 en Excel

            // Ahora iteramos sobre el array quoteItems para llenar el Excel
            quoteItems.forEach((item) => {
                worksheet.getCell(`B${startRow}`).value = item.descrip;
                worksheet.getCell(`F${startRow}`).value = item.cant;
                worksheet.getCell(`G${startRow}`).value = item.dym;
                worksheet.getCell(`H${startRow}`).value = item.estado;
                worksheet.getCell(`I${startRow}`).value = item.pint;
                worksheet.getCell(`J${startRow}`).value = item.dat;

                startRow++;
            });

            const placa = document.getElementById('placa').value || 'cotizacion';

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${placa}.xlsx`.toUpperCase();
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
        }
    });

    /* --- Exportar Excel de Suzuki --- */
    document.getElementById('crearex').addEventListener('click', async () => {
        if (!validateSuzukiDownload()) return;

        try {
            const workbook = new ExcelJS.Workbook();
            const response = await fetch('./template2.xlsx');
            const arrayBuffer = await response.arrayBuffer();
            const loadedWorkbook = await workbook.xlsx.load(arrayBuffer); // Asegúrate de que esto se resuelva correctamente

            const worksheet = loadedWorkbook.getWorksheet(1); // Usa loadedWorkbook para obtener la hoja

            worksheet.getCell('B6').value = (document.getElementById('placa').value || '').toUpperCase();
            worksheet.getCell('B3').value = (document.getElementById('linea').value || '').toUpperCase();
            worksheet.getCell('B2').value = document.getElementById('modelo')?.value || '';
            worksheet.getCell('B4').value = cilindrajeInput.value || '';
            worksheet.getCell('B7').value = (document.getElementById('tipoCliente')?.value || '').toUpperCase();
            worksheet.getCell('B5').value = (vinInput.value || '').toUpperCase();

            let startRow = 14;

            // Ahora iteramos sobre el array quoteItems para llenar el Excel
            quoteItems.forEach((item) => {
                worksheet.getCell(`A${startRow}`).value = item.descrip; // Solo descrip aquí
                worksheet.getCell(`B${startRow}`).value = item.cant;

                startRow++;
            });

            const placa = document.getElementById('placa').value || 'cotizacion';

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${placa} Cotizacion Repuestos Suzuki.xlsx`.toUpperCase();
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
        }
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
            quoteItems.push(item);
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
