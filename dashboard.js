(function() {
    'use strict';

    const storage = window.AppStorage;
    const $ = (id) => document.getElementById(id);
    const quoteList = $('quoteList');
    let idToDelete = null;

    function renderQuotes() {
        const quotes = storage.getAllQuotes();
        quoteList.innerHTML = '';

        if (quotes.length === 0) {
            quoteList.innerHTML = '<p class="muted" style="text-align: center; margin-top: 40px;">No hay cotizaciones activas.</p>';
            return;
        }

        quotes.forEach(quote => {
            const item = document.createElement('div');
            item.className = `quote-item ${quote.active ? 'active' : ''}`;

            const photosClass = quote.photosDownloaded ? 'status-done' : 'status-pending';
            const emailClass = quote.emailOpened ? 'status-done' : 'status-pending';

            item.innerHTML = `
                <div class="quote-info">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <h3>${quote.placa}</h3>
                        ${quote.active ? '<span class="status-badge status-active">Abierta</span>' : ''}
                    </div>
                    <p style="margin-bottom: 8px;">${quote.marca} | ${quote.fecha} | ${quote.itemsCount} repuestos</p>
                    <div class="status-badges" style="flex-direction: row; gap: 8px;">
                        <span class="status-badge ${photosClass}">${quote.photosDownloaded ? '✓ Fotos' : '✗ Fotos'}</span>
                        <span class="status-badge ${emailClass}">${quote.emailOpened ? '✓ Correo' : '✗ Correo'}</span>
                    </div>
                </div>
                <div class="quote-actions">
                    <button class="finalize-btn" data-id="${quote.id}">Finalizar</button>
                    <button class="delete-btn" data-id="${quote.id}" title="Eliminar definitivamente">🗑 Borrar</button>
                </div>
            `;

            item.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                storage.setActiveQuote(quote.id);
                window.location.href = 'index.html';
            });

            const finBtn = item.querySelector('.finalize-btn');
            finBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!quote.photosDownloaded || !quote.emailOpened) {
                    let missing = [];
                    if (!quote.photosDownloaded) missing.push("descargar las fotos");
                    if (!quote.emailOpened) missing.push("enviar el correo");
                    $('alertMessage').textContent = `No puedes finalizar esta cotización todavía. Falta: ${missing.join(" y ")}.`;
                    $('alertModal').hidden = false;
                    return;
                }
                idToDelete = quote.id;
                $('deleteModal').hidden = false;
            });

            const delBtn = item.querySelector('.delete-btn');
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                idToDelete = quote.id;
                $('deleteModal').hidden = false;
            });

            quoteList.appendChild(item);
        });
    }

    $('createNewBtn').addEventListener('click', () => {
        const quotes = storage.getAllQuotes();
        if (quotes.length >= 5) {
            $('alertMessage').textContent = 'Has alcanzado el límite de 5 cotizaciones.';
            $('alertModal').hidden = false;
            return;
        }
        storage.createNewQuote();
        window.location.href = 'index.html';
    });

    $('cancelDeleteBtn').addEventListener('click', () => {
        $('deleteModal').hidden = true;
        idToDelete = null;
    });

    $('confirmDeleteBtn').addEventListener('click', async () => {
        if (idToDelete) {
            await storage.deleteQuote(idToDelete);
            renderQuotes();
        }
        $('deleteModal').hidden = true;
        idToDelete = null;
    });

    $('closeAlertBtn').addEventListener('click', () => {
        $('alertModal').hidden = true;
    });

    const updateUserDisplay = () => {
        const userName = storage.getUserName();
        if ($('userNameDisplay')) {
            $('userNameDisplay').textContent = userName || 'Configurar Usuario';
        }
    };

    $('userNameDisplay')?.addEventListener('click', () => {
        const name = prompt('Ingresa tu nombre completo:', storage.getUserName());
        if (name !== null) {
            storage.setUserName(name.trim());
            updateUserDisplay();
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        renderQuotes();
        updateUserDisplay();
        storage.highlightActiveNav();
    });

})();
