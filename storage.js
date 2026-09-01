/**
 * storage.js - Centralización del estado y persistencia (LocalStorage e IndexedDB)
 * VERSIÓN: 2.0 (Corregido índice de búsqueda de fotos)
 */
(function(window) {
    'use strict';

    const STORAGE_KEY = 'coticarQuoteState';
    const CONTACTS_KEY = 'coticarEmailContacts';
    const GROUPS_KEY = 'coticarEmailGroups';
    const SETTINGS_KEY = 'coticarEmailSettings';
    const GLOBAL_USER_KEY = 'coticarGlobalUser';
    const DB_NAME = 'TallerDB';
    const DB_VERSION = 2; // Bumped to 2 to force index creation
    const STORE_NAME = 'inspecciones';

    const AppStorage = {
        makeId: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8),

        getUserName: () => localStorage.getItem(GLOBAL_USER_KEY) || '',
        setUserName: (name) => localStorage.setItem(GLOBAL_USER_KEY, name),

        _getMasterState: () => {
            try {
                const str = localStorage.getItem(STORAGE_KEY);
                if (!str) return { activeQuoteId: null, quotes: {} };
                const parsed = JSON.parse(str);
                if (!parsed || typeof parsed !== 'object') return { activeQuoteId: null, quotes: {} };
                if (!parsed.quotes) parsed.quotes = {};
                return parsed;
            } catch (e) { return { activeQuoteId: null, quotes: {} }; }
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
            const id = AppStorage.makeId();
            master.quotes[id] = AppStorage.getInitialState();
            master.activeQuoteId = id;
            AppStorage._saveMasterState(master);
            return id;
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
                if (placa && placa !== 'SIN PLACA') await AppStorage.deletePhotosByPlate(placa);
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
            const activeId = master.activeQuoteId;
            return (activeId && master.quotes[activeId]) ? master.quotes[activeId] : AppStorage.getInitialState();
        },

        saveState: (state) => {
            const master = AppStorage._getMasterState();
            if (master.activeQuoteId) {
                master.quotes[master.activeQuoteId] = state;
                AppStorage._saveMasterState(master);
            }
        },

        getInitialState: () => ({
            fields: { fecha: '', placa: '', marca: '', linea: '', modelo: '', color: '', tipoCliente: '', cilindraje: '', vin: '' },
            quoteItems: [], naItems: [], verifiedRepuestos: [], photosDownloaded: false, emailOpened: false, photosDownloadedFor: ''
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
                if (link.getAttribute('href') === currentPath) link.classList.add('active-nav');
                else link.classList.remove('active-nav');
            });
        },

        getContacts: () => JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]'),
        saveContacts: (c) => localStorage.setItem(CONTACTS_KEY, JSON.stringify(c)),
        getGroups: () => JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]'),
        saveGroups: (g) => localStorage.setItem(GROUPS_KEY, JSON.stringify(g)),
        getSettings: () => JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
        saveSettings: (s) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)),

        openDB: () => {
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(DB_NAME, DB_VERSION);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    }
                    const store = e.target.transaction.objectStore(STORE_NAME);
                    if (!store.indexNames.contains('placaVehiculo')) {
                        store.createIndex('placaVehiculo', 'placaVehiculo', { unique: false });
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        },

        savePhoto: async (photoData) => {
            const db = await AppStorage.openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.put({ ...photoData, createdAt: photoData.createdAt || Date.now() });
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        },

        getPhotosByPlate: async (placa) => {
            if (!placa) return [];
            const db = await AppStorage.openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                if (!store.indexNames.contains('placaVehiculo')) { resolve([]); return; }
                const index = store.index('placaVehiculo');
                const req = index.getAll(placa.toUpperCase());
                req.onsuccess = () => {
                    const results = (req.result || []).filter(r => r && r.blob && r.blob.size > 0);
                    resolve(results.sort((a, b) => a.createdAt - b.createdAt));
                };
                req.onerror = () => reject(req.error);
            });
        },

        deletePhoto: async (id) => {
            const db = await AppStorage.openDB();
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).delete(id);
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            });
        },

        deletePhotosByPlate: async (placa) => {
            if (!placa) return;
            const db = await AppStorage.openDB();
            return new Promise(resolve => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const idx = tx.objectStore(STORE_NAME).index('placaVehiculo');
                idx.openCursor(placa.toUpperCase()).onsuccess = (e) => {
                    const c = e.target.result;
                    if (c) { c.delete(); c.continue(); }
                };
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            });
        }
    };
    window.AppStorage = AppStorage;
})(window);
