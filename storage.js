/**
 * storage.js - Centralización del estado y persistencia (LocalStorage e IndexedDB)
 */
(function(window) {
    'use strict';

    const STORAGE_KEY = 'coticarQuoteState';
    const CONTACTS_KEY = 'coticarEmailContacts';
    const GROUPS_KEY = 'coticarEmailGroups';
    const SETTINGS_KEY = 'coticarEmailSettings';
    const GLOBAL_USER_KEY = 'coticarGlobalUser';
    const DB_NAME = 'TallerDB';
    const STORE_NAME = 'inspecciones';

    const AppStorage = {
        makeId: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8),

        getUserName: () => localStorage.getItem(GLOBAL_USER_KEY) || '',
        setUserName: (name) => localStorage.setItem(GLOBAL_USER_KEY, name),

        _getMasterState: () => {
            try {
                const masterStr = localStorage.getItem(STORAGE_KEY);
                if (!masterStr) return { activeQuoteId: null, quotes: {} };

                let parsed = JSON.parse(masterStr);
                if (!parsed || typeof parsed !== 'object') return { activeQuoteId: null, quotes: {} };
                if (!parsed.quotes) parsed.quotes = {};

                // Migración si viene de versión legacy (formato antiguo)
                if (parsed.fields && (!parsed.quotes || Object.keys(parsed.quotes).length === 0)) {
                    const oldId = 'legacy_' + AppStorage.makeId();
                    const migrated = { activeQuoteId: oldId, quotes: { [oldId]: parsed } };
                    AppStorage._saveMasterState(migrated);
                    return migrated;
                }
                return parsed;
            } catch (error) {
                return { activeQuoteId: null, quotes: {} };
            }
        },

        _saveMasterState: (master) => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(master));
        },

        getActiveQuoteId: () => AppStorage._getMasterState().activeQuoteId,

        setActiveQuote: (id) => {
            const master = AppStorage._getMasterState();
            if (master.quotes[id]) {
                master.activeQuoteId = String(id);
                AppStorage._saveMasterState(master);
            }
        },

        createNewQuote: () => {
            const master = AppStorage._getMasterState();
            const newId = AppStorage.makeId();
            master.quotes[newId] = AppStorage.getInitialState();
            master.activeQuoteId = newId;
            AppStorage._saveMasterState(master);
            return newId;
        },

        deleteQuote: async (id) => {
            const master = AppStorage._getMasterState();
            const idStr = String(id);

            if (master.quotes[idStr]) {
                const placa = master.quotes[idStr].fields?.placa;
                delete master.quotes[idStr];

                if (master.activeQuoteId === idStr) {
                    const keys = Object.keys(master.quotes);
                    master.activeQuoteId = keys.length > 0 ? keys[0] : null;
                }

                AppStorage._saveMasterState(master);

                if (placa) {
                    const other = Object.values(master.quotes).some(q => q.fields?.placa === placa);
                    if (!other) AppStorage.deletePhotosByPlate(placa).catch(()=>{});
                }
            }
        },

        getAllQuotes: () => {
            const master = AppStorage._getMasterState();
            return Object.entries(master.quotes).map(([id, data]) => ({
                id,
                placa: data.fields?.placa || 'SIN PLACA',
                marca: data.fields?.marca || '-',
                fecha: data.fields?.fecha || '-',
                itemsCount: (data.quoteItems || []).length,
                active: id === master.activeQuoteId,
                photosDownloaded: !!data.photosDownloaded,
                emailOpened: !!data.emailOpened
            }));
        },

        getState: () => {
            const master = AppStorage._getMasterState();
            if (!master.activeQuoteId || !master.quotes[master.activeQuoteId]) {
                return AppStorage.getInitialState();
            }
            return master.quotes[master.activeQuoteId];
        },

        saveState: (state) => {
            const master = AppStorage._getMasterState();
            if (!master.activeQuoteId) return;
            master.quotes[master.activeQuoteId] = state;
            AppStorage._saveMasterState(master);
        },

        getInitialState: () => ({
            fields: { fecha: '', placa: '', marca: '', linea: '', modelo: '', color: '', tipoCliente: '', cilindraje: '', vin: '' },
            quoteItems: [],
            naItems: [],
            verifiedRepuestos: [],
            photosDownloaded: false,
            emailOpened: false,
            photosDownloadedFor: ''
        }),

        getPlate: () => AppStorage.getState().fields?.placa?.trim().toUpperCase() || '',

        updateQuoteItems: (items) => {
            const state = AppStorage.getState();
            state.quoteItems = items;
            AppStorage.saveState(state);
        },

        getNaIds: () => new Set(AppStorage.getState().naItems || []),
        saveNaIds: (ids) => {
            const state = AppStorage.getState();
            state.naItems = Array.isArray(ids) ? ids : [...ids];
            AppStorage.saveState(state);
        },

        setPhotosDownloaded: (status) => {
            const state = AppStorage.getState();
            state.photosDownloaded = !!status;
            AppStorage.saveState(state);
        },

        setEmailOpened: (status) => {
            const state = AppStorage.getState();
            state.emailOpened = !!status;
            AppStorage.saveState(state);
        },

        highlightActiveNav: () => {
            const currentPath = window.location.pathname.split('/').pop() || 'index.html';
            document.querySelectorAll('.top-nav .nav-ico').forEach(link => {
                const href = link.getAttribute('href');
                if (href === currentPath) link.classList.add('active-nav');
                else link.classList.remove('active-nav');
            });
        },

        getContacts: () => JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]'),
        saveContacts: (c) => localStorage.setItem(CONTACTS_KEY, JSON.stringify(c)),
        getGroups: () => JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]'),
        saveGroups: (g) => localStorage.setItem(GROUPS_KEY, JSON.stringify(g)),
        getSettings: () => JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
        saveSettings: (s) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)),

        openDB: () => new Promise((res, rej) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const s = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    s.createIndex('placaVehiculo', 'placaVehiculo', { unique: false });
                }
            };
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
        }),
        savePhoto: async (p) => {
            const db = await AppStorage.openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put({ ...p, createdAt: p.createdAt || Date.now() });
            return new Promise(res => { tx.oncomplete = res; });
        },
        getPhotosByPlate: async (placa) => {
            if (!placa) return [];
            const db = await AppStorage.openDB();
            const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).index('placaVehiculo').getAll(placa.toUpperCase());
            return new Promise(res => { req.onsuccess = () => res((req.result || []).filter(r => r.blob?.size > 0).sort((a,b)=>a.createdAt-b.createdAt)); });
        },
        deletePhoto: async (id) => {
            const db = await AppStorage.openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(id);
            return new Promise(res => { tx.oncomplete = res; });
        },
        deletePhotosByPlate: async (placa) => {
            if (!placa) return;
            const db = await AppStorage.openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const idx = tx.objectStore(STORE_NAME).index('placaVehiculo');
            idx.openCursor(placa.toUpperCase()).onsuccess = (e) => {
                const c = e.target.result;
                if (c) { c.delete(); c.continue(); }
            };
            return new Promise(res => { tx.oncomplete = res; });
        }
    };
    window.AppStorage = AppStorage;
})(window);
