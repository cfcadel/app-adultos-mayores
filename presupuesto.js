// ==========================================
// MÓDULO DE PRESUPUESTO MENSUAL
// ==========================================

let gastosGuardados = [];
let ingresoMensualActual = 0;

auth.onAuthStateChanged((user) => {
    if (user) {
        inicializarPresupuesto(user.uid);
    }
});

// Obtener identificador del mes actual (Ej: "2026-09" y "Septiembre 2026")
function obtenerInfoMesActual() {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mesNumero = String(ahora.getMonth() + 1).padStart(2, '0');
    
    const meses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    
    return {
        claveMes: `${anio}-${mesNumero}`,
        nombreMes: `${meses[ahora.getMonth()]} ${anio}`
    };
}

function inicializarPresupuesto(uid) {
    const infoMes = obtenerInfoMesActual();
    document.getElementById("tituloMesActual").innerText = infoMes.nombreMes;

    // Escuchar cambios en la hoja presupuestaria del mes actual
    db.collection("usuarios").doc(uid).collection("presupuestos").doc(infoMes.claveMes)
        .onSnapshot((doc) => {
            if (doc.exists && doc.data().ingresoMensual > 0) {
                ingresoMensualActual = doc.data().ingresoMensual;
                renderizarIngresoCargado();
            } else {
                ingresoMensualActual = 0;
                renderizarSolicitudIngreso();
            }
            cargarGastos(uid, infoMes.claveMes);
        });
}

// FORMATO DE MONEDA
function formatMoneda(valor) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(valor);
}

// 1. VISTA CUANDO NO HAY INGRESO CARGADO
function renderizarSolicitudIngreso() {
    document.getElementById("contenedorResumen").style.display = "none";
    document.getElementById("seccionGastos").style.display = "none";

    document.getElementById("contenedorIngreso").innerHTML = `
        <div style="background-color: #fff3e0; border: 2px solid #ffe0b2; padding: 15px; border-radius: 10px; margin: 15px 0;">
            <p style="color: #e65100; font-weight: bold; margin-top: 0;">⚠️ No has registrado tu ingreso mensual para este mes.</p>
            <label style="display:block; text-align:left; font-size:13px; font-weight:bold; margin-bottom:4px;">Ingreso Mensual ($):</label>
            <input type="number" id="inputIngresoMensual" placeholder="Ej: 500000" min="0">
            <button onclick="guardarIngresoMensual()" style="background-color: #2e7d32; font-weight: bold; margin-top: 5px;">Guardar Ingreso</button>
        </div>
    `;
}

// VISTA MODO EDICIÓN RÁPIDA DE INGRESO
function activarEdicionIngreso() {
    document.getElementById("contenedorIngreso").style.display = "block";
    document.getElementById("contenedorIngreso").innerHTML = `
        <div style="background-color: #e8f5e9; border: 1px solid #a5d6a7; padding: 12px; border-radius: 10px; margin: 15px 0;">
            <label style="display:block; text-align:left; font-size:12px; font-weight:bold; margin-bottom:4px;">Modificar Ingreso Mensual ($):</label>
            <input type="number" id="inputIngresoMensual" value="${ingresoMensualActual}" min="0">
            <div style="display:flex; gap:10px; margin-top:5px;">
                <button onclick="guardarIngresoMensual()" style="background-color: #2e7d32; padding: 8px;">Actualizar</button>
                <button onclick="renderizarIngresoCargado()" style="background-color: #757575; padding: 8px;">Cancelar</button>
            </div>
        </div>
    `;
}

// 2. VISTA CUANDO EL INGRESO YA FUE CARGADO
function renderizarIngresoCargado() {
    document.getElementById("contenedorIngreso").style.display = "none";
    document.getElementById("contenedorResumen").style.display = "block";
    document.getElementById("seccionGastos").style.display = "block";

    document.getElementById("txtIngreso").innerText = formatMoneda(ingresoMensualActual);
    actualizarTotales();
}

