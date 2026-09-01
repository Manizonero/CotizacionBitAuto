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
                const masterStr = localStorage.getItem(STORAGE_KEY);
                if (!masterStr) return AppStorage._createInitialMaster();

                let parsed = JSON.parse(masterStr);

                // MIGRACIÓN: Formato antiguo
                if (parsed.fields && !parsed.quotes) {
                    const oldId = 'migrated_' + AppStorage.makeId();
                    parsed = { activeQuoteId: oldId, quotes: { [oldId]: parsed } };
                    AppStorage._saveMasterState(parsed);
                }

                // LIMPIEZA: Eliminar entradas corruptas (sin campos básicos)
                let changed = false;
                if (parsed.quotes) {
                    for (const id in parsed.quotes) {
                        if (!parsed.quotes[id] || typeof parsed.quotes[id] !== 'object') {
                            delete parsed.quotes[id];
                            changed = true;
                        }
                    }
                }

                // SEGURIDAD: Asegurar que siempre haya una sesión válida
                const keys = Object.keys(parsed.quotes || {});
                if (keys.length === 0) return AppStorage._createInitialMaster();

                if (!parsed.activeQuoteId || !parsed.quotes[parsed.activeQuoteId]) {
                    parsed.activeQuoteId = keys[0];
                    changed = true;
                }

                if (changed) AppStorage._saveMasterState(parsed);
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

        /**
         * Borrado Blindado: Elimina la cotización de LocalStorage PRIMERO.
         */
        deleteQuote: async (id) => {
            const master = AppStorage._getMasterState();
            const idStr = String(id);
            const quoteData = master.quotes[idStr];
            if (!quoteData) return;

            const placa = quoteData.fields?.placa;

            // 1. Eliminar del objeto maestro
            delete master.quotes[idStr];

            // 2. Gestionar el ID activo
            const keys = Object.keys(master.quotes);
            if (keys.length === 0 || master.activeQuoteId === idStr) {
                if (keys.length > 0) {
                    master.activeQuoteId = keys[0];
                } else {
                    const newId = AppStorage.makeId();
                    master.quotes[newId] = AppStorage.getInitialState();
                    master.activeQuoteId = newId;
                }
            }

            // 3. Guardar en LocalStorage
            AppStorage._saveMasterState(master);

            // 4. Limpiar fotos (no bloquea)
            if (placa) {
                const other = Object.values(master.quotes).some(q => q.fields?.placa === placa);
                if (!other) AppStorage.deletePhotosByPlate(placa).catch(() => {});
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

        // --- Gestión de Datos de la Cotización Activa ---
        getState: () => {
            const master = AppStorage._getMasterState();
            return master.quotes[master.activeQuoteId] || AppStorage.getInitialState();
        },

        saveState: (state) => {
            const master = AppStorage._getMasterState();
            if (!master.activeQuoteId) return;
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

        getPlate: () => AppStorage.getState().fields?.placa?.trim().toUpperCase() || '',

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
                const path = link.getAttribute('href');
                if (path === currentPath) link.classList.add('active-nav');
                else link.classList.remove('active-nav');
            });
        },

        // --- Configuración Global ---
        getContacts: () => JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]'),
        saveContacts: (c) => localStorage.setItem(CONTACTS_KEY, JSON.stringify(c)),
        getGroups: () => JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]'),
        saveGroups: (g) => localStorage.setItem(GROUPS_KEY, JSON.stringify(g)),
        getSettings: () => JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
        saveSettings: (s) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)),

        // --- IndexedDB ---
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
            const s = tx.objectStore(STORE_NAME);
            s.put({ ...p, createdAt: p.createdAt || Date.now() });
            return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
        },
        getPhotosByPlate: async (placa) => {
            if (!placa) return [];
            const db = await AppStorage.openDB();
            return new Promise((res, rej) => {
                const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).index('placaVehiculo').getAll(placa.toUpperCase());
                req.onsuccess = () => res((req.result || []).filter(r => r.blob?.size > 0).sort((a, b) => a.createdAt - b.createdAt));
                req.onerror = () => rej(req.error);
            });
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
            return new Promise(res => { tx.oncomplete = res; tx.onerror = res; });
        }
    };
    window.AppStorage = AppStorage;
})(window);
