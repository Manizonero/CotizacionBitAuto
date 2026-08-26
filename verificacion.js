(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const STATE_KEY = 'coticarQuoteState';

    function getState() {
        try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); } catch (error) { return {}; }
    }
    function saveState(state) {
        try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (error) {}
    }
    function getRepuestos() {
        const state = getState();
        let items = Array.isArray(state.quoteItems) ? state.quoteItems : [];
        let changed = false;
        items = items.map((item) => {
            if (!item || item.id) return item;
            changed = true;
            return { ...item, id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8) };
        });
        if (changed) {
            state.quoteItems = items;
            saveState(state);
        }
        return items;
    }
    function getVerified() {
        const state = getState();
        return new Set(Array.isArray(state.verifiedRepuestos) ? state.verifiedRepuestos : []);
    }
    function setVerified(idSet) {
        const state = getState();
        state.verifiedRepuestos = [...idSet];
        saveState(state);
    }
    function getPlate() {
        const state = getState();
        return String((state.fields && state.fields.placa) || '').trim().toUpperCase();
    }

    function render() {
        const list = $('verifList');
        const empty = $('verifEmpty');
        const count = $('verifCount');
        list.innerHTML = '';
        const repuestos = getRepuestos();
        const verified = getVerified();
        const visible = repuestos.filter((item) => item && !verified.has(item.id));
        const total = repuestos.length;

        count.textContent = `${visible.length} de ${total}`;
        empty.hidden = total > 0;

        if (!total) return;
        if (!visible.length) {
            const done = document.createElement('p');
            done.className = 'panel-caption';
            done.textContent = 'Todos los repuestos fueron verificados.';
            list.appendChild(done);
            return;
        }

        visible.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'verif-item';

            const label = document.createElement('label');
            const check = document.createElement('input');
            check.type = 'checkbox';
            check.className = 'verif-check';

            const name = document.createElement('span');
            name.textContent = item.descrip || item.id;

            label.appendChild(check);
            label.appendChild(name);

            const doneTag = document.createElement('span');
            doneTag.className = 'verif-done';
            doneTag.textContent = 'Confirmado';
            doneTag.style.display = 'none';

            check.addEventListener('change', () => {
                const verifiedSet = getVerified();
                if (check.checked) verifiedSet.add(item.id);
                else verifiedSet.delete(item.id);
                setVerified(verifiedSet);
                render();
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
            const state = getState();
            state.verifiedRepuestos = [];
            saveState(state);
            render();
            $('verifStatus').textContent = 'Lista restablecida. Selecciona los repuestos que ingresaste.';
        });
        render();
    }

    document.addEventListener('DOMContentLoaded', init);
})();