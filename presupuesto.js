// ==========================================
// MÓDULO DE PRESUPUESTO MENSUAL (CON HISTORIAL Y BLOQUEO)
// ==========================================

let gastosGuardados = [];
let ingresosAdicGuardados = [];
let ingresoPrincipalActual = 0;
let saldoAnteriorActual = 0;

let claveMesActual = "";
let claveMesSeleccionada = "";

// Desuscripciones de Firestore para cambio de mes
let unsubDocMes = null;
let unsubGastos = null;
let unsubIngresos = null;

auth.onAuthStateChanged((user) => {
    if (user) {
        inicializarPresupuesto(user.uid);
    }
});

function obtenerInfoMesActual() {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mesNumero = String(ahora.getMonth() + 1).padStart(2, '0');
    return {
        claveMes: `${anio}-${mesNumero}`,
        nombreMes: formatearNombreMes(`${anio}-${mesNumero}`)
    };
}

function obtenerInfoMesAnterior() {
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() - 1);
    const anio = fecha.getFullYear();
    const mesNumero = String(fecha.getMonth() + 1).padStart(2, '0');
    return { claveMesAnterior: `${anio}-${mesNumero}` };
}

function formatearNombreMes(clave) {
    const [anio, mes] = clave.split("-");
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return `${meses[parseInt(mes, 10) - 1]} ${anio}`;
}

async function inicializarPresupuesto(uid) {
    const { claveMes } = obtenerInfoMesActual();
    claveMesActual = claveMes;
    claveMesSeleccionada = claveMes;

    const mesRef = db.collection("usuarios").doc(uid).collection("presupuestos").doc(claveMesActual);
    const docMes = await mesRef.get();

    // 1. Si el mes actual no existe en Firestore, realizamos la transición
    if (!docMes.exists) {
        await realizarTransicionDeMes(uid, claveMesActual);
    }

    // 2. Cargar el desplegable de historial con todos los meses del usuario
    await cargarSelectorMeses(uid);

    // 3. Iniciar escucha en tiempo real del mes seleccionado
    escucharMesSeleccionado(uid, claveMesSeleccionada);
}

// ==========================================
// CARGA Y CAMBIO DE MESES (HISTORIAL)
// ==========================================
async function cargarSelectorMeses(uid) {
    const select = document.getElementById("selectorMeses");
    if (!select) return;

    const snapshot = await db.collection("usuarios").doc(uid).collection("presupuestos").get();
    let listaClaves = [];

    snapshot.forEach(doc => listaClaves.push(doc.id));
    
    // Ordenar descendente (los meses más recientes primero)
    listaClaves.sort().reverse();

    select.innerHTML = "";
    listaClaves.forEach(clave => {
        const option = document.createElement("option");
        option.value = clave;
        option.innerText = formatearNombreMes(clave) + (clave === claveMesActual ? " (Actual)" : "");
        select.appendChild(option);
    });

    select.value = claveMesSeleccionada;
}

function cambiarMesSeleccionado(nuevaClave) {
    if (nuevaClave === claveMesSeleccionada) return;
    
    claveMesSeleccionada = nuevaClave;
    escucharMesSeleccionado(auth.currentUser.uid, claveMesSeleccionada);
}