// GUARDAR / ACTUALIZAR INGRESO
async function guardarIngresoMensual() {
    const usuarioActual = auth.currentUser;
    const input = document.getElementById("inputIngresoMensual");
    const valor = parseFloat(input.value);

    if (isNaN(valor) || valor <= 0) {
        alert("Por favor ingresa un monto de ingreso válido.");
        return;
    }

    const { claveMes } = obtenerInfoMesActual();

    try {
        await db.collection("usuarios").doc(usuarioActual.uid).collection("presupuestos").doc(claveMes).set({
            ingresoMensual: valor,
            fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (error) {
        alert("Error al guardar ingreso: " + error.message);
    }
}

// CARGAR LISTADO DE GASTOS
function cargarGastos(uid, claveMes) {
    db.collection("usuarios").doc(uid).collection("presupuestos").doc(claveMes).collection("gastos")
        .orderBy("fechaRegistro", "desc")
        .onSnapshot((snapshot) => {
            gastosGuardados = [];
            snapshot.forEach((doc) => {
                gastosGuardados.push({ id: doc.id, ...doc.data() });
            });
            renderizarTablaGastos();
            actualizarTotales();
        });
}

function actualizarTotales() {
    const totalGastos = gastosGuardados.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);
    const disponible = ingresoMensualActual - totalGastos;

    const elTotal = document.getElementById("txtTotalGastos");
    const elDisponible = document.getElementById("txtDisponible");

    if (elTotal) elTotal.innerText = formatMoneda(totalGastos);
    if (elDisponible) {
        elDisponible.innerText = formatMoneda(disponible);
        elDisponible.style.color = disponible >= 0 ? "#2e7d32" : "#c62828";
    }
}

// RENDERIZAR TABLA DE GASTOS
function renderizarTablaGastos(idEdicion = null) {
    const tbody = document.getElementById("tablaGastosBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    // 1. FILA DE CREACIÓN
    if (idEdicion === "NUEVO") {
        tbody.innerHTML += `
            <tr class="form-crear-gasto" style="background-color: #fff9c4;">
                <td style="padding: 5px;">
                    <label class="label-mobile" style="display:none; font-weight:bold; font-size:12px;">Gasto:</label>
                    <input type="text" id="inputNombreGasto" placeholder="Ej: Alquiler, Luz, Supermercado">
                </td>
                <td class="col-recurrente" style="padding: 5px;">
                    <label class="label-mobile" style="display:none; font-weight:bold; font-size:12px;">¿Es Recurrente?:</label>
                    <select id="selectRecurrente">
                        <option value="si">Sí</option>
                        <option value="no">No</option>
                    </select>
                </td>
                <td class="col-monto" style="padding: 5px;">
                    <label class="label-mobile" style="display:none; font-weight:bold; font-size:12px;">Monto ($):</label>
                    <input type="number" id="inputMontoGasto" placeholder="0">
                </td>
                <td class="td-acciones" style="padding: 5px;">
                    <div class="contenedor-botones-form" style="width: 100%;">
                        <button onclick="guardarNuevoGasto()" style="background-color: #2e7d32; color: white; padding: 10px; border: none; border-radius: 6px; font-weight: bold;">Guardar</button>
                        <button onclick="renderizarTablaGastos()" style="background-color: #757575; color: white; padding: 10px; border: none; border-radius: 6px; font-weight: bold;">Cancelar</button>
                    </div>
                </td>
            </tr>
        `;
    }

    // 2. LISTADO DE GASTOS REGISTRADOS
    gastosGuardados.forEach((gasto) => {
        if (idEdicion === gasto.id) {
            // MODO EDICIÓN
            tbody.innerHTML += `
                <tr class="form-crear-gasto" style="background-color: #e1f5fe;">
                    <td style="padding: 5px;">
                        <label class="label-mobile" style="display:none; font-weight:bold; font-size:12px;">Gasto:</label>
                        <input type="text" id="editNombreGasto_${gasto.id}" value="${gasto.nombre}">
                    </td>
                    <td class="col-recurrente" style="padding: 5px;">
                        <label class="label-mobile" style="display:none; font-weight:bold; font-size:12px;">¿Es Recurrente?:</label>
                        <select id="editRecurrente_${gasto.id}">
                            <option value="si" ${gasto.recurrente === 'si' ? 'selected' : ''}>Sí</option>
                            <option value="no" ${gasto.recurrente === 'no' ? 'selected' : ''}>No</option>
                        </select>
                    </td>
                    <td class="col-monto" style="padding: 5px;">
                        <label class="label-mobile" style="display:none; font-weight:bold; font-size:12px;">Monto ($):</label>
                        <input type="number" id="editMontoGasto_${gasto.id}" value="${gasto.monto}">
                    </td>
                    <td class="td-acciones" style="padding: 5px;">
                        <div class="contenedor-botones-form" style="width: 100%;">
                            <button onclick="actualizarGasto('${gasto.id}')" style="background-color: #0288d1; color: white; padding: 10px; border: none; border-radius: 6px; font-weight: bold;">Guardar</button>
                            <button onclick="renderizarTablaGastos()" style="background-color: #757575; color: white; padding: 10px; border: none; border-radius: 6px; font-weight: bold;">Cancelar</button>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            // MODO LECTURA
            const esRecurrenteTexto = gasto.recurrente === "si" ? "🔄 Recurrente" : "📌 Puntual";

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px;"><strong>${gasto.nombre}</strong></td>
                    <td class="col-recurrente" style="padding: 8px; text-align: center; font-size: 13px; color: #555;">${esRecurrenteTexto}</td>
                    <td class="col-monto" style="padding: 8px; text-align: right; font-weight: bold; color: #c62828;">${formatMoneda(gasto.monto)}</td>
                    <td class="td-acciones" style="padding: 8px; text-align: center;">
                        <button onclick="renderizarTablaGastos('${gasto.id}')" style="background: none; border: none; cursor: pointer; font-size: 18px;" title="Editar">✏️</button>
                        <button onclick="borrarGasto('${gasto.id}')" style="background: none; border: none; cursor: pointer; font-size: 18px;" title="Eliminar">🗑️</button>
                    </td>
                </tr>
            `;
        }
    });
}

function mostrarFilaNuevoGasto() { renderizarTablaGastos("NUEVO"); }

// GUARDAR NUEVO GASTO
async function guardarNuevoGasto() {
    const usuarioActual = auth.currentUser;
    const nombre = document.getElementById("inputNombreGasto").value.trim();
    const recurrente = document.getElementById("selectRecurrente").value;
    const monto = parseFloat(document.getElementById("inputMontoGasto").value);

    if (!nombre || isNaN(monto) || monto <= 0) {
        alert("Por favor completa el nombre del gasto y un monto válido.");
        return;
    }

    const { claveMes } = obtenerInfoMesActual();

    try {
        await db.collection("usuarios").doc(usuarioActual.uid).collection("presupuestos").doc(claveMes).collection("gastos").add({
            nombre: nombre,
            recurrente: recurrente,
            monto: monto,
            fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        alert("Error al registrar gasto: " + error.message);
    }
}

// ACTUALIZAR GASTO
async function actualizarGasto(id) {
    const usuarioActual = auth.currentUser;
    const nombre = document.getElementById(`editNombreGasto_${id}`).value.trim();
    const recurrente = document.getElementById(`editRecurrente_${id}`).value;
    const monto = parseFloat(document.getElementById(`editMontoGasto_${id}`).value);

    if (!nombre || isNaN(monto) || monto <= 0) {
        alert("Por favor completa los datos correctamente.");
        return;
    }

    const { claveMes } = obtenerInfoMesActual();

    try {
        await db.collection("usuarios").doc(usuarioActual.uid).collection("presupuestos").doc(claveMes).collection("gastos").doc(id).update({
            nombre: nombre,
            recurrente: recurrente,
            monto: monto
        });
    } catch (error) {
        alert("Error al actualizar gasto: " + error.message);
    }
}

// BORRAR GASTO
async function borrarGasto(id) {
    if (confirm("¿Deseas eliminar este gasto?")) {
        const usuarioActual = auth.currentUser;
        const { claveMes } = obtenerInfoMesActual();

        try {
            await db.collection("usuarios").doc(usuarioActual.uid).collection("presupuestos").doc(claveMes).collection("gastos").doc(id).delete();
        } catch (error) {
            alert("Error al eliminar gasto: " + error.message);
        }
    }
}