/**
 * ============================================================================
 * ElectroBot — Núcleo Modular de JavaScript (app.js)
 * Curso: Fundamentos de JavaScript — Cisco Networking Academy (5°A)
 * ============================================================================
 * Funcionalidades incluidas:
 *  1. Manejo estructurado de errores y excepciones (ElectroBotError + try/catch).
 *  2. Sistema de logueo con 3 cuentas diferenciadas (preferencias, récords de
 *     minijuegos y datos bancarios simulados con movimientos).
 *  3. Sincronización de modo claro/oscuro, dificultad preferida y audio Web Audio.
 *  4. Buscador/filtro del catálogo de componentes y editor de los 4 creadores.
 *  5. Chatbot educativo ampliado con saneamiento seguro de entradas (anti-XSS).
 *  6. Formulario de satisfacción del cliente con validación y persistencia local.
 */

/* ============================================================================
   1. CLASE DE EXCEPCIÓN PERSONALIZADA Y UTILIDADES SEGURAS
   ============================================================================ */

/**
 * Excepción controlada para validaciones de negocio y entradas de usuario.
 */
class ElectroBotError extends Error {
    constructor(message, code = "VALIDATION_ERROR") {
        super(message);
        this.name = "ElectroBotError";
        this.code = code;
    }
}

/**
 * Escapa caracteres especiales HTML para prevenir inyección de código (XSS).
 * @param {string} texto
 * @returns {string}
 */
function escapeHTML(texto) {
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Lee un valor JSON desde localStorage protegiendo contra errores de cuota o JSON corrupto.
 * @param {string} clave
 * @param {*} valorPorDefecto
 */
function leerStorageSeguro(clave, valorPorDefecto) {
    try {
        const datoCrudo = localStorage.getItem(clave);
        if (!datoCrudo) return structuredClone(valorPorDefecto);
        return JSON.parse(datoCrudo);
    } catch (error) {
        console.warn(`[ElectroBot] Error leyendo "${clave}" en localStorage:`, error);
        return structuredClone(valorPorDefecto);
    }
}

/**
 * Guarda un valor JSON en localStorage dentro de un bloque try/catch.
 * @param {string} clave
 * @param {*} valor
 */
function guardarStorageSeguro(clave, valor) {
    try {
        localStorage.setItem(clave, JSON.stringify(valor));
        return true;
    } catch (error) {
        console.error(`[ElectroBot] No se pudo guardar "${clave}":`, error);
        mostrarNotificacion("No se pudo guardar en el navegador (almacenamiento restringido).", "error");
        return false;
    }
}

/**
 * Muestra una notificación flotante temporal respetando las preferencias del usuario.
 * @param {string} mensaje
 * @param {"info"|"success"|"error"} tipo
 * @param {boolean} forzar - Muestra el aviso incluso si las notificaciones están silenciadas
 */
function mostrarNotificacion(mensaje, tipo = "info", forzar = false) {
    try {
        const usuario = obtenerUsuarioActivo();
        if (!forzar && usuario && usuario.preferencias && usuario.preferencias.notificaciones === false) {
            return;
        }

        let contenedor = document.getElementById("toastContainer");
        if (!contenedor) {
            contenedor = document.createElement("div");
            contenedor.id = "toastContainer";
            contenedor.className = "toast-container";
            document.body.appendChild(contenedor);
        }

        const toast = document.createElement("div");
        toast.className = `toast toast-${tipo}`;
        toast.textContent = mensaje;
        contenedor.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3400);
    } catch (error) {
        console.error("[ElectroBot] Error mostrando notificación:", error);
    }
}

/**
 * Sintetiza un tono breve usando Web Audio API para retroalimentación de minijuegos.
 * @param {number} frecuencia - Frecuencia en Hz
 * @param {number} duracion - Duración en segundos
 * @param {"sine"|"triangle"|"square"} tipoOnda
 */
function reproducirTono(frecuencia = 520, duracion = 0.14, tipoOnda = "sine") {
    try {
        const usuario = obtenerUsuarioActivo();
        if (usuario && usuario.preferencias && usuario.preferencias.sonido === false) {
            return;
        }
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = new AudioCtx();
        const oscilador = ctx.createOscillator();
        const ganancia = ctx.createGain();

        oscilador.type = tipoOnda;
        oscilador.frequency.setValueAtTime(frecuencia, ctx.currentTime);
        ganancia.gain.setValueAtTime(0.08, ctx.currentTime);
        ganancia.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duracion);

        oscilador.connect(ganancia);
        ganancia.connect(ctx.destination);
        oscilador.start();
        oscilador.stop(ctx.currentTime + duracion);
    } catch (error) {
        // Silencioso si el navegador bloquea el audio antes de la interacción
        console.debug("[ElectroBot] Audio omitido:", error.message);
    }
}

/* ============================================================================
   2. DATOS BASE DE LAS 3 CUENTAS DIFERENCIADAS Y GESTIÓN DE SESIÓN
   ============================================================================ */

const CLAVE_CUENTAS = "electrobot_cuentas_v2";
const CLAVE_SESION = "electrobot_sesion_activa_v2";
const CLAVE_TEMA_INVITADO = "electrobot_tema_invitado";
const CLAVE_ENCUESTAS = "electrobot_encuestas_v2";

const NOMBRES_JUEGOS = {
    laberinto: "🌀 Laberinto Eléctrico",
    memoria: "🧠 Memoria Electrónica",
    codigoColores: "🎨 Código de Colores",
    detectaError: "⚠️ Detecta el Error",
    atrapaElectrones: "⚡ Atrapa Electrones",
    reaccionLed: "⏱️ Reacción del LED",
    ordenaCircuito: "🔢 Ordena el Circuito",
    armaCircuito: "🧩 Arma el Circuito"
};

/**
 * Tres perfiles diferenciados listos para demostrar preferencias, récords
 * y datos bancarios simulados en la exposición del curso NetAcad.
 */