// ==========================================
// TRANSICIÓN Y ARRASTRE DE MES ANTERIOR
// ==========================================
async function realizarTransicionDeMes(uid, claveMesActual) {
    const { claveMesAnterior } = obtenerInfoMesAnterior();
    const mesAntRef = db.collection("usuarios").doc(uid).collection("presupuestos").doc(claveMesAnterior);
    const docAnt = await mesAntRef.get();

    let nuevoIngresoPrincipal = 0;
    let nuevoSaldoAnterior = 0;
    let gastosRecurrentesACopiar = [];
    let ingresosRecurrentesACopiar = [];

    if (docAnt.exists) {
        const dataAnt = docAnt.data();
        const ingresoAnt = dataAnt.ingresoPrincipal || 0;
        const saldoArrastradoAnt = dataAnt.saldoAnterior || 0;

        let totalGastosAnt = 0;
        const snapshotGastos = await mesAntRef.collection("gastos").get();
        snapshotGastos.forEach(doc => {
            const g = doc.data();
            totalGastosAnt += parseFloat(g.monto) || 0;
            if (g.recurrente === 'si') gastosRecurrentesACopiar.push(g.nombre);
        });

        let totalIngresosAdicAnt = 0;
        const snapshotIngresos = await mesAntRef.collection("ingresosAdicionales").get();
        snapshotIngresos.forEach(doc => {
            const ing = doc.data();
            totalIngresosAdicAnt += parseFloat(ing.monto) || 0;
            if (ing.recurrente === 'si') ingresosRecurrentesACopiar.push(ing.nombre);
        });

        nuevoSaldoAnterior = (ingresoAnt + saldoArrastradoAnt + totalIngresosAdicAnt) - totalGastosAnt;

        if (ingresoAnt > 0) {
            const mantener = confirm(`¡Comenzó un nuevo mes!\n\nTu Ingreso Principal anterior fue de $${ingresoAnt}.\n¿Sigue siendo el mismo monto para este mes?`);
            if (mantener) nuevoIngresoPrincipal = ingresoAnt;
        }
    }

    const batch = db.batch();
    const nuevoMesRef = db.collection("usuarios").doc(uid).collection("presupuestos").doc(claveMesActual);
    
    batch.set(nuevoMesRef, {
        ingresoPrincipal: nuevoIngresoPrincipal,
        saldoAnterior: nuevoSaldoAnterior,
        fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
    });

    gastosRecurrentesACopiar.forEach(nombreGasto => {
        const nuevoGastoRef = nuevoMesRef.collection("gastos").doc();
        batch.set(nuevoGastoRef, {
            nombre: nombreGasto,
            recurrente: 'si',
            monto: 0,
            fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
        });
    });

    ingresosRecurrentesACopiar.forEach(nombreIngreso => {
        const nuevoIngresoRef = nuevoMesRef.collection("ingresosAdicionales").doc();
        batch.set(nuevoIngresoRef, {
            nombre: nombreIngreso,
            recurrente: 'si',
            monto: 0,
            fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
        });
    });

    await batch.commit();
}

// ==========================================
// ESCUCHAS EN TIEMPO REAL CON LIMPIEZA
// ==========================================
function escucharMesSeleccionado(uid, claveMes) {
    // Cancelar escuchas previas si existían
    if (unsubDocMes) unsubDocMes();
    if (unsubGastos) unsubGastos();
    if (unsubIngresos) unsubIngresos();

    document.getElementById("tituloMesActual").innerText = formatearNombreMes(claveMes);

    const esMesActual = (claveMes === claveMesActual);

    // Ajustes visuales según si es mes actual o historial
    document.getElementById("bannerModoLectura").style.display = esMesActual ? "none" : "block";
    document.getElementById("btnEditarIngreso").style.display = esMesActual ? "inline-block" : "none";
    document.getElementById("btnAgregarIngresoAdic").style.display = esMesActual ? "inline-block" : "none";
    document.getElementById("btnAgregarGasto").style.display = esMesActual ? "inline-block" : "none";

    const mesRef = db.collection("usuarios").doc(uid).collection("presupuestos").doc(claveMes);

    unsubDocMes = mesRef.onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            ingresoPrincipalActual = data.ingresoPrincipal || 0;
            saldoAnteriorActual = data.saldoAnterior || 0;

            if (ingresoPrincipalActual > 0 || !esMesActual) {
                renderizarPantallaCompleta();
            } else {
                renderizarSolicitudIngreso();
            }
        }
    });

    unsubGastos = mesRef.collection("gastos").orderBy("fechaRegistro", "desc").onSnapshot((snapshot) => {
        gastosGuardados = [];
        snapshot.forEach(doc => gastosGuardados.push({ id: doc.id, ...doc.data() }));
        if (ingresoPrincipalActual > 0 || !esMesActual) {
            renderizarTablaGastos();
            actualizarTotales();
        }
    });

    unsubIngresos = mesRef.collection("ingresosAdicionales").orderBy("fechaRegistro", "desc").onSnapshot((snapshot) => {
        ingresosAdicGuardados = [];
        snapshot.forEach(doc => ingresosAdicGuardados.push({ id: doc.id, ...doc.data() }));
        if (ingresoPrincipalActual > 0 || !esMesActual) {
            renderizarTablaIngresosAdic();
            actualizarTotales();
        }
    });
}

