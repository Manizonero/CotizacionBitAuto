(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const storage = window.AppStorage;

    function getRepuestos() {
        const state = storage.getState();
        let items = Array.isArray(state.quoteItems) ? state.quoteItems : [];
        let changed = false;
        items = items.map((item) => {
            if (!item || item.id) return item;
            changed = true;
            return { ...item, id: storage.makeId() };
        });
        if (changed) {
            storage.updateQuoteItems(items);
        }
        return items;
    }
    function getVerified() {
        const state = storage.getState();
        return new Set(Array.isArray(state.verifiedRepuestos) ? state.verifiedRepuestos : []);
    }
    function setVerified(idSet) {
        const state = storage.getState();
        state.verifiedRepuestos = [...idSet];
        storage.saveState(state);
    }
    function getPlate() {
        return storage.getPlate();
    }

    function render() {
        const list = $('verifList');
        const empty = $('verifEmpty');
        const count = $('verifCount');
        list.innerHTML = '';

        const repuestos = getRepuestos();
        const verified = getVerified();
        const total = repuestos.length;
        const confirmedCount = verified.size;

        count.textContent = `${confirmedCount} de ${total}`;
        empty.hidden = total > 0;

        if (!total) return;

        repuestos.forEach((item) => {
            const isConfirmed = verified.has(item.id);
            const row = document.createElement('div');
            row.className = 'verif-item' + (isConfirmed ? ' checked' : '');

            const label = document.createElement('label');
            const check = document.createElement('input');
            check.type = 'checkbox';
            check.className = 'verif-check';
            check.checked = isConfirmed;

            const name = document.createElement('span');
            name.textContent = item.descrip || item.id;

            label.appendChild(check);
            label.appendChild(name);

            const doneTag = document.createElement('span');
            doneTag.className = 'verif-done';
            doneTag.textContent = 'Confirmado';
            doneTag.style.display = isConfirmed ? 'block' : 'none';

            check.addEventListener('change', () => {
                const verifiedSet = getVerified();
                if (check.checked) {
                    verifiedSet.add(item.id);
                    row.classList.add('checked');
                    doneTag.style.display = 'block';
                } else {
                    verifiedSet.delete(item.id);
                    row.classList.remove('checked');
                    doneTag.style.display = 'none';
                }
                setVerified(verifiedSet);
                // Actualizar contador sin redibujar todo para mejor fluidez
                count.textContent = `${verifiedSet.size} de ${total}`;
            });

            row.appendChild(label);
            row.appendChild(doneTag);
            list.appendChild(row);
        });
    }

    function init() {
        const plateEl = $('verifPlateLabel');
        if (plateEl) plateEl.textContent = getPlate() ? `PLACA: ${getPlate()}` : 'Sin placa seleccionada';
        $('resetBtn').addEventListener('click', () => {
            const state = storage.getState();
            state.verifiedRepuestos = [];
            storage.saveState(state);
            render();
            $('verifStatus').textContent = 'Lista restablecida. Selecciona los repuestos que ingresaste.';
        });
        render();
        storage.highlightActiveNav();
    }

    document.addEventListener('DOMContentLoaded', init);
})();