const CUENTAS_POR_DEFECTO = {
    "sergio@electrobot.edu.pe": {
        id: "user-sergio",
        email: "sergio@electrobot.edu.pe",
        password: "electro123",
        nombre: "Sergio Ramos",
        rol: "Estudiante 5°A",
        avatar: "S",
        preferencias: {
            tema: "light",
            dificultad: "normal",
            sonido: true,
            notificaciones: true
        },
        records: {
            laberinto: { valor: 42, texto: "42 s (Normal)" },
            memoria: { valor: 5, texto: "Nivel 5" },
            codigoColores: { valor: 70, texto: "70 pts" },
            detectaError: { valor: 5, texto: "5 aciertos" },
            atrapaElectrones: { valor: 14, texto: "14 cargas" },
            reaccionLed: { valor: 315, texto: "315 ms" },
            ordenaCircuito: { valor: 3, texto: "3 circuitos" },
            armaCircuito: { valor: 2, texto: "2 circuitos" }
        },
        bancoSimulado: {
            entidad: "BCP Simulado — Estudiantil",
            titular: "Sergio Ramos (Estudiante)",
            tipoCuenta: "Cuenta Ahorro Taller",
            numeroEnmascarado: "•••• •••• •••• 4821",
            moneda: "S/",
            saldo: 185.50,
            movimientos: [
                { fecha: "22/11/2026", concepto: "Beca de Taller de Electrónica", monto: 120.00 },
                { fecha: "23/11/2026", concepto: "Kit LEDs + Resistencias 220 Ω", monto: -24.50 },
                { fecha: "24/11/2026", concepto: "Protoboard 830 puntos", monto: -18.00 }
            ]
        }
    },
    "camila@electrobot.edu.pe": {
        id: "user-camila",
        email: "camila@electrobot.edu.pe",
        password: "taller2026",
        nombre: "Camila Torres",
        rol: "Técnica de Taller",
        avatar: "C",
        preferencias: {
            tema: "dark",
            dificultad: "dificil",
            sonido: true,
            notificaciones: true
        },
        records: {
            laberinto: { valor: 26, texto: "26 s (Difícil)" },
            memoria: { valor: 9, texto: "Nivel 9" },
            codigoColores: { valor: 130, texto: "130 pts" },
            detectaError: { valor: 8, texto: "8 aciertos" },
            atrapaElectrones: { valor: 29, texto: "29 cargas" },
            reaccionLed: { valor: 218, texto: "218 ms" },
            ordenaCircuito: { valor: 6, texto: "6 circuitos" },
            armaCircuito: { valor: 5, texto: "5 circuitos" }
        },
        bancoSimulado: {
            entidad: "Interbank Simulado — Maker",
            titular: "Camila Torres (Técnica)",
            tipoCuenta: "Cuenta Proyectos IoT",
            numeroEnmascarado: "•••• •••• •••• 7394",
            moneda: "S/",
            saldo: 1420.00,
            movimientos: [
                { fecha: "20/11/2026", concepto: "Asesoría de prototipo ESP32", monto: 450.00 },
                { fecha: "22/11/2026", concepto: "Compra sensores ultrasónicos HC-SR04", monto: -85.00 },
                { fecha: "24/11/2026", concepto: "Módulos Relé y Servomotores SG90", monto: -95.00 }
            ]
        }
    },
    "profesor@electrobot.edu.pe": {
        id: "user-profesor",
        email: "profesor@electrobot.edu.pe",
        password: "netacad5a",
        nombre: "Prof. José Carlos",
        rol: "Docente Evaluador",
        avatar: "J",
        preferencias: {
            tema: "light",
            dificultad: "facil",
            sonido: false,
            notificaciones: true
        },
        records: {
            laberinto: { valor: 35, texto: "35 s (Fácil)" },
            memoria: { valor: 6, texto: "Nivel 6" },
            codigoColores: { valor: 100, texto: "100 pts" },
            detectaError: { valor: 7, texto: "7 aciertos" },
            atrapaElectrones: { valor: 18, texto: "18 cargas" },
            reaccionLed: { valor: 275, texto: "275 ms" },
            ordenaCircuito: { valor: 4, texto: "4 circuitos" },
            armaCircuito: { valor: 3, texto: "3 circuitos" }
        },
        bancoSimulado: {
            entidad: "BBVA Simulado — Laboratorio",
            titular: "Prof. José Carlos (Docente)",
            tipoCuenta: "Fondo Equipamiento 5°A",
            numeroEnmascarado: "•••• •••• •••• 9105",
            moneda: "S/",
            saldo: 3850.75,
            movimientos: [
                { fecha: "18/11/2026", concepto: "Asignación Fondo Laboratorio Escolar", monto: 2500.00 },
                { fecha: "21/11/2026", concepto: "Multímetros Digitales (x6)", monto: -420.00 },
                { fecha: "25/11/2026", concepto: "Kits Arduino UNO para 5°A", monto: -310.25 }
            ]
        }
    }
};

/**
 * Obtiene el diccionario completo de cuentas desde localStorage o lo inicializa.
 */
function obtenerTodasLasCuentas() {
    const cuentasGuardadas = leerStorageSeguro(CLAVE_CUENTAS, null);
    if (!cuentasGuardadas || typeof cuentasGuardadas !== "object") {
        guardarStorageSeguro(CLAVE_CUENTAS, CUENTAS_POR_DEFECTO);
        return structuredClone(CUENTAS_POR_DEFECTO);
    }
    // Garantiza que las 3 cuentas obligatorias siempre existan
    let actualizado = false;
    Object.keys(CUENTAS_POR_DEFECTO).forEach((email) => {
        if (!cuentasGuardadas[email]) {
            cuentasGuardadas[email] = structuredClone(CUENTAS_POR_DEFECTO[email]);
            actualizado = true;
        }
    });
    if (actualizado) {
        guardarStorageSeguro(CLAVE_CUENTAS, cuentasGuardadas);
    }
    return cuentasGuardadas;
}

/**
 * Devuelve el objeto completo del usuario con sesión activa, o null si es invitado.
 */
function obtenerUsuarioActivo() {
    try {
        const emailActivo = localStorage.getItem(CLAVE_SESION);
        if (!emailActivo) return null;
        const cuentas = obtenerTodasLasCuentas();
        return cuentas[emailActivo] || null;
    } catch (error) {
        console.warn("[ElectroBot] No se pudo verificar sesión:", error);
        return null;
    }
}

/**
 * Persiste cambios en una cuenta específica.
 * @param {object} cuentaActualizada
 */
function guardarCuenta(cuentaActualizada) {
    const cuentas = obtenerTodasLasCuentas();
    cuentas[cuentaActualizada.email] = cuentaActualizada;
    guardarStorageSeguro(CLAVE_CUENTAS, cuentas);
}

/**
 * Valida credenciales e inicia sesión con manejo explícito de excepciones.
 * @param {string} email
 * @param {string} password
 */
function iniciarSesion(email, password) {
    const correoLimpio = String(email || "").trim().toLowerCase();
    const claveLimpia = String(password || "").trim();

    if (!correoLimpio || !claveLimpia) {
        throw new ElectroBotError("Ingresa tu correo electrónico y contraseña para continuar.");
    }

    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexCorreo.test(correoLimpio)) {
        throw new ElectroBotError("El formato del correo electrónico no es válido.");
    }

    const cuentas = obtenerTodasLasCuentas();
    const cuenta = cuentas[correoLimpio];

    if (!cuenta || cuenta.password !== claveLimpia) {
        throw new ElectroBotError("Credenciales incorrectas. Usa una de las 3 cuentas de prueba.");
    }

    localStorage.setItem(CLAVE_SESION, cuenta.email);
    aplicarTemaActual();
    actualizarBotonCuentaNavbar();
    actualizarTarjetasRecordsMinijuegos();
    reproducirTono(660, 0.12);
    mostrarNotificacion(`Sesión iniciada como ${cuenta.nombre} (${cuenta.rol}).`, "success", true);
    return cuenta;
}

/**
 * Cierra la sesión actual de forma limpia y restaura la vista de invitado.
 */
function cerrarSesion() {
    try {
        const usuario = obtenerUsuarioActivo();
        localStorage.removeItem(CLAVE_SESION);
        aplicarTemaActual();
        actualizarBotonCuentaNavbar();
        actualizarTarjetasRecordsMinijuegos();
        if (usuario) {
            mostrarNotificacion(`Sesión cerrada correctamente. ¡Hasta pronto, ${usuario.nombre}!`, "info", true);
        }
    } catch (error) {
        console.error("[ElectroBot] Error al cerrar sesión:", error);
    }
}

/* ============================================================================
   3. TEMA CLARO / OSCURO UNIFICADO
   ============================================================================ */

/**
 * Aplica el tema según la cuenta activa o la preferencia de invitado.
 */