function formatMoneda(valor) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(valor);
}

// ==========================================
// RENDERIZADO DE INTERFAZ Y TOTALES
// ==========================================
function renderizarSolicitudIngreso() {
    document.getElementById("contenedorResumen").style.display = "none";
    document.getElementById("seccionTablasPresupuesto").style.display = "none";

    document.getElementById("contenedorIngreso").innerHTML = `
        <div style="background-color: #fff3e0; border: 2px solid #ffe0b2; padding: 15px; border-radius: 10px; margin: 15px 0;">
            <p style="color: #e65100; font-weight: bold; margin-top: 0;">Falta indicar tu Ingreso Principal de este mes.</p>
            <p style="font-size: 15px; margin-bottom: 10px;">Saldo arrastrado del mes pasado: <strong>${formatMoneda(saldoAnteriorActual)}</strong></p>
            <label style="display:block; text-align:left; font-size:14px; font-weight:bold; margin-bottom:4px;">Ingreso Principal (Jubilación/Sueldo) ($):</label>
            <input type="number" id="inputIngresoMensual" placeholder="Ej: 500000" min="0">
            <button onclick="guardarIngresoMensual()" style="background-color: #2e7d32; font-weight: bold; margin-top: 5px;">Guardar Ingreso</button>
        </div>
    `;
    document.getElementById("contenedorIngreso").style.display = "block";
}

function activarEdicionIngreso() {
    if (claveMesSeleccionada !== claveMesActual) return;

    document.getElementById("contenedorIngreso").style.display = "block";
    document.getElementById("contenedorIngreso").innerHTML = `
        <div style="background-color: #e8f5e9; border: 1px solid #a5d6a7; padding: 12px; border-radius: 10px; margin: 15px 0;">
            <label style="display:block; text-align:left; font-size:13px; font-weight:bold; margin-bottom:4px;">Modificar Ingreso Principal ($):</label>
            <input type="number" id="inputIngresoMensual" value="${ingresoPrincipalActual}" min="0">
            <div style="display:flex; gap:10px; margin-top:5px;">
                <button onclick="guardarIngresoMensual()" style="background-color: #2e7d32; padding: 8px;">Actualizar</button>
                <button onclick="renderizarPantallaCompleta()" style="background-color: #757575; padding: 8px;">Cancelar</button>
            </div>
        </div>
    `;
}

function renderizarPantallaCompleta() {
    document.getElementById("contenedorIngreso").style.display = "none";
    document.getElementById("contenedorResumen").style.display = "block";
    document.getElementById("seccionTablasPresupuesto").style.display = "block";

    document.getElementById("txtSaldoAnterior").innerText = formatMoneda(saldoAnteriorActual);
    document.getElementById("txtIngreso").innerText = formatMoneda(ingresoPrincipalActual);
    
    renderizarTablaGastos();
    renderizarTablaIngresosAdic();
    actualizarTotales();
}

function actualizarTotales() {
    const totalGastos = gastosGuardados.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);
    const totalIngresosAdic = ingresosAdicGuardados.reduce((acc, i) => acc + (parseFloat(i.monto) || 0), 0);
    
    const disponible = (saldoAnteriorActual + ingresoPrincipalActual + totalIngresosAdic) - totalGastos;

    document.getElementById("txtTotalIngresosAdic").innerText = formatMoneda(totalIngresosAdic);
    document.getElementById("txtTotalGastos").innerText = formatMoneda(totalGastos);
    
    const elDisponible = document.getElementById("txtDisponible");
    elDisponible.innerText = formatMoneda(disponible);
    elDisponible.style.color = disponible >= 0 ? "#2e7d32" : "#c62828";
}

