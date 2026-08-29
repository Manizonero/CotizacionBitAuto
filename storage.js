/**
 * storage.js - Centralización del estado y persistencia (LocalStorage e IndexedDB)
 * -------------------------------------------------------------------------
 * Proporciona una API única para acceder y modificar los datos de la aplicación.
 */
(function(window) {
    'use strict';

    const STORAGE_KEY = 'coticarQuoteState';
    const CONTACTS_KEY = 'coticarEmailContacts';
    const GROUPS_KEY = 'coticarEmailGroups';
    const SETTINGS_KEY = 'coticarEmailSettings';
    const DB_NAME = 'TallerDB';
    const STORE_NAME = 'inspecciones';

    const AppStorage = {
        /**
         * Genera un ID único para los ítems.
         */
        makeId: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8),

        // --- Gestión de LocalStorage ---

        /**
         * Obtiene el estado completo desde LocalStorage.
         */
        getState: () => {
            try {
                const state = localStorage.getItem(STORAGE_KEY);
                return state ? JSON.parse(state) : AppStorage.getInitialState();
            } catch (error) {
                console.error('Error al leer LocalStorage:', error);
                return AppStorage.getInitialState();
            }
        },

        /**
         * Obtiene los contactos de correo.
         */
        getContacts: () => {
            try {
                const contacts = localStorage.getItem(CONTACTS_KEY);
                return contacts ? JSON.parse(contacts) : [];
            } catch (error) {
                return [];
            }
        },

        /**
         * Guarda los contactos de correo.
         */
        saveContacts: (contacts) => {
            localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
        },

        /**
         * Obtiene los grupos de correo.
         */
        getGroups: () => {
            try {
                const groups = localStorage.getItem(GROUPS_KEY);
                return groups ? JSON.parse(groups) : [];
            } catch (error) {
                return [];
            }
        },

        /**
         * Guarda los grupos de correo.
         */
        saveGroups: (groups) => {
            localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
        },

        /**
         * Obtiene la configuración de correo.
         */
        getSettings: () => {
            try {
                const settings = localStorage.getItem(SETTINGS_KEY);
                return settings ? JSON.parse(settings) : {};
            } catch (error) {
                return {};
            }
        },

        /**
         * Guarda la configuración de correo.
         */
        saveSettings: (settings) => {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        },

        /**
         * Define la estructura inicial del estado.
         */
        getInitialState: () => ({
            fields: {
                fecha: '',
                placa: '',
                marca: '',
                linea: '',
                modelo: '',
                color: '',
                tipoCliente: '',
                cilindraje: '',
                vin: '',
                nombreCompleto: ''
            },
            quoteItems: [],
            naItems: [],
            verifiedRepuestos: [],
            photosDownloaded: false,
            emailOpened: false,
            photosDownloadedFor: ''
        }),

        /**
         * Guarda el estado completo en LocalStorage.
         */
        saveState: (state) => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            } catch (error) {
                console.error('Error al guardar en LocalStorage:', error);
            }
        },

        /**
         * Limpia el estado de la cotización actual.
         */
        clearState: () => {
            localStorage.removeItem(STORAGE_KEY);
        },

        /**
         * Obtiene la placa actual del estado.
         */
        getPlate: () => {
            const state = AppStorage.getState();
            return (state.fields?.placa || '').trim().toUpperCase();
        },

        /**
         * Actualiza solo los campos del vehículo.
         */
        updateFields: (fields) => {
            const state = AppStorage.getState();
            state.fields = { ...state.fields, ...fields };
            AppStorage.saveState(state);
        },

        /**
         * Actualiza la lista de ítems de la cotización.
         */
        updateQuoteItems: (items) => {
            const state = AppStorage.getState();
            state.quoteItems = items;
            AppStorage.saveState(state);
        },

        /**
         * Obtiene los ítems N/A (que no requieren foto).
         */
        getNaIds: () => {
            const state = AppStorage.getState();
            return new Set(Array.isArray(state.naItems) ? state.naItems : []);
        },

        /**
         * Actualiza el estado de descarga de fotos.
         */
        setPhotosDownloaded: (status) => {
            const state = AppStorage.getState();
            state.photosDownloaded = !!status;
            AppStorage.saveState(state);
        },

        /**
         * Actualiza el estado de correo abierto.
         */
        setEmailOpened: (status) => {
            const state = AppStorage.getState();
            state.emailOpened = !!status;
            AppStorage.saveState(state);
        },

        // --- Gestión de IndexedDB (Fotos) ---

        /**
         * Abre la conexión a IndexedDB.
         */
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

        /**
         * Guarda una foto en la base de datos.
         */
        savePhoto: async (photoData) => {
            const db = await AppStorage.openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put({
                    ...photoData,
                    createdAt: photoData.createdAt || Date.now()
                });
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        },

        /**
         * Obtiene todas las fotos asociadas a una placa.
         */
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

        /**
         * Elimina una foto por su ID.
         */
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

        /**
         * Elimina todas las fotos de una placa específica.
         */
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
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    }
                };
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
        }
    };

    window.AppStorage = AppStorage;

})(window);