function aplicarTemaActual() {
    const usuario = obtenerUsuarioActivo();
    const tema = usuario
        ? usuario.preferencias.tema
        : (localStorage.getItem(CLAVE_TEMA_INVITADO) || "light");

    if (tema === "dark") {
        document.body.classList.add("dark-mode");
    } else {
        document.body.classList.remove("dark-mode");
    }

    const botonesTema = document.querySelectorAll("#themeButton, #themeToggle");
    botonesTema.forEach((btn) => {
        btn.textContent = tema === "dark" ? "☀️" : "🌙";
        btn.setAttribute("aria-label", tema === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
    });
}

/**
 * Alterna entre modo claro y oscuro, guardándolo en la cuenta activa si existe.
 */
function alternarTema() {
    const seraOscuro = !document.body.classList.contains("dark-mode");
    const nuevoTema = seraOscuro ? "dark" : "light";

    const usuario = obtenerUsuarioActivo();
    if (usuario) {
        usuario.preferencias.tema = nuevoTema;
        guardarCuenta(usuario);
    } else {
        try {
            localStorage.setItem(CLAVE_TEMA_INVITADO, nuevoTema);
        } catch (error) {
            console.warn("[ElectroBot] No se pudo guardar tema:", error);
        }
    }

    aplicarTemaActual();
    renderizarContenidoModalCuenta();
}

/* ============================================================================
   4. INTERFAZ GLOBAL DE LOGUEO Y PERFIL (3 PESTAÑAS)
   ============================================================================ */

/**
 * Actualiza el texto y estado del botón de cuenta en la barra de navegación.
 */
function actualizarBotonCuentaNavbar() {
    const btn = document.getElementById("authNavButton");
    if (!btn) return;

    const usuario = obtenerUsuarioActivo();
    if (usuario) {
        btn.classList.add("logged-in");
        btn.textContent = `👤 ${usuario.nombre.split(" ")[0]}`;
        btn.title = `Cuenta activa: ${usuario.nombre} (${usuario.rol})`;
    } else {
        btn.classList.remove("logged-in");
        btn.textContent = "🔐 Iniciar sesión";
        btn.title = "Inicia sesión para ver preferencias, récords y datos bancarios simulados";
    }
}

/**
 * Inyecta el modal de autenticación y perfil en cualquier página donde no exista.
 */
function inicializarModalCuenta() {
    if (document.getElementById("authModal")) return;

    const modal = document.createElement("div");
    modal.id = "authModal";
    modal.className = "modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
        <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
            <button id="closeAuthModalBtn" class="close-modal" type="button" aria-label="Cerrar">✕</button>
            <div id="authModalBody"></div>
        </div>
    `;

    document.body.appendChild(modal);

    // Eventos de cierre
    document.getElementById("closeAuthModalBtn").addEventListener("click", cerrarModalCuenta);
    modal.addEventListener("click", (event) => {
        if (event.target === modal) cerrarModalCuenta();
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modal.classList.contains("show")) {
            cerrarModalCuenta();
        }
    });

    const navBtn = document.getElementById("authNavButton");
    if (navBtn) {
        navBtn.addEventListener("click", abrirModalCuenta);
    }
}

function abrirModalCuenta() {
    const modal = document.getElementById("authModal");
    if (!modal) return;
    renderizarContenidoModalCuenta();
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function cerrarModalCuenta() {
    const modal = document.getElementById("authModal");
    if (!modal) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

/**
 * Renderiza la ventana de Logueo (si no hay sesión) o el Panel de Mi Cuenta (3 pestañas).
 */
function renderizarContenidoModalCuenta(pestanaActiva = "preferencias") {
    const body = document.getElementById("authModalBody");
    if (!body) return;

    const usuario = obtenerUsuarioActivo();

    if (!usuario) {
        body.innerHTML = `
            <h2 id="authModalTitle">🔐 Iniciar sesión en ElectroBot</h2>
            <p class="modal-subtitle">
                Accede con una de las <strong>3 cuentas diferenciadas</strong> para cargar tus preferencias,
                récords de minijuegos y cuenta bancaria simulada de taller.
            </p>

            <div class="quick-accounts-grid">
                <button type="button" class="quick-account-card" data-demo-email="sergio@electrobot.edu.pe" data-demo-pass="electro123">
                    <strong>🎓 Sergio Ramos</strong>
                    <span>Estudiante 5°A</span>
                    <code>sergio@electrobot.edu.pe</code>
                    <code>Clave: electro123</code>
                </button>
                <button type="button" class="quick-account-card" data-demo-email="camila@electrobot.edu.pe" data-demo-pass="taller2026">
                    <strong>🔧 Camila Torres</strong>
                    <span>Técnica de Taller</span>
                    <code>camila@electrobot.edu.pe</code>
                    <code>Clave: taller2026</code>
                </button>
                <button type="button" class="quick-account-card" data-demo-email="profesor@electrobot.edu.pe" data-demo-pass="netacad5a">
                    <strong>👨‍🏫 Prof. José Carlos</strong>
                    <span>Docente Evaluador</span>
                    <code>profesor@electrobot.edu.pe</code>
                    <code>Clave: netacad5a</code>
                </button>
            </div>

            <form id="loginForm" novalidate>
                <div class="form-group">
                    <label for="loginEmail">Correo electrónico</label>
                    <input id="loginEmail" type="email" placeholder="ejemplo@electrobot.edu.pe" required>
                </div>
                <div class="form-group">
                    <label for="loginPassword">Contraseña</label>
                    <input id="loginPassword" type="password" placeholder="Ingresa tu contraseña" required>
                </div>
                <div id="loginFeedback" class="form-feedback"></div>
                <div class="modal-actions">
                    <button type="button" class="cancel-button" id="cancelLoginBtn">Cancelar</button>
                    <button type="submit" class="save-button">Entrar a mi cuenta</button>
                </div>
            </form>
        `;

        // Acceso rápido con 1 clic para exposición en clase
        body.querySelectorAll(".quick-account-card").forEach((card) => {
            card.addEventListener("click", () => {
                try {
                    const email = card.dataset.demoEmail;
                    const pass = card.dataset.demoPass;
                    iniciarSesion(email, pass);
                    renderizarContenidoModalCuenta("preferencias");
                } catch (error) {
                    const fb = document.getElementById("loginFeedback");
                    if (fb) {
                        fb.textContent = `❌ ${error.message}`;
                        fb.className = "form-feedback show error";
                    }
                }
            });
        });

        document.getElementById("cancelLoginBtn").addEventListener("click", cerrarModalCuenta);
        document.getElementById("loginForm").addEventListener("submit", (event) => {
            event.preventDefault();
            const fb = document.getElementById("loginFeedback");
            try {
                const email = document.getElementById("loginEmail").value;
                const pass = document.getElementById("loginPassword").value;
                iniciarSesion(email, pass);
                renderizarContenidoModalCuenta("preferencias");
            } catch (error) {
                fb.textContent = `❌ ${error.message}`;
                fb.className = "form-feedback show error";
                reproducirTono(220, 0.18, "square");
            }
        });
        return;
    }

    // Vista autenticada con pestañas: Preferencias, Récords y Datos Bancarios Simulados
    const banco = usuario.bancoSimulado;
    const htmlRecords = Object.keys(NOMBRES_JUEGOS).map((clave) => {
        const rec = usuario.records[clave];
        return `
            <div class="record-item">
                <span>${NOMBRES_JUEGOS[clave]}</span>
                <strong>${rec ? escapeHTML(rec.texto) : "Sin récord"}</strong>
            </div>
        `;
    }).join("");

    const htmlMovimientos = banco.movimientos.map((mov) => {
        const esPositivo = mov.monto >= 0;
        const signo = esPositivo ? "+" : "-";
        return `
            <div class="bank-tx-item">
                <div>
                    <strong>${escapeHTML(mov.concepto)}</strong>
                    <div style="font-size:12px;color:var(--muted);">${escapeHTML(mov.fecha)}</div>
                </div>
                <span class="tx-amount ${esPositivo ? "positive" : "negative"}">
                    ${signo} ${banco.moneda} ${Math.abs(mov.monto).toFixed(2)}
                </span>
            </div>
        `;
    }).join("");

    body.innerHTML = `
        <h2 id="authModalTitle">Mi Cuenta ElectroBot</h2>
        <div class="profile-banner">
            <div class="profile-banner-user">
                <div class="profile-avatar-lg">${escapeHTML(usuario.avatar)}</div>
                <div>
                    <div style="font-size:18px;font-weight:800;">${escapeHTML(usuario.nombre)}</div>
                    <div style="font-size:13px;opacity:0.92;">${escapeHTML(usuario.rol)} · ${escapeHTML(usuario.email)}</div>
                </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button type="button" id="switchAccountBtn" class="cancel-button">🔄 Cambiar cuenta</button>
                <button type="button" id="logoutBtn" class="danger-button">Cerrar sesión</button>
            </div>
        </div>

        <div class="profile-tabs" role="tablist">
            <button type="button" class="profile-tab-btn ${pestanaActiva === "preferencias" ? "active" : ""}" data-tab="preferencias">⚙️ Preferencias</button>
            <button type="button" class="profile-tab-btn ${pestanaActiva === "records" ? "active" : ""}" data-tab="records">🏆 Récords Minijuegos</button>
            <button type="button" class="profile-tab-btn ${pestanaActiva === "banco" ? "active" : ""}" data-tab="banco">💳 Cuenta Bancaria Simulada</button>
        </div>

        <!-- Pestaña 1: Preferencias -->
        <section class="profile-tab-panel ${pestanaActiva === "preferencias" ? "active" : ""}" data-panel="preferencias">
            <div class="pref-row">
                <div>
                    <strong>Apariencia visual</strong>
                    <div style="font-size:12px;color:var(--muted);">Tema guardado exclusivamente para tu perfil</div>
                </div>
                <select id="prefTema">
                    <option value="light" ${usuario.preferencias.tema === "light" ? "selected" : ""}>☀️ Modo Claro</option>
                    <option value="dark" ${usuario.preferencias.tema === "dark" ? "selected" : ""}>🌙 Modo Oscuro</option>
                </select>
            </div>
            <div class="pref-row">
                <div>
                    <strong>Dificultad preferida en minijuegos</strong>
                    <div style="font-size:12px;color:var(--muted);">Se selecciona automáticamente al abrir un juego</div>
                </div>
                <select id="prefDificultad">
                    <option value="facil" ${usuario.preferencias.dificultad === "facil" ? "selected" : ""}>Fácil / Práctica</option>
                    <option value="normal" ${usuario.preferencias.dificultad === "normal" ? "selected" : ""}>Normal / Desafío</option>
                    <option value="dificil" ${usuario.preferencias.dificultad === "dificil" ? "selected" : ""}>Difícil / Contrarreloj</option>
                </select>
            </div>
            <div class="pref-row">
                <div>
                    <strong>Efectos de sonido (Web Audio)</strong>
                    <div style="font-size:12px;color:var(--muted);">Tonos electrónicos en aciertos y secuencias</div>
                </div>
                <input id="prefSonido" type="checkbox" ${usuario.preferencias.sonido ? "checked" : ""} style="width:20px;height:20px;cursor:pointer;">
            </div>
            <div class="pref-row">
                <div>
                    <strong>Notificaciones en pantalla</strong>
                    <div style="font-size:12px;color:var(--muted);">Alertas visuales al romper récords</div>
                </div>
                <input id="prefNotificaciones" type="checkbox" ${usuario.preferencias.notificaciones ? "checked" : ""} style="width:20px;height:20px;cursor:pointer;">
            </div>
            <div class="modal-actions">
                <button type="button" id="savePrefsBtn" class="save-button">Guardar preferencias</button>
            </div>
        </section>

        <!-- Pestaña 2: Récords -->
        <section class="profile-tab-panel ${pestanaActiva === "records" ? "active" : ""}" data-panel="records">
            <p class="modal-subtitle">Tus mejores marcas personales se actualizan automáticamente al jugar cualquiera de los 8 minijuegos.</p>
            <div class="records-grid">${htmlRecords}</div>
        </section>

        <!-- Pestaña 3: Cuenta Bancaria Simulada -->
        <section class="profile-tab-panel ${pestanaActiva === "banco" ? "active" : ""}" data-panel="banco">
            <div class="bank-card-visual">
                <div class="bank-card-top">
                    <span>${escapeHTML(banco.entidad)}</span>
                    <span>${escapeHTML(banco.tipoCuenta)}</span>
                </div>
                <div class="bank-card-number">${escapeHTML(banco.numeroEnmascarado)}</div>
                <div class="bank-card-bottom">
                    <div>
                        <div style="font-size:11px;opacity:0.8;">TITULAR SIMULADO</div>
                        <strong>${escapeHTML(banco.titular)}</strong>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:11px;opacity:0.8;">SALDO DISPONIBLE</div>
                        <div class="bank-balance">${banco.moneda} ${banco.saldo.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <strong style="font-size:14px;">Últimos movimientos simulados del taller</strong>
            <div class="bank-tx-list">${htmlMovimientos}</div>

            <form id="bankSimForm" class="bank-sim-form" novalidate>
                <select id="bankOpType" aria-label="Tipo de movimiento">
                    <option value="egreso">Compra de kit (-)</option>
                    <option value="ingreso">Recarga de taller (+)</option>
                </select>
                <input id="bankOpConcept" type="text" placeholder="Concepto (ej. Sensor PIR)">
                <input id="bankOpAmount" type="number" step="0.50" min="0.50" placeholder="Monto S/">
                <button type="submit" class="save-button">Registrar</button>
            </form>
            <div id="bankFeedback" class="form-feedback"></div>
            <p style="font-size:11px;color:var(--muted);margin-top:10px;">
                * Datos bancarios 100 % ficticios con fines educativos para demostración de gestión de perfiles en JavaScript.
            </p>
        </section>
    `;

    // Cambio de pestañas
    body.querySelectorAll(".profile-tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            renderizarContenidoModalCuenta(btn.dataset.tab);
        });
    });

    // Cerrar sesión o cambiar cuenta
    document.getElementById("logoutBtn").addEventListener("click", () => {
        cerrarSesion();
        renderizarContenidoModalCuenta();
    });

    document.getElementById("switchAccountBtn").addEventListener("click", () => {
        cerrarSesion();
        renderizarContenidoModalCuenta();
    });

    // Guardar preferencias del usuario activo
    document.getElementById("savePrefsBtn").addEventListener("click", () => {
        try {
            const actual = obtenerUsuarioActivo();
            if (!actual) throw new ElectroBotError("Debes iniciar sesión primero.");
            actual.preferencias = {
                tema: document.getElementById("prefTema").value,
                dificultad: document.getElementById("prefDificultad").value,
                sonido: document.getElementById("prefSonido").checked,
                notificaciones: document.getElementById("prefNotificaciones").checked
            };
            guardarCuenta(actual);
            aplicarTemaActual();
            mostrarNotificacion("Preferencias guardadas en tu perfil.", "success", true);
        } catch (error) {
            mostrarNotificacion(error.message, "error", true);
        }
    });

    // Movimiento bancario simulado con validación try/catch
    document.getElementById("bankSimForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const fb = document.getElementById("bankFeedback");
        try {
            const actual = obtenerUsuarioActivo();
            if (!actual) throw new ElectroBotError("Sesión no disponible.");

            const tipo = document.getElementById("bankOpType").value;
            const concepto = document.getElementById("bankOpConcept").value.trim();
            const monto = Number(document.getElementById("bankOpAmount").value);

            if (concepto.length < 3) {
                throw new ElectroBotError("Escribe un concepto descriptivo de al menos 3 caracteres.");
            }
            if (!Number.isFinite(monto) || monto <= 0) {
                throw new ElectroBotError("Ingresa un monto numérico mayor a 0.");
            }
            if (tipo === "egreso" && monto > actual.bancoSimulado.saldo) {
                throw new ElectroBotError("Saldo simulado insuficiente para registrar esta compra.");
            }

            const delta = tipo === "egreso" ? -monto : monto;
            actual.bancoSimulado.saldo = Number((actual.bancoSimulado.saldo + delta).toFixed(2));
            actual.bancoSimulado.movimientos.unshift({
                fecha: new Date().toLocaleDateString("es-PE"),
                concepto,
                monto: delta
            });
            // Conservar máximo 6 movimientos recientes
            actual.bancoSimulado.movimientos = actual.bancoSimulado.movimientos.slice(0, 6);

            guardarCuenta(actual);
            mostrarNotificacion("Movimiento simulado registrado correctamente.", "success");
            renderizarContenidoModalCuenta("banco");
        } catch (error) {
            fb.textContent = `❌ ${error.message}`;
            fb.className = "form-feedback show error";
            reproducirTono(220, 0.16, "square");
        }
    });
}

/* ============================================================================
   5. API COMPARTIDA PARA MINIJUEGOS (RÉCORDS Y DIFICULTAD PREFERIDA)
   ============================================================================ */

/**
 * Registra un nuevo récord si supera la marca anterior del usuario conectado.
 * @param {string} claveJuego - Clave en NOMBRES_JUEGOS
 * @param {number} valorNumerico - Valor comparable (ej. puntos o milisegundos)
 * @param {string} textoLegible - Etiqueta mostrada en el perfil
 * @param {boolean} menorEsMejor - true para tiempos (ms o segundos), false para puntos
 * @returns {boolean} true si se estableció un nuevo récord
 */
function registrarRecordMinijuego(claveJuego, valorNumerico, textoLegible, menorEsMejor = false) {
    try {
        if (!NOMBRES_JUEGOS[claveJuego]) {
            throw new ElectroBotError(`Juego desconocido: ${claveJuego}`);
        }
        const usuario = obtenerUsuarioActivo();
        if (!usuario) return false;

        const actual = usuario.records[claveJuego];
        const mejora = !actual
            || (menorEsMejor ? valorNumerico < actual.valor : valorNumerico > actual.valor);

        if (mejora) {
            usuario.records[claveJuego] = {
                valor: valorNumerico,
                texto: textoLegible
            };
            guardarCuenta(usuario);
            reproducirTono(880, 0.18);
            mostrarNotificacion(`🏆 ¡Nuevo récord de ${usuario.nombre.split(" ")[0]} en ${NOMBRES_JUEGOS[claveJuego]}: ${textoLegible}!`, "success");
            return true;
        }
        return false;
    } catch (error) {
        console.error("[ElectroBot] Error guardando récord:", error);
        return false;
    }
}

/**
 * Devuelve el récord actual del usuario activo para un minijuego.
 */
function obtenerRecordMinijuego(claveJuego) {
    const usuario = obtenerUsuarioActivo();
    if (!usuario || !usuario.records || !usuario.records[claveJuego]) {
        return null;
    }
    return usuario.records[claveJuego];
}

/**
 * Devuelve la dificultad preferida del usuario ("facil" | "normal" | "dificil").
 */
function obtenerDificultadPreferida() {
    const usuario = obtenerUsuarioActivo();
    return usuario ? usuario.preferencias.dificultad : "normal";
}

/**
 * Actualiza los badges de récord personal en minijuegos.html.
 */
function actualizarTarjetasRecordsMinijuegos() {
    const chips = document.querySelectorAll("[data-record-game]");
    if (!chips.length) return;

    const usuario = obtenerUsuarioActivo();
    chips.forEach((chip) => {
        const clave = chip.dataset.recordGame;
        if (!usuario) {
            chip.textContent = "🔐 Inicia sesión para guardar tu récord";
        } else {
            const rec = usuario.records[clave];
            chip.textContent = rec
                ? `🏆 Récord de ${usuario.nombre.split(" ")[0]}: ${rec.texto}`
                : "🏆 Aún sin récord";
        }
    });
}

/* ============================================================================
   6. CATÁLOGO DE COMPONENTES: BUSCADOR, FILTRO Y EDITOR DE 4 CREADORES
   ============================================================================ */

function inicializarCatalogoComponentes() {
    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");
    const componentCards = document.querySelectorAll(".component-card");
    const noResults = document.getElementById("noResults");

    if (searchInput && categoryFilter && componentCards.length) {
        const filtrar = () => {
            try {
                const texto = searchInput.value.toLowerCase().trim();
                const categoria = categoryFilter.value;
                let visibles = 0;

                componentCards.forEach((card) => {
                    const nombre = (card.dataset.name || "").toLowerCase();
                    const cat = card.dataset.category || "";
                    const coincide = nombre.includes(texto) && (categoria === "todos" || cat === categoria);
                    card.style.display = coincide ? "" : "none";
                    if (coincide) visibles++;
                });

                if (noResults) {
                    noResults.style.display = visibles === 0 ? "block" : "none";
                }
            } catch (error) {
                console.error("[ElectroBot] Error filtrando componentes:", error);
            }
        };

        searchInput.addEventListener("input", filtrar);
        categoryFilter.addEventListener("change", filtrar);
    }

    // Editor corregido para los 4 creadores del proyecto
    const creatorModal = document.getElementById("creatorModal");
    const editCreatorsButton = document.getElementById("editCreatorsButton");
    const closeModalButton = document.getElementById("closeModalButton");
    const cancelModalButton = document.getElementById("cancelModalButton");
    const saveCreatorsButton = document.getElementById("saveCreatorsButton");

    if (!creatorModal || !editCreatorsButton) return;

    const totalCreadores = 4;

    const cargarCreadores = () => {
        const guardados = leerStorageSeguro("electrobot_creadores_v2", null);
        if (!Array.isArray(guardados)) return;

        for (let i = 1; i <= totalCreadores; i++) {
            const nombreEl = document.getElementById(`creatorName${i}`);
            const rolEl = document.getElementById(`creatorRole${i}`);
            const avatarEl = document.getElementById(`avatar${i}`);
            const dato = guardados[i - 1];
            if (!dato || !nombreEl || !rolEl) continue;

            nombreEl.textContent = dato.nombre;
            rolEl.textContent = dato.rol;
            if (avatarEl) {
                avatarEl.textContent = dato.nombre.charAt(0).toUpperCase();
            }
        }
    };

    const abrirModalCreadores = () => {
        for (let i = 1; i <= totalCreadores; i++) {
            const nameInput = document.getElementById(`nameInput${i}`);
            const roleInput = document.getElementById(`roleInput${i}`);
            const nombreEl = document.getElementById(`creatorName${i}`);
            const rolEl = document.getElementById(`creatorRole${i}`);
            if (nameInput && nombreEl) nameInput.value = nombreEl.textContent;
            if (roleInput && rolEl) roleInput.value = rolEl.textContent;
        }
        creatorModal.classList.add("show");
        creatorModal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    };

    const cerrarModalCreadores = () => {
        creatorModal.classList.remove("show");
        creatorModal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    };

    const guardarCreadores = () => {
        try {
            const lista = [];
            for (let i = 1; i <= totalCreadores; i++) {
                const nameInput = document.getElementById(`nameInput${i}`);
                const roleInput = document.getElementById(`roleInput${i}`);
                const nombreEl = document.getElementById(`creatorName${i}`);
                const rolEl = document.getElementById(`creatorRole${i}`);
                const avatarEl = document.getElementById(`avatar${i}`);

                const nuevoNombre = nameInput ? nameInput.value.trim() : "";
                const nuevoRol = roleInput ? roleInput.value.trim() : "";

                if (!nuevoNombre || !nuevoRol) {
                    throw new ElectroBotError(`Completa el nombre y cargo del integrante ${i}.`);
                }

                if (nombreEl) nombreEl.textContent = nuevoNombre;
                if (rolEl) rolEl.textContent = nuevoRol;
                if (avatarEl) avatarEl.textContent = nuevoNombre.charAt(0).toUpperCase();

                lista.push({ nombre: nuevoNombre, rol: nuevoRol });
            }

            guardarStorageSeguro("electrobot_creadores_v2", lista);
            cerrarModalCreadores();
            mostrarNotificacion("Integrantes actualizados correctamente.", "success");
        } catch (error) {
            mostrarNotificacion(error.message, "error", true);
        }
    };

    editCreatorsButton.addEventListener("click", abrirModalCreadores);
    if (closeModalButton) closeModalButton.addEventListener("click", cerrarModalCreadores);
    if (cancelModalButton) cancelModalButton.addEventListener("click", cerrarModalCreadores);
    if (saveCreatorsButton) saveCreatorsButton.addEventListener("click", guardarCreadores);

    creatorModal.addEventListener("click", (event) => {
        if (event.target === creatorModal) cerrarModalCreadores();
    });

    cargarCreadores();
}

/* ============================================================================
   7. CHATBOT EDUCATIVO ELECTROBOT (SEGURO CONTRA XSS)
   ============================================================================ */

function inicializarChatbot() {
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    const chatMessages = document.getElementById("chatMessages");

    if (!chatForm || !chatInput || !chatMessages) return;

    const agregarMensaje = (contenidoHTML, emisor) => {
        const msg = document.createElement("div");
        msg.className = `message ${emisor}`;
        const burbuja = document.createElement("div");
        burbuja.className = "message-bubble";
        burbuja.innerHTML = contenidoHTML;
        msg.appendChild(burbuja);
        chatMessages.appendChild(msg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const obtenerRespuestaBot = (pregunta) => {
        const text = pregunta.toLowerCase();

        if (text.includes("resistencia") || text.includes("resistor")) {
            return "Una <strong>resistencia</strong> limita el paso de corriente eléctrica y se mide en ohmios (Ω). Es indispensable para proteger LEDs y dividir voltaje.";
        }
        if (text.includes("capacitor") || text.includes("condensador")) {
            return "Un <strong>capacitor</strong> almacena energía temporalmente en un campo eléctrico. Se mide en faradios (F) y filtra o estabiliza el voltaje.";
        }
        if (text.includes("led")) {
            return "Un <strong>LED</strong> (diodo emisor de luz) tiene polaridad (ánodo + y cátodo -) y requiere siempre una resistencia limitadora para no quemarse.";
        }
        if (text.includes("diodo")) {
            return "Un <strong>diodo</strong> conduce la corriente en una sola dirección (de ánodo a cátodo) y protege circuitos contra inversión de polaridad.";
        }
        if (text.includes("transistor") || text.includes("mosfet")) {
            return "Un <strong>transistor</strong> o <strong>MOSFET</strong> actúa como interruptor electrónico o amplificador de señal controlada.";
        }
        if (text.includes("arduino") || text.includes("esp32") || text.includes("microcontrolador")) {
            return "<strong>Arduino</strong> y <strong>ESP32</strong> son microcontroladores programables que leen sensores y controlan motores o LEDs. El ESP32 además incluye Wi-Fi y Bluetooth.";
        }
        if (text.includes("ohm") || text.includes("voltaje") || text.includes("corriente")) {
            return "La <strong>Ley de Ohm</strong> establece que <strong>V = I × R</strong> (Voltaje = Corriente × Resistencia). Puedes practicarla en nuestra sección de <em>Calculadoras</em>.";
        }
        if (text.includes("potencia")) {
            return "La <strong>potencia eléctrica</strong> se calcula con <strong>P = V × I</strong> y se expresa en vatios (W).";
        }
        if (text.includes("protoboard")) {
            return "La <strong>protoboard</strong> permite armar circuitos sin soldar: los rieles laterales distribuyen alimentación (+ y -) y las filas centrales conectan pines.";
        }
        if (text.includes("multimetro") || text.includes("multímetro")) {
            return "El <strong>multímetro</strong> mide voltaje (en paralelo), corriente (en serie), resistencia y continuidad.";
        }
        if (text.includes("hola") || text.includes("buenas")) {
            return "¡Hola! 🤖⚡ Pregúntame sobre componentes, Ley de Ohm, protoboard o seguridad en el taller.";
        }
        if (text.includes("gracias")) {
            return "¡Con gusto! 😄 Recuerda probar los 8 minijuegos para guardar tus récords.";
        }

        return "Buena pregunta 🤖. Puedes consultarme sobre <strong>resistencias, capacitores, LEDs, diodos, transistores, Arduino, ESP32, protoboard, multímetro, potencia o Ley de Ohm</strong>.";
    };

    chatForm.addEventListener("submit", (event) => {
        event.preventDefault();
        try {
            const pregunta = chatInput.value.trim();
            if (!pregunta) {
                throw new ElectroBotError("Escribe una pregunta antes de enviar.");
            }
            // Escapamos la entrada del usuario para prevenir XSS
            agregarMensaje(escapeHTML(pregunta), "user");
            chatInput.value = "";

            setTimeout(() => {
                agregarMensaje(obtenerRespuestaBot(pregunta), "bot");
            }, 300);
        } catch (error) {
            mostrarNotificacion(error.message, "error", true);
        }
    });

    document.querySelectorAll(".quick-question").forEach((boton) => {
        boton.addEventListener("click", () => {
            chatInput.value = boton.dataset.question || "";
            chatForm.dispatchEvent(new Event("submit", { cancelable: true }));
        });
    });
}

/* ============================================================================
   8. FORMULARIO DE SATISFACCIÓN DEL CLIENTE (VALIDADO CON TRY/CATCH)
   ============================================================================ */

const ENCUESTAS_INICIALES = [
    {
        nombre: "Valeria Mendoza",
        rol: "Estudiante 5°A",
        modulo: "Minijuegos",
        calificacion: 5,
        comentario: "El juego de Código de Colores y la calculadora de LED me ayudaron a no quemar ningún LED en el taller.",
        fecha: "24/11/2026"
    },
    {
        nombre: "Diego Quispe",
        rol: "Estudiante 5°B",
        modulo: "Catálogo de Componentes",
        calificacion: 5,
        comentario: "Muy claro y ordenado. Me gusta poder cambiar al modo oscuro desde mi perfil.",
        fecha: "25/11/2026"
    }
];

function inicializarFormularioSatisfaccion() {
    const form = document.getElementById("satisfactionForm");
    const starsContainer = document.getElementById("starRating");
    const ratingInput = document.getElementById("satRating");
    const feedback = document.getElementById("satFeedback");
    const reviewsList = document.getElementById("reviewsList");
    const avgScoreEl = document.getElementById("avgSatisfactionScore");
    const totalReviewsEl = document.getElementById("totalSatisfactionCount");

    if (!form || !starsContainer || !ratingInput) return;

    let calificacionSeleccionada = 5;

    const pintarEstrellas = (valor) => {
        starsContainer.querySelectorAll(".star-btn").forEach((btn) => {
            const num = Number(btn.dataset.value);
            btn.classList.toggle("active", num <= valor);
        });
        ratingInput.value = String(valor);
    };

    const renderizarResenas = () => {
        const resenas = leerStorageSeguro(CLAVE_ENCUESTAS, ENCUESTAS_INICIALES);
        const promedio = resenas.reduce((acc, r) => acc + Number(r.calificacion), 0) / (resenas.length || 1);

        if (avgScoreEl) avgScoreEl.textContent = promedio.toFixed(1);
        if (totalReviewsEl) totalReviewsEl.textContent = `${resenas.length} valoraciones`;

        if (reviewsList) {
            reviewsList.innerHTML = resenas.slice(0, 4).map((r) => `
                <article class="review-item">
                    <div class="review-item-head">
                        <strong>${escapeHTML(r.nombre)} · <span style="color:var(--muted);font-weight:400;">${escapeHTML(r.rol)}</span></strong>
                        <span style="color:#f59e0b;font-weight:800;">${"★".repeat(r.calificacion)}${"☆".repeat(5 - r.calificacion)}</span>
                    </div>
                    <div style="font-size:12px;color:var(--primary-bright);font-weight:700;margin-bottom:4px;">Módulo: ${escapeHTML(r.modulo)} · ${escapeHTML(r.fecha)}</div>
                    <p>${escapeHTML(r.comentario)}</p>
                </article>
            `).join("");
        }
    };

    starsContainer.querySelectorAll(".star-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            calificacionSeleccionada = Number(btn.dataset.value);
            pintarEstrellas(calificacionSeleccionada);
        });
    });

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        try {
            const nombre = document.getElementById("satName").value.trim();
            const email = document.getElementById("satEmail").value.trim();
            const rol = document.getElementById("satRole").value;
            const modulo = document.getElementById("satModule").value;
            const comentario = document.getElementById("satComment").value.trim();
            const calificacion = Number(ratingInput.value);

            if (nombre.length < 3) {
                throw new ElectroBotError("Ingresa tu nombre completo (mínimo 3 caracteres).");
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                throw new ElectroBotError("Ingresa un correo electrónico válido para atención al cliente.");
            }
            if (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5) {
                throw new ElectroBotError("Selecciona una calificación de 1 a 5 estrellas.");
            }
            if (comentario.length < 10) {
                throw new ElectroBotError("Cuéntanos brevemente tu opinión (mínimo 10 caracteres).");
            }

            const resenas = leerStorageSeguro(CLAVE_ENCUESTAS, ENCUESTAS_INICIALES);
            resenas.unshift({
                nombre,
                rol,
                modulo,
                calificacion,
                comentario,
                fecha: new Date().toLocaleDateString("es-PE")
            });
            guardarStorageSeguro(CLAVE_ENCUESTAS, resenas);

            feedback.textContent = "✅ ¡Gracias por tu evaluación! Tu opinión fue registrada correctamente.";
            feedback.className = "form-feedback show success";
            form.reset();
            calificacionSeleccionada = 5;
            pintarEstrellas(5);
            renderizarResenas();
            reproducirTono(740, 0.14);
            mostrarNotificacion("Encuesta de satisfacción enviada con éxito.", "success");
        } catch (error) {
            feedback.textContent = `❌ ${error.message}`;
            feedback.className = "form-feedback show error";
            reproducirTono(220, 0.16, "square");
        }
    });

    pintarEstrellas(calificacionSeleccionada);
    renderizarResenas();
}

/* ============================================================================
   9. INICIALIZACIÓN GLOBAL AL CARGAR EL DOCUMENTO
   ============================================================================ */

document.addEventListener("DOMContentLoaded", () => {
    try {
        // Garantiza la existencia de las 3 cuentas iniciales
        obtenerTodasLasCuentas();

        // Sincroniza tema y botones de modo oscuro
        aplicarTemaActual();
        document.querySelectorAll("#themeButton, #themeToggle").forEach((btn) => {
            btn.addEventListener("click", alternarTema);
        });

        // Inicializa modal de cuentas, navbar y módulos específicos de cada página
        inicializarModalCuenta();
        actualizarBotonCuentaNavbar();
        actualizarTarjetasRecordsMinijuegos();
        inicializarCatalogoComponentes();
        inicializarChatbot();
        inicializarFormularioSatisfaccion();
    } catch (error) {
        console.error("[ElectroBot] Error en inicialización global:", error);
    }
});

// Exponemos la API pública de ElectroBot para minijuegos y calculadoras
window.ElectroBotApp = {
    ElectroBotError,
    obtenerUsuarioActivo,
    obtenerRecordMinijuego,
    registrarRecordMinijuego,
    obtenerDificultadPreferida,
    mostrarNotificacion,
    reproducirTono,
    abrirModalCuenta,
    escapeHTML
};