async function guardarIngresoMensual() {
    if (claveMesSeleccionada !== claveMesActual) return;

    const usuarioActual = auth.currentUser;
    const input = document.getElementById("inputIngresoMensual");
    const valor = parseFloat(input.value);

    if (isNaN(valor) || valor < 0) {
        alert("Por favor ingresa un monto válido.");
        return;
    }

    try {
        await db.collection("usuarios").doc(usuarioActual.uid).collection("presupuestos").doc(claveMesActual).set({
            ingresoPrincipal: valor
        }, { merge: true });
    } catch (error) {
        alert("Error al guardar: " + error.message);
    }
}

// ==========================================
// GESTIÓN DE INGRESOS ADICIONALES (TARJETAS)
// ==========================================
function renderizarTablaIngresosAdic(idEdicion = null) {
    const contenedor = document.getElementById("tablaIngresosAdicBody");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    const esMesActual = (claveMesSeleccionada === claveMesActual);

    // Formulario de creación de nuevo ingreso extra
    if (idEdicion === "NUEVO" && esMesActual) {
        contenedor.innerHTML += `
            <div style="background-color: #fff9c4; border: 1px solid #fbc02d; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                <div style="margin-bottom: 8px;">
                    <label style="font-size: 11px; font-weight: bold; color: #555;">DESCRIPCIÓN</label>
                    <input type="text" id="inputNombreIngreso" placeholder="Ej: Venta tortas" style="width: 100%; padding: 6px; box-sizing: border-box; margin-top: 2px;">
                </div>
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <div style="flex: 1;">
                        <label style="font-size: 11px; font-weight: bold; color: #555;">RECURRENTE</label>
                        <select id="selectRecurrenteIngreso" style="width: 100%; padding: 6px; margin-top: 2px;">
                            <option value="no">No</option>
                            <option value="si">Sí</option>
                        </select>
                    </div>
                    <div style="flex: 1;">
                        <label style="font-size: 11px; font-weight: bold; color: #555;">MONTO ($)</label>
                        <input type="number" id="inputMontoIngreso" placeholder="0" style="width: 100%; padding: 6px; box-sizing: border-box; margin-top: 2px;">
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="guardarIngresoAdicional()" style="background-color: #1976d2; color: white; padding: 8px; border: none; border-radius: 4px; flex: 1; font-weight: bold; cursor: pointer;">Guardar</button>
                    <button onclick="renderizarTablaIngresosAdic()" style="background-color: #757575; color: white; padding: 8px; border: none; border-radius: 4px; flex: 1; font-weight: bold; cursor: pointer;">Cancelar</button>
                </div>
            </div>
        `;
    }

    ingresosAdicGuardados.forEach((ing) => {
        const alertaCero = (ing.monto === 0 && esMesActual) ? "⚠️ Cargar monto" : "";

        // Formulario de edición de un ingreso existente
        if (idEdicion === ing.id && esMesActual) {
            contenedor.innerHTML += `
                <div style="background-color: #e3f2fd; border: 1px solid #1976d2; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                    <div style="margin-bottom: 8px;">
                        <label style="font-size: 11px; font-weight: bold; color: #555;">DESCRIPCIÓN</label>
                        <input type="text" id="editNombreIngreso_${ing.id}" value="${ing.nombre}" style="width: 100%; padding: 6px; box-sizing: border-box; margin-top: 2px;">
                    </div>
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <div style="flex: 1;">
                            <label style="font-size: 11px; font-weight: bold; color: #555;">RECURRENTE</label>
                            <select id="editRecurrenteIngreso_${ing.id}" style="width: 100%; padding: 6px; margin-top: 2px;">
                                <option value="si" ${ing.recurrente === 'si' ? 'selected' : ''}>Sí</option>
                                <option value="no" ${ing.recurrente === 'no' ? 'selected' : ''}>No</option>
                            </select>
                        </div>
                        <div style="flex: 1;">
                            <label style="font-size: 11px; font-weight: bold; color: #555;">MONTO ($)</label>
                            <input type="number" id="editMontoIngreso_${ing.id}" value="${ing.monto}" style="width: 100%; padding: 6px; box-sizing: border-box; margin-top: 2px;">
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="actualizarIngresoAdicional('${ing.id}')" style="background-color: #1976d2; color: white; padding: 8px; border: none; border-radius: 4px; flex: 1; font-weight: bold; cursor: pointer;">Guardar</button>
                        <button onclick="renderizarTablaIngresosAdic()" style="background-color: #757575; color: white; padding: 8px; border: none; border-radius: 4px; flex: 1; font-weight: bold; cursor: pointer;">Cancelar</button>
                    </div>
                </div>
            `;
        } else {
            // Visualización normal en forma de tarjeta limpia
            const estiloBorde = (ing.monto === 0 && esMesActual) ? "background-color: #e3f2fd; border-left: 4px solid #1976d2;" : "background-color: #ffffff; border: 1px solid #e0e0e0;";
            
            const accionesHTML = esMesActual ? `
                <button onclick="renderizarTablaIngresosAdic('${ing.id}')" style="background:none; border:none; cursor:pointer; font-size: 16px;" title="Editar">✏️</button>
                <button onclick="borrarIngresoAdicional('${ing.id}')" style="background:none; border:none; cursor:pointer; font-size: 16px;" title="Eliminar">🗑️</button>
            ` : `<span title="Mes cerrado - Solo lectura">🔒</span>`;

            contenedor.innerHTML += `
                <div style="${estiloBorde} padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="font-size: 14px; color: #333;">${ing.nombre}</strong>
                        <div style="font-size: 12px; color: #555; margin-top: 2px;">
                            ${ing.recurrente === "si" ? "🔄 Recurrente" : "📌 Único"} 
                            ${alertaCero ? `<span style="color:#1976d2; font-weight: bold; margin-left: 6px;">${alertaCero}</span>` : ""}
                        </div>
                    </div>
                    <div style="text-align: right; display: flex; align-items: center; gap: 12px;">
                        <div>
                            <span style="font-size: 15px; font-weight: bold; color: #1976d2;">+ ${formatMoneda(ing.monto)}</span>
                        </div>
                        <div style="display: flex; gap: 4px;">
                            ${accionesHTML}
                        </div>
                    </div>
                </div>
            `;
        }
    });
}

