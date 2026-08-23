/* =========================================================================
   voice.js - Dictado por voz para registro de repuestos
   -------------------------------------------------------------------------
   Requiere: window.CoticarVoice (expuesto por script.js)
   Navegadores: Chrome / Edge (Web Speech API). Idioma: es-ES.
   Uso: pulsa 🎤 una vez, deja el celular cerca, y di:
     "escribe parachoques delantero uno cambio pintura"
     "borrar ultimo registro"   -> elimina la última pieza
     "parar" / "detener" / "apagar" -> detiene el dictado
   El cajón de transcripción muestra en vivo lo que se dice.
   ========================================================================= */
(function () {
    'use strict';

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    const voiceBtn = document.getElementById('voiceBtn');
    const voiceStatus = document.getElementById('voiceStatus');
    const voiceDrawer = document.getElementById('voiceDrawer');

    if (!SpeechRecognition) {
        if (voiceBtn) {
            voiceBtn.disabled = true;
            voiceBtn.title = 'Dictado por voz no disponible. Usa Chrome o Edge.';
            if (voiceStatus) voiceStatus.textContent = 'Dictado por voz no disponible. Usa Chrome o Edge.';
        }
        if (voiceDrawer) voiceDrawer.textContent = 'Tu navegador no soporta el dictado por voz. Abre esta página en Chrome o Edge.';
        return;
    }
    if (!voiceBtn || !voiceDrawer) return;

    // El API (window.CoticarVoice) lo crea script.js dentro de DOMContentLoaded.
    // Lo usamos de forma perezosa vía retryRegister() para no depender del orden
    // exacto de carga de los scripts.

    // ---- Estado interno ----
    let recognition = null;
    let listening = false;
    let restartPending = false;
    let lastInterim = '';
    let lastText = '';
    let lastInterimPhrase = '';

    // Buffer para reconstruir la frase completa: la escucha continua divide
    // una frase en varios resultados finales, así que los acumulamos hasta
    // detectar el final de la enunciación y luego registramos la pieza entera.
    let pendingBuffer = '';
    let escOpen = false;
    let commitTimer = null;
    let commitLockUntil = 0;
    let lastRegisteredPhrase = '';
    let lastRegisteredAt = 0;
    let awaitingPiece = false;
    let pieceWaitTimer = null;

    // ---- Utilidades de texto ----
    // Normaliza: minúsculas, sin acentos, espacios colapsados.
    const norm = (s) => (s || '')
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ').trim();

    // Texto limpio para PARSEAR: además de lo anterior, elimina toda
    // puntuación (comas, puntos, guiones...) para que "cambio,", "uno.",
    // "delantero," no rompan la detección de palabras clave.
    const cleanText = (s) => norm(s)
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const normalizeVoiceTerms = (s) => cleanText(s)
        .replace(/\bsuerte\b/g, 'fuerte');

    const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

    // Quita la primera aparición de cada palabra (para construir la descrip).
    const removeWords = (words, toRemove) => {
        toRemove.forEach((w) => {
            const i = words.indexOf(w);
            if (i !== -1) words.splice(i, 1);
        });
    };

    // ---- Números hablados -> cantidad ----
    const NUMBER_MAP = {
        uno: '1', una: '1', un: '1',
        dos: '2', tres: '3', cuatro: '4', cinco: '5',
        seis: '6', siete: '7', ocho: '8', nueve: '9', diez: '10'
    };

    // ---- Normaliza la transcripción para entender laterales habladas ----
    // Convierte "ele ache", "ele hache", "lijey" -> LH ; "erre ache"/"erre hache" -> RH
    const normalizeLateral = (s) => s
        .replace(/\bele\s+a(?:ch|q)e\b/g, 'lh')
        .replace(/\bele\s+hache\b/g, 'lh')
        .replace(/\bele\s+ja(?:ch|q)e\b/g, 'lh')
        .replace(/\be\s+l\s+a(?:ch|q)e\b/g, 'lh')
        .replace(/\berr\s+a(?:ch|q)e\b/g, 'rh')
        .replace(/\bere\s+hache\b/g, 'rh')
        .replace(/\berre\s+hache\b/g, 'rh')
        .replace(/\berre\s+a(?:ch|q)e\b/g, 'rh');

    // ---- Fusión de palabras compuestas mal divididas ----
    // El reconocimiento a veces parte en dos una palabra compuesta:
    //   "para choques"  -> "parachoques"
    //   "con puerta"    -> "compuerta"
    //   "con puertas"   -> "compuertas"
    //   "guarda barros" -> "guardabarros"
    //   "para brisas"   -> "parabrisas"
    const SPLIT_MERGES = [
        { from: ['para', 'choques'], to: 'parachoques' },
        { from: ['para', 'choque'], to: 'parachoques' },
        { from: ['para', 'choquet'], to: 'parachoques' },
        { from: ['con', 'puerta'], to: 'compuerta' },
        { from: ['con', 'puertas'], to: 'compuertas' },
        { from: ['guarda', 'barros'], to: 'guardabarros' },
        { from: ['para', 'brisas'], to: 'parabrisas' },
        { from: ['retro', 'visor'], to: 'retrovisor' },
        { from: ['retro', 'visores'], to: 'retrovisores' },
        { from: ['guarda', 'fangos'], to: 'guardafangos' }
    ];
    function mergeCompoundWords(words) {
        const out = [];
        let i = 0;
        while (i < words.length) {
            let merged = null;
            if (i + 1 < words.length) {
                for (const rule of SPLIT_MERGES) {
                    if (words[i] === rule.from[0] && words[i + 1] === rule.from[1]) {
                        merged = rule.to;
                        break;
                    }
                }
            }
            if (merged) { out.push(merged); i += 2; }
            else { out.push(words[i]); i += 1; }
        }
        return out;
    }

    // ---- Parser de la frase después de "escribe" ----
    // Recibe el texto ya limpio (sin puntuación).
    function parseVoicePhrase(phrase) {
        // Fusiona compuestos ("para choques" -> "parachoques") y normaliza
        // laterales antes de partir en palabras y buscar palabras clave.
        let n = normalizeLateral(normalizeVoiceTerms(phrase));
        let words = n.split(' ').filter(Boolean);
        words = mergeCompoundWords(words);
        n = words.join(' ');

        const result = {
            descrip: '', cant: '1', dym: '', estado: '', pint: '', dat: '',
            raw: phrase.trim().replace(/\s+/g, ' ')
        };

        // --- estado ---
        const estadoRules = [
            { kws: ['cambio', 'cambiar', 'se cambia'], v: 'CAMBIO' },
            { kws: ['fuerte', 'dano mayor'], v: 'FUERTE' },
            { kws: ['medio'], v: 'MEDIO' },
            { kws: ['leve', 'lebe'], v: 'LEVE' },
            { kws: ['recuperacion'], v: 'RECUPERACION' }
        ];
        outerEstado: for (const rule of estadoRules) {
            for (const kw of rule.kws) {
                if (words.includes(kw)) { result.estado = rule.v; removeWords(words, rule.kws); break outerEstado; }
            }
        }

        // --- pintura ---
        if (n.includes('sin pintura') || n.includes('pintura no') || n.includes('no pintura') || n.includes('no pintar')) {
            result.pint = 'No';
            removeWords(words, ['pintura', 'no', 'pintar', 'sin']);
        } else if (n.includes('pintura') || n.includes('pintar') || n.includes('pintado') || n.includes('pintada')) {
            result.pint = 'Si';
            removeWords(words, ['pintura', 'pintar', 'pintado', 'pintada']);
        }

        // --- dym ---
        // Regla del taller: las piezas de CAMBIO siempre se desmontan y montan
        // (DYM = Si), salvo que se diga explícitamente "dym no".
        const dymNo = n.includes('dym no') || n.includes('no dym');
        const dymYes = dymNo || n.includes('dym') || n.includes('desmonta y monta') || n.includes('desmontar y montar');
        if (result.estado === 'CAMBIO' || dymYes) {
            result.dym = dymNo ? 'No' : 'Si';
        }
        removeWords(words, ['dym', 'desmonta', 'monta', 'desmontar', 'montar']);

        // --- cantidad: SIEMPRE es un número, se extrae y se quita de la descripción ---
        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            if (NUMBER_MAP[w]) { result.cant = NUMBER_MAP[w]; words.splice(i, 1); i--; break; }
            if (/^\d+$/.test(w)) { result.cant = w; words.splice(i, 1); i--; break; }
            if (/^x\d+$/.test(w)) { result.cant = w.slice(1); words.splice(i, 1); i--; break; }
        }

        // --- descrip: lo que queda (palabras de pieza + lateral), sin números ---
        // Quita números residuales y cuantificadores que el navegador pueda
        // dejar ("uno/a/un/dos...") aunque la cantidad ya se haya extraído.
        removeWords(words, ['si', 'no', 'una', 'un', 'uno', 'dos', 'tres', 'cuatro']);
        const mapped = words.map((w) => (w === 'lh' ? 'LH' : w === 'rh' ? 'RH' : w));
        result.descrip = cap(mapped.join(' '));

        return result;
    }

    // ---- Detección de comandos globales ----
    const isStopCommand = (n) => /(?:^|\s)(?:escribe\s+)?(?:parar|detener|apagar|parate|detente|para el dictado|detener dictado|apagar dictado)\b/.test(n);
    const isDeleteCommand = (n) => /borra?r\s+(?:el\s+)?ultimo\s+registro|borra?r\s+el\s+registro|elimina?r?\s+(?:el\s+)?ultimo|quita?r?\s+(?:el\s+)?ultimo|borra?r\s+ultimo/.test(n);

    // ---- Manejo del buffer de frase ----
    // Como la escucha continua parte la frase en varios segmentos finales,
    // acumulamos las palabras hasta que pasa un instante sin audio nuevo
    // (debouncing) y recién entonces registramos la pieza completa.
    function appendUnique(buffer, n) {
        const bufWords = (buffer || '').split(' ').filter(Boolean);
        const nWords = n.split(' ').filter(Boolean);
        if (!bufWords.length) return nWords.join(' ');
        if (!nWords.length) return bufWords.join(' ');

        // Chrome puede devolver el final anterior junto con el nuevo.
        // Conservamos la mayor coincidencia entre el final del buffer y el
        // inicio del resultado para no repetir ni perder palabras.
        let overlap = Math.min(bufWords.length, nWords.length);
        while (overlap > 0) {
            const bufferTail = bufWords.slice(-overlap).join(' ');
            const resultHead = nWords.slice(0, overlap).join(' ');
            if (bufferTail === resultHead) break;
            overlap--;
        }
        return bufWords.concat(nWords.slice(overlap)).join(' ');
    }

    function commitBuffer() {
        if (commitTimer) { clearTimeout(commitTimer); commitTimer = null; }
        if (!escOpen || !pendingBuffer) { pendingBuffer = ''; escOpen = false; return; }
        const n = cleanText(pendingBuffer);
        const m = n.match(/^escribe\b(.*)$/);
        if (m && m[1].trim()) {
            handleRegister(m[1].trim());
        } else {
            // "escribe" solo (sin pieza): no registramos nada.
            appendDrawer('Solo se escuchó "escribe". Repítelo indicando la pieza.', 'voice-warn');
            playErrorTone();
        }
        pendingBuffer = '';
        escOpen = false;
        commitLockUntil = Date.now() + 800;
    }

    // Si aún no viene la pieza (solo "escribe"), esperamos más tiempo para que
    // llegue el nombre del repuesto; si ya hay contenido, el plazo es más corto.
    function commitDelayFor(buffer) {
        const n = normalizeVoiceTerms(buffer || '');
        const m = n.match(/^escribe\b(.*)$/);
        if (m && !m[1].trim()) return 4000;
        const hasCompletionData = /\b(?:cambio|cambiar|fuerte|suerte|medio|leve|lebe|recuperacion|pintura|pintar|pintado|pintada|dym)\b/.test(n);
        return hasCompletionData ? 1800 : 6000;
    }

    function scheduleCommit() {
        if (commitTimer) clearTimeout(commitTimer);
        commitTimer = setTimeout(commitBuffer, commitDelayFor(pendingBuffer));
    }

    // ---- Procesar un resultado final ----
    // SOLO se registra lo que comience con la palabra "escribe".
    // Cualquier otra voz/ruido ambiental se ignora en silencio.
    function processFinal(normedFinal) {
        const n = normalizeVoiceTerms(normedFinal);
        if (isStopCommand(n)) { cancelBuffer(); handleStop(); return; }
        if (isDeleteCommand(n)) { cancelBuffer(); handleDelete(); return; }

        const m = n.match(/^escribe\b(.*)$/);
        if (m) {
            if (m[1].trim()) {
                awaitingPiece = false;
                if (pieceWaitTimer) clearTimeout(pieceWaitTimer);
                handleRegister(m[1].trim());
            } else {
                awaitingPiece = true;
                if (pieceWaitTimer) clearTimeout(pieceWaitTimer);
                pieceWaitTimer = setTimeout(() => {
                    awaitingPiece = false;
                    appendDrawer('No se recibió el repuesto después de "escribe".', 'voice-warn');
                    playErrorTone();
                }, 5000);
                setDrawer('Escuchando el nombre del repuesto...', 'voice-live');
            }
            return;
        }

        if (awaitingPiece) {
            awaitingPiece = false;
            if (pieceWaitTimer) clearTimeout(pieceWaitTimer);
            handleRegister(n);
            return;
        }

        // Ignora voz ambiental: cada pieza debe comenzar con "escribe".
        setDrawer('Escuchando... di "escribe" y luego el repuesto.', '');
    }

    function cancelBuffer() {
        if (commitTimer) { clearTimeout(commitTimer); commitTimer = null; }
        if (pieceWaitTimer) { clearTimeout(pieceWaitTimer); pieceWaitTimer = null; }
        pendingBuffer = '';
        escOpen = false;
        awaitingPiece = false;
    }
// ---- Feedback sonoro (beep) ----
    // Usamos UN SOLO AudioContext reutilizable (singleton) y lo reanudamos
    // cuando el navegador lo tiene suspendido. Crear un contexto por beep
    // agota el audio del móvil y hace que deje de sonar ("se pega").
    let audioCtx = null;
    function ensureAudioRunning() {
        return new Promise((resolve) => {
            try {
                if (!audioCtx) {
                    const Ctx = window.AudioContext || window.webkitAudioContext;
                    audioCtx = new Ctx();
                }
                if (audioCtx.state === 'running') { resolve(); return; }
                // Suspended (autoplay policy): reanudamos y esperamos.
                const done = () => { audioCtx.removeEventListener('statechange', done); resolve(); };
                audioCtx.addEventListener('statechange', done);
                audioCtx.resume().catch(() => {});
                // Resguardo por si nunca cambia de estado.
                setTimeout(done, 400);
            } catch (e) { resolve(); }
        });
    }

    // Reproduce una nota simple o un arpegio corto, de forma segura.
    // Asegura que el contexto esté corriendo antes de programar el sonido,
    // para que el beep no se pierda (el contexto arranca suspendido).
    function tone(freq, dur, atSeconds) {
        ensureAudioRunning().then(() => {
            try {
                const ctx = audioCtx;
                const now = ctx.currentTime;
                const t0 = (atSeconds || 0);
                const startAt = now + t0;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.0001, startAt);
                gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(startAt);
                osc.stop(startAt + dur + 0.02);
                osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch (e) {} };
            } catch (e) { /* ignorar */ }
        });
    }

    // Un único beep de aviso.
    function playBeep(freq, duration) { tone(freq, duration, 0); }
    const playFeedback = playBeep;

    // Tono de éxito claro (ascendente): dos notas sobre el mismo contexto.
    function playSuccessTone() {
        tone(660, 0.12, 0);
        tone(880, 0.16, 0.12);
    }

    // Tono de error (descendente, grave): avisa que NO quedó registrado,
    // para que se sepa que hay que repetir la solicitud.
    function playErrorTone() {
        tone(300, 0.16, 0);
        tone(200, 0.2, 0.16);
    }

    // ---- Cajon de transcripcion ----
    function setDrawer(text, cls) {
        voiceDrawer.textContent = text || '';
        voiceDrawer.className = 'voice-drawer ' + (cls || '');
    }
    function appendDrawer(text, cls) {
        if (!text) return;
        const line = document.createElement('div');
        line.className = 'voice-line ' + (cls || '');
        line.textContent = text;
        voiceDrawer.appendChild(line);
        voiceDrawer.scrollTop = voiceDrawer.scrollHeight;
        while (voiceDrawer.firstChild && voiceDrawer.childNodes.length > 60) {
            voiceDrawer.removeChild(voiceDrawer.firstChild);
        }
    }
    function clearInterim() {
        lastInterim = '';
        lastInterimPhrase = '';
    }

    // ---- Resaltar la ultima fila agregada ----
    function highlightLastRow() {
        const tbody = document.querySelector('#itemsTable tbody');
        if (!tbody) return;
        const rows = tbody.querySelectorAll('tr');
        if (!rows.length) return;
        const last = rows[rows.length - 1];
        last.classList.add('row-flash');
        setTimeout(() => last.classList.remove('row-flash'), 1600);
    }

    // ---- Acciones ----
    function handleStop() {
        stopListening();
        appendDrawer('Dictado detenido.', 'voice-ok');
        playFeedback(880, 0.12);
        clearInterim();
    }

    function handleDelete() {
        const api = window.CoticarVoice || null;
        const ok = api && api.removeLast ? api.removeLast() : false;
        appendDrawer(ok ? 'Ultimo registro borrado.' : 'No hay registros para borrar.', ok ? 'voice-ok' : 'voice-warn');
        playFeedback(380, 0.15);
        clearInterim();
    }

    function handleRegister(phrase) {
        const normalizedPhrase = normalizeVoiceTerms(phrase);
        if (normalizedPhrase === lastRegisteredPhrase && Date.now() - lastRegisteredAt < 3000) {
            return;
        }
        lastRegisteredPhrase = normalizedPhrase;
        lastRegisteredAt = Date.now();

        // Parseamos primero (no requiere el API de script.js).
        const item = parseVoicePhrase(normalizedPhrase);
        if (!item.descrip) {
            appendDrawer('No entendi la pieza. Ej.: "escribe parachoques delantero uno cambio pintura".', 'voice-warn');
            playErrorTone();
            return;
        }
        // Intentamos registrar, reintentando unos instantes por si el puente
        // (window.CoticarVoice) aún se está creando durante la carga inicial.
        retryRegister(item, 12, 200);
    }

    // Reintenta obtener el API y registrar, hasta 12 veces cada 200 ms (~2.4 s).
    function retryRegister(item, tries, delay) {
        const api = window.CoticarVoice;
        if (api) {
            doRegister(item, api);
            return;
        }
        if (tries <= 0) {
            appendDrawer('No se pudo registrar (la página aún no termina de cargar). Refresca y vuelve a intentarlo.', 'voice-err');
            playFeedback(260, 0.15);
            return;
        }
        setTimeout(() => retryRegister(item, tries - 1, delay), delay);
    }

    function doRegister(item, api) {
        const ok = api.register(item);
        if (ok) {
            const extra = [item.estado, item.pint && 'Pintura ' + item.pint, item.dym && 'DYM ' + item.dym]
                .filter(Boolean).join(' · ');
            appendDrawer('Registrado: ' + item.descrip + ' (x' + item.cant + ')' + (extra ? ' — ' + extra : ''), 'voice-ok');
            highlightLastRow();
            playSuccessTone();
        } else {
            appendDrawer('Error al registrar.', 'voice-err');
            playErrorTone();
        }
        clearInterim();
    }

    function createRecognition() {
        const rec = new SpeechRecognition();
        rec.lang = 'es-ES';
        rec.continuous = false;
        rec.interimResults = false;
        rec.maxAlternatives = 1;
rec.onstart = () => {
            listening = true;
            setStatus();
            setDrawer(awaitingPiece ? 'Escuchando el nombre del repuesto...' : 'Escuchando... di "escribe" y luego el repuesto.', '');
            clearInterim();
        };

        rec.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const res = event.results[i];
                const text = res[0].transcript;
                if (res.isFinal) {
                    processFinal(text);
                }
            }
        };

        rec.onerror = (event) => {
            const err = event.error;
            if (err === 'not-allowed' || err === 'service-not-allowed') {
                listening = false;
                setStatus();
                setDrawer('Sin permiso de microfono. Pulsa 🎤 y acepta el permiso.', 'voice-warn');
                return;
            }
            if (err === 'no-speech' || err === 'aborted' || err === 'audio-capture') {
                if (listening) scheduleRestart();
            }
        };

        rec.onend = () => {
            if (listening) scheduleRestart(); else setStatus();
        };

        return rec;
    }

    function scheduleRestart() {
        if (restartPending) return;
        restartPending = true;
        setTimeout(() => {
            restartPending = false;
            if (!listening) return;
            try { (recognition = recognition || createRecognition()).start(); } catch (e) { /* ya iniciado */ }
        }, 350);
    }

    function setStatus() {
        if (listening) {
            voiceStatus.textContent = 'Escuchando... (di "parar" para detener)';
            voiceBtn.classList.add('is-listening');
            voiceBtn.textContent = '⏹';
            voiceBtn.title = 'Detener dictado por voz';
        } else {
            voiceStatus.textContent = 'Dictado por voz activado. Pulsa para escuchar.';
            voiceBtn.classList.remove('is-listening');
            voiceBtn.textContent = '🎤';
            voiceBtn.title = 'Iniciar dictado por voz';
        }
    }

    function startListening() {
        if (listening) return;
        recognition = recognition || createRecognition();
        listening = true;
        setStatus();
        setDrawer('Escuchando... di "escribe parachoques delantero uno cambio pintura".', '');
        try { recognition.start(); } catch (e) { /* ya inicio; onend lo reiniciara */ }
    }

    function stopListening() {
        listening = false;
        restartPending = false;
        setStatus();
        if (recognition) { try { recognition.stop(); } catch (e) { /* ignorar */ } }
    }

    // ---- Boton principal ----
    voiceBtn.addEventListener('click', () => {
        if (listening) stopListening(); else startListening();
    });

    setStatus();
})();