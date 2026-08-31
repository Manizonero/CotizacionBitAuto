(function() {
    'use strict';

    const storage = window.AppStorage;
    const $ = (id) => document.getElementById(id);
    const quoteList = $('quoteList');
    let idToFinalize = null;

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
                    <p>${quote.marca} | ${quote.fecha} | ${quote.itemsCount} repuestos</p>
                </div>
                <div class="quote-actions">
                    <div class="status-badges">
                        <span class="status-badge ${photosClass}">${quote.photosDownloaded ? '✓ Fotos' : '✗ Fotos'}</span>
                        <span class="status-badge ${emailClass}">${quote.emailOpened ? '✓ Correo' : '✗ Correo'}</span>
                    </div>
                    <button class="finalize-btn" data-id="${quote.id}">Finalizar</button>
                </div>
            `;

            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('finalize-btn')) return;
                storage.setActiveQuote(quote.id);
                window.location.href = 'index.html';
            });

            const finBtn = item.querySelector('.finalize-btn');
            finBtn.addEventListener('click', (e) => {
                e.stopPropagation();

                // Validación antes de permitir finalizar
                if (!quote.photosDownloaded || !quote.emailOpened) {
                    let missing = [];
                    if (!quote.photosDownloaded) missing.push("descargar las fotos");
                    if (!quote.emailOpened) missing.push("enviar el correo");

                    $('alertMessage').textContent = `No puedes finalizar esta cotización todavía. Falta: ${missing.join(" y ")}.`;
                    $('alertModal').hidden = false;
                    return;
                }

                idToFinalize = quote.id;
                $('finalizeModal').hidden = false;
            });

            quoteList.appendChild(item);
        });
    }

    $('createNewBtn').addEventListener('click', () => {
        storage.createNewQuote();
        window.location.href = 'index.html';
    });

    $('cancelFinalizeBtn').addEventListener('click', () => {
        $('finalizeModal').hidden = true;
        idToFinalize = null;
    });

    $('confirmFinalizeBtn').addEventListener('click', async () => {
        if (idToFinalize) {
            await storage.deleteQuote(idToFinalize);
            renderQuotes();
        }
        $('finalizeModal').hidden = true;
        idToFinalize = null;
    });

    $('closeAlertBtn').addEventListener('click', () => {
        $('alertModal').hidden = true;
    });

    document.addEventListener('DOMContentLoaded', renderQuotes);

})();