function mostrarFilaNuevoIngresoAdic() { 
    if (claveMesSeleccionada === claveMesActual) renderizarTablaIngresosAdic("NUEVO"); 
}

async function guardarIngresoAdicional() {
    if (claveMesSeleccionada !== claveMesActual) return;

    const usuario = auth.currentUser;
    const nombre = document.getElementById("inputNombreIngreso").value.trim();
    const recurrente = document.getElementById("selectRecurrenteIngreso").value;
    const monto = parseFloat(document.getElementById("inputMontoIngreso").value);

    if (!nombre || isNaN(monto) || monto < 0) return alert("Completa los datos correctamente.");
    
    await db.collection("usuarios").doc(usuario.uid).collection("presupuestos").doc(claveMesActual).collection("ingresosAdicionales").add({
        nombre, recurrente, monto, fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function actualizarIngresoAdicional(id) {
    if (claveMesSeleccionada !== claveMesActual) return;

    const usuario = auth.currentUser;
    const nombre = document.getElementById(`editNombreIngreso_${id}`).value.trim();
    const recurrente = document.getElementById(`editRecurrenteIngreso_${id}`).value;
    const monto = parseFloat(document.getElementById(`editMontoIngreso_${id}`).value);

    if (!nombre || isNaN(monto) || monto < 0) return alert("Datos inválidos.");
    
    await db.collection("usuarios").doc(usuario.uid).collection("presupuestos").doc(claveMesActual).collection("ingresosAdicionales").doc(id).update({ 
        nombre, recurrente, monto 
    });
}

async function borrarIngresoAdicional(id) {
    if (claveMesSeleccionada !== claveMesActual) return;
    if (!confirm("¿Eliminar este ingreso?")) return;
    
    await db.collection("usuarios").doc(auth.currentUser.uid).collection("presupuestos").doc(claveMesActual).collection("ingresosAdicionales").doc(id).delete();
}


// ==========================================
// GESTIÓN DE GASTOS MENSUALES (TARJETAS)
// ==========================================
function renderizarTablaGastos(idEdicion = null) {
    const contenedor = document.getElementById("tablaGastosBody");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    const esMesActual = (claveMesSeleccionada === claveMesActual);

    // Formulario de creación de nuevo gasto
    if (idEdicion === "NUEVO" && esMesActual) {
        contenedor.innerHTML += `
            <div class="form-crear-gasto" style="background-color: #fff9c4; border: 1px solid #fbc02d; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                <div style="margin-bottom: 8px;">
                    <label style="font-size: 11px; font-weight: bold; color: #555;">GASTO</label>
                    <input type="text" id="inputNombreGasto" placeholder="Ej: Luz" style="width: 100%; padding: 6px; box-sizing: border-box; margin-top: 2px;">
                </div>
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <div style="flex: 1;">
                        <label style="font-size: 11px; font-weight: bold; color: #555;">RECURRENTE</label>
                        <select id="selectRecurrente" style="width: 100%; padding: 6px; margin-top: 2px;">
                            <option value="si">Sí</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                    <div style="flex: 1;">
                        <label style="font-size: 11px; font-weight: bold; color: #555;">MONTO ($)</label>
                        <input type="number" id="inputMontoGasto" placeholder="0" style="width: 100%; padding: 6px; box-sizing: border-box; margin-top: 2px;">
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="guardarNuevoGasto()" style="background-color: #c62828; color: white; padding: 8px; border: none; border-radius: 4px; flex: 1; font-weight: bold; cursor: pointer;">Guardar</button>
                    <button onclick="renderizarTablaGastos()" style="background-color: #757575; color: white; padding: 8px; border: none; border-radius: 4px; flex: 1; font-weight: bold; cursor: pointer;">Cancelar</button>
                </div>
            </div>
        `;
    }

    gastosGuardados.forEach((gasto) => {
        const alertaCero = (gasto.monto === 0 && esMesActual) ? "⚠️ Cargar monto" : "";

        // Formulario de edición de un gasto existente
        if (idEdicion === gasto.id && esMesActual) {
            contenedor.innerHTML += `
                <div class="form-crear-gasto" style="background-color: #ffebee; border: 1px solid #c62828; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                    <div style="margin-bottom: 8px;">
                        <label style="font-size: 11px; font-weight: bold; color: #555;">GASTO</label>
                        <input type="text" id="editNombreGasto_${gasto.id}" value="${gasto.nombre}" style="width: 100%; padding: 6px; box-sizing: border-box; margin-top: 2px;">
                    </div>
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <div style="flex: 1;">
                            <label style="font-size: 11px; font-weight: bold; color: #555;">RECURRENTE</label>
                            <select id="editRecurrente_${gasto.id}" style="width: 100%; padding: 6px; margin-top: 2px;">
                                <option value="si" ${gasto.recurrente === 'si' ? 'selected' : ''}>Sí</option>
                                <option value="no" ${gasto.recurrente === 'no' ? 'selected' : ''}>No</option>
                            </select>
                        </div>
                        <div style="flex: 1;">
                            <label style="font-size: 11px; font-weight: bold; color: #555;">MONTO ($)</label>
                            <input type="number" id="editMontoGasto_${gasto.id}" value="${gasto.monto}" style="width: 100%; padding: 6px; box-sizing: border-box; margin-top: 2px;">
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="actualizarGasto('${gasto.id}')" style="background-color: #c62828; color: white; padding: 8px; border: none; border-radius: 4px; flex: 1; font-weight: bold; cursor: pointer;">Guardar</button>
                        <button onclick="renderizarTablaGastos()" style="background-color: #757575; color: white; padding: 8px; border: none; border-radius: 4px; flex: 1; font-weight: bold; cursor: pointer;">Cancelar</button>
                    </div>
                </div>
            `;
        } else {
            // Visualización normal en forma de tarjeta limpia
            const estiloBorde = (gasto.monto === 0 && esMesActual) ? "background-color: #fff3e0; border-left: 4px solid #e65100;" : "background-color: #ffffff; border: 1px solid #e0e0e0;";
            
            const accionesHTML = esMesActual ? `
                <button onclick="renderizarTablaGastos('${gasto.id}')" style="background: none; border: none; cursor: pointer; font-size: 16px;" title="Editar">✏️</button>
                <button onclick="borrarGasto('${gasto.id}')" style="background: none; border: none; cursor: pointer; font-size: 16px;" title="Eliminar">🗑️</button>
            ` : `<span title="Mes cerrado - Solo lectura">🔒</span>`;

            contenedor.innerHTML += `
                <div style="${estiloBorde} padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="font-size: 14px; color: #333;">${gasto.nombre}</strong>
                        <div style="font-size: 12px; color: #555; margin-top: 2px;">
                            ${gasto.recurrente === "si" ? "🔄 Recurrente" : "📌 Único"} 
                            ${alertaCero ? `<span style="color:#e65100; font-weight: bold; margin-left: 6px;">${alertaCero}</span>` : ""}
                        </div>
                    </div>
                    <div style="text-align: right; display: flex; align-items: center; gap: 12px;">
                        <div>
                            <span style="font-size: 15px; font-weight: bold; color: #c62828;">- ${formatMoneda(gasto.monto)}</span>
                        </div>
                        <div style="display: flex; gap: 4px;">
                            ${accionesHTML}
                        </div>
                    </div>
                </div>
            `;
        }
    });
}

function mostrarFilaNuevoGasto() { 
    if (claveMesSeleccionada === claveMesActual) renderizarTablaGastos("NUEVO"); 
}

async function guardarNuevoGasto() {
    if (claveMesSeleccionada !== claveMesActual) return;

    const usuario = auth.currentUser;
    const nombre = document.getElementById("inputNombreGasto").value.trim();
    const recurrente = document.getElementById("selectRecurrente").value;
    const monto = parseFloat(document.getElementById("inputMontoGasto").value);

    if (!nombre || isNaN(monto) || monto < 0) return alert("Completa correctamente.");

    await db.collection("usuarios").doc(usuario.uid).collection("presupuestos").doc(claveMesActual).collection("gastos").add({
        nombre, recurrente, monto, fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function actualizarGasto(id) {
    if (claveMesSeleccionada !== claveMesActual) return;

    const usuario = auth.currentUser;
    const nombre = document.getElementById(`editNombreGasto_${id}`).value.trim();
    const recurrente = document.getElementById(`editRecurrente_${id}`).value;
    const monto = parseFloat(document.getElementById(`editMontoGasto_${id}`).value);

    if (!nombre || isNaN(monto) || monto < 0) return alert("Datos inválidos.");

    await db.collection("usuarios").doc(usuario.uid).collection("presupuestos").doc(claveMesActual).collection("gastos").doc(id).update({
        nombre, recurrente, monto
    });
}

async function borrarGasto(id) {
    if (claveMesSeleccionada !== claveMesActual) return;
    if (!confirm("¿Deseas eliminar este gasto?")) return;

    await db.collection("usuarios").doc(auth.currentUser.uid).collection("presupuestos").doc(claveMesActual).collection("gastos").doc(id).delete();
}