/**
 * storage.js - Centralización del estado y persistencia (LocalStorage e IndexedDB)
 * -------------------------------------------------------------------------
 * Proporciona una API única para acceder y modificar los datos de la aplicación.
 * Soporta múltiples cotizaciones simultáneas y datos globales de usuario.
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

        // --- Gestión de Usuario Global ---
        getUserName: () => localStorage.getItem(GLOBAL_USER_KEY) || '',
        setUserName: (name) => localStorage.setItem(GLOBAL_USER_KEY, name),

        // --- Gestión de Sesiones Múltiples ---
        _getMasterState: () => {
            try {
                const master = localStorage.getItem(STORAGE_KEY);
                if (!master) return AppStorage._createInitialMaster();
                const parsed = JSON.parse(master);
                if (parsed.fields && !parsed.quotes) {
                    const oldId = AppStorage.makeId();
                    return { activeQuoteId: oldId, quotes: { [oldId]: parsed } };
                }
                return parsed;
            } catch (error) {
                return AppStorage._createInitialMaster();
            }
        },

        _createInitialMaster: () => {
            const firstId = AppStorage.makeId();
            const master = {
                activeQuoteId: firstId,
                quotes: { [firstId]: AppStorage.getInitialState() }
            };
            AppStorage._saveMasterState(master);
            return master;
        },

        _saveMasterState: (master) => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(master));
        },

        getActiveQuoteId: () => AppStorage._getMasterState().activeQuoteId,

        setActiveQuote: (id) => {
            const master = AppStorage._getMasterState();
            if (master.quotes[id]) {
                master.activeQuoteId = id;
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

        /**
         * Finaliza/Elimina una cotización.
         */
        deleteQuote: async (id) => {
            const master = AppStorage._getMasterState();
            const placa = master.quotes[id]?.fields?.placa;
            delete master.quotes[id];

            if (master.activeQuoteId === id) {
                const keys = Object.keys(master.quotes);
                if (keys.length > 0) {
                    master.activeQuoteId = keys[0];
                } else {
                    const newId = AppStorage.makeId();
                    master.quotes[newId] = AppStorage.getInitialState();
                    master.activeQuoteId = newId;
                }
            }
            AppStorage._saveMasterState(master);

            if (placa) {
                const otherWithSamePlate = Object.values(master.quotes).some(q => q.fields?.placa === placa);
                if (!otherWithSamePlate) {
                    await AppStorage.deletePhotosByPlate(placa);
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
                itemsCount: data.quoteItems?.length || 0,
                active: id === master.activeQuoteId,
                photosDownloaded: data.photosDownloaded,
                emailOpened: data.emailOpened
            }));
        },

        // --- Gestión de Datos de la Cotización Activa ---
        getState: () => {
            const master = AppStorage._getMasterState();
            return master.quotes[master.activeQuoteId] || AppStorage.getInitialState();
        },

        saveState: (state) => {
            const master = AppStorage._getMasterState();
            master.quotes[master.activeQuoteId] = state;
            AppStorage._saveMasterState(master);
        },

        getInitialState: () => ({
            fields: {
                fecha: '', placa: '', marca: '', linea: '', modelo: '',
                color: '', tipoCliente: '', cilindraje: '', vin: ''
            },
            quoteItems: [],
            naItems: [],
            verifiedRepuestos: [],
            photosDownloaded: false,
            emailOpened: false,
            photosDownloadedFor: ''
        }),

        clearState: () => {
            const master = AppStorage._getMasterState();
            master.quotes[master.activeQuoteId] = AppStorage.getInitialState();
            AppStorage._saveMasterState(master);
        },

        getPlate: () => {
            const state = AppStorage.getState();
            return (state.fields?.placa || '').trim().toUpperCase();
        },

        updateFields: (fields) => {
            const state = AppStorage.getState();
            state.fields = { ...state.fields, ...fields };
            AppStorage.saveState(state);
        },

        updateQuoteItems: (items) => {
            const state = AppStorage.getState();
            state.quoteItems = items;
            AppStorage.saveState(state);
        },

        getNaIds: () => {
            const state = AppStorage.getState();
            return new Set(Array.isArray(state.naItems) ? state.naItems : []);
        },

        saveNaIds: (idSet) => {
            const state = AppStorage.getState();
            state.naItems = Array.isArray(idSet) ? idSet : [...idSet];
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

        // --- Configuración Global ---
        getContacts: () => {
            try {
                const contacts = localStorage.getItem(CONTACTS_KEY);
                return contacts ? JSON.parse(contacts) : [];
            } catch (error) { return []; }
        },
        saveContacts: (contacts) => localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts)),

        getGroups: () => {
            try {
                const groups = localStorage.getItem(GROUPS_KEY);
                return groups ? JSON.parse(groups) : [];
            } catch (error) { return []; }
        },
        saveGroups: (groups) => localStorage.setItem(GROUPS_KEY, JSON.stringify(groups)),

        getSettings: () => {
            try {
                const settings = localStorage.getItem(SETTINGS_KEY);
                return settings ? JSON.parse(settings) : {};
            } catch (error) { return {}; }
        },
        saveSettings: (settings) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)),

        // --- IndexedDB ---
        openDB: () => {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, 1);
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                        store.createIndex('placaVehiculo', 'placaVehiculo', { unique: false });
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        },
        savePhoto: async (photoData) => {
            const db = await AppStorage.openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put({ ...photoData, createdAt: photoData.createdAt || Date.now() });
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        },
        getPhotosByPlate: async (placa) => {
            if (!placa) return [];
            const db = await AppStorage.openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const index = store.index('placaVehiculo');
                const request = index.getAll(placa.toUpperCase());
                request.onsuccess = () => {
                    const results = (request.result || []).filter(r => r.blob?.size > 0);
                    resolve(results.sort((a, b) => a.createdAt - b.createdAt));
                };
                request.onerror = () => reject(request.error);
            });
        },
        deletePhoto: async (id) => {
            const db = await AppStorage.openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        },
        deletePhotosByPlate: async (placa) => {
            if (!placa) return;
            const db = await AppStorage.openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const index = store.index('placaVehiculo');
                const request = index.openCursor(placa.toUpperCase());
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) { cursor.delete(); cursor.continue(); }
                };
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
        }
    };
    window.AppStorage = AppStorage;
})(window);
