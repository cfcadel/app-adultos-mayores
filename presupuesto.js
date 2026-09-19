// ==========================================
// MÓDULO DE PRESUPUESTO MENSUAL (REFINADO)
// ==========================================

let gastosGuardados = [];
let ingresosAdicGuardados = [];
let ingresoPrincipalActual = 0;
let saldoAnteriorActual = 0;

auth.onAuthStateChanged((user) => {
    if (user) {
        inicializarPresupuesto(user.uid);
    }
});

function obtenerInfoMesActual() {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mesNumero = String(ahora.getMonth() + 1).padStart(2, '0');
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return {
        claveMes: `${anio}-${mesNumero}`,
        nombreMes: `${meses[ahora.getMonth()]} ${anio}`
    };
}

function obtenerInfoMesAnterior() {
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() - 1);
    const anio = fecha.getFullYear();
    const mesNumero = String(fecha.getMonth() + 1).padStart(2, '0');
    return { claveMesAnterior: `${anio}-${mesNumero}` };
}

async function inicializarPresupuesto(uid) {
    const { claveMes, nombreMes } = obtenerInfoMesActual();
    document.getElementById("tituloMesActual").innerText = nombreMes;

    const mesRef = db.collection("usuarios").doc(uid).collection("presupuestos").doc(claveMes);
    const docMes = await mesRef.get();

    // Si el mes no existe, ejecutamos la lógica de transición de mes
    if (!docMes.exists) {
        await realizarTransicionDeMes(uid, claveMes);
    }

    // Comenzamos a escuchar los cambios en tiempo real del mes actual
    escucharMesActual(uid, claveMes);
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

        // 1. Calcular Gastos e identificar recurrentes
        let totalGastosAnt = 0;
        const snapshotGastos = await mesAntRef.collection("gastos").get();
        snapshotGastos.forEach(doc => {
            const g = doc.data();
            totalGastosAnt += parseFloat(g.monto) || 0;
            if (g.recurrente === 'si') {
                gastosRecurrentesACopiar.push(g.nombre);
            }
        });

        // 2. Calcular Ingresos Adicionales e identificar recurrentes
        let totalIngresosAdicAnt = 0;
        const snapshotIngresos = await mesAntRef.collection("ingresosAdicionales").get();
        snapshotIngresos.forEach(doc => {
            const ing = doc.data();
            totalIngresosAdicAnt += parseFloat(ing.monto) || 0;
            if (ing.recurrente === 'si') {
                ingresosRecurrentesACopiar.push(ing.nombre);
            }
        });

        // Saldo Final del mes anterior
        nuevoSaldoAnterior = (ingresoAnt + saldoArrastradoAnt + totalIngresosAdicAnt) - totalGastosAnt;

        // Preguntar al usuario si mantiene su ingreso principal
        if (ingresoAnt > 0) {
            const mantener = confirm(`¡Comenzó un nuevo mes!\n\nTu Ingreso Principal (Jubilación/Sueldo) anterior fue de $${ingresoAnt}.\n¿Sigue siendo el mismo monto para este mes?`);
            if (mantener) {
                nuevoIngresoPrincipal = ingresoAnt;
            }
        }
    }

    // 3. Crear el nuevo mes usando Batch
    const batch = db.batch();
    const nuevoMesRef = db.collection("usuarios").doc(uid).collection("presupuestos").doc(claveMesActual);
    
    batch.set(nuevoMesRef, {
        ingresoPrincipal: nuevoIngresoPrincipal,
        saldoAnterior: nuevoSaldoAnterior,
        fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 4. Copiar los gastos recurrentes con valor $0
    gastosRecurrentesACopiar.forEach(nombreGasto => {
        const nuevoGastoRef = nuevoMesRef.collection("gastos").doc();
        batch.set(nuevoGastoRef, {
            nombre: nombreGasto,
            recurrente: 'si',
            monto: 0,
            fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
        });
    });

    // 5. Copiar los ingresos adicionales recurrentes con valor $0
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
// ESCUCHAS EN TIEMPO REAL
// ==========================================
function escucharMesActual(uid, claveMes) {
    const mesRef = db.collection("usuarios").doc(uid).collection("presupuestos").doc(claveMes);

    mesRef.onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            ingresoPrincipalActual = data.ingresoPrincipal || 0;
            saldoAnteriorActual = data.saldoAnterior || 0;

            if (ingresoPrincipalActual > 0) {
                renderizarPantallaCompleta();
            } else {
                renderizarSolicitudIngreso();
            }
        }
    });

    mesRef.collection("gastos").orderBy("fechaRegistro", "desc").onSnapshot((snapshot) => {
        gastosGuardados = [];
        snapshot.forEach(doc => gastosGuardados.push({ id: doc.id, ...doc.data() }));
        if (ingresoPrincipalActual > 0) {
            renderizarTablaGastos();
            actualizarTotales();
        }
    });

    mesRef.collection("ingresosAdicionales").orderBy("fechaRegistro", "desc").onSnapshot((snapshot) => {
        ingresosAdicGuardados = [];
        snapshot.forEach(doc => ingresosAdicGuardados.push({ id: doc.id, ...doc.data() }));
        if (ingresoPrincipalActual > 0) {
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
    const usuarioActual = auth.currentUser;
    const input = document.getElementById("inputIngresoMensual");
    const valor = parseFloat(input.value);

    if (isNaN(valor) || valor < 0) {
        alert("Por favor ingresa un monto válido.");
        return;
    }

    const { claveMes } = obtenerInfoMesActual();

    try {
        await db.collection("usuarios").doc(usuarioActual.uid).collection("presupuestos").doc(claveMes).set({
            ingresoPrincipal: valor
        }, { merge: true });
    } catch (error) {
        alert("Error al guardar: " + error.message);
    }
}

// ==========================================
// GESTIÓN DE INGRESOS ADICIONALES
// ==========================================
function renderizarTablaIngresosAdic(idEdicion = null) {
    const tbody = document.getElementById("tablaIngresosAdicBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (idEdicion === "NUEVO") {
        tbody.innerHTML += `
            <tr style="background-color: #fff9c4;">
                <td style="padding: 5px;">
                    <input type="text" id="inputNombreIngreso" placeholder="Ej: Venta tortas">
                </td>
                <td class="col-recurrente" style="padding: 5px;">
                    <select id="selectRecurrenteIngreso"><option value="no">No</option><option value="si">Sí</option></select>
                </td>
                <td class="col-monto" style="padding: 5px;">
                    <input type="number" id="inputMontoIngreso" placeholder="0">
                </td>
                <td style="padding: 5px; display: flex; gap: 5px;">
                    <button onclick="guardarIngresoAdicional()" style="background-color: #1976d2; color: white; padding: 8px; border: none; border-radius: 4px; flex: 1;">Guardar</button>
                    <button onclick="renderizarTablaIngresosAdic()" style="background-color: #757575; color: white; padding: 8px; border: none; border-radius: 4px; flex: 1;">Cancelar</button>
                </td>
            </tr>
        `;
    }

    ingresosAdicGuardados.forEach((ing) => {
        const alertaCero = ing.monto === 0 ? "⚠️ Cargar monto" : "";

        if (idEdicion === ing.id) {
            tbody.innerHTML += `
                <tr style="background-color: #e3f2fd;">
                    <td style="padding: 5px;"><input type="text" id="editNombreIngreso_${ing.id}" value="${ing.nombre}"></td>
                    <td class="col-recurrente" style="padding: 5px;">
                        <select id="editRecurrenteIngreso_${ing.id}">
                            <option value="si" ${ing.recurrente === 'si' ? 'selected' : ''}>Sí</option>
                            <option value="no" ${ing.recurrente === 'no' ? 'selected' : ''}>No</option>
                        </select>
                    </td>
                    <td class="col-monto" style="padding: 5px;"><input type="number" id="editMontoIngreso_${ing.id}" value="${ing.monto}"></td>
                    <td style="padding: 5px; display: flex; gap: 5px;">
                        <button onclick="actualizarIngresoAdicional('${ing.id}')" style="background-color: #1976d2; color: white; padding: 8px; border: none; border-radius: 4px; flex:1;">Guardar</button>
                        <button onclick="renderizarTablaIngresosAdic()" style="background-color: #757575; color: white; padding: 8px; border: none; border-radius: 4px; flex:1;">Cancelar</button>
                    </td>
                </tr>
            `;
        } else {
            const estiloFila = ing.monto === 0 ? "background-color: #e3f2fd; border-left: 4px solid #1976d2;" : "border-bottom: 1px solid #ddd;";

            tbody.innerHTML += `
                <tr style="${estiloFila}">
                    <td style="padding: 8px;"><strong>${ing.nombre}</strong> <br><small style="color:#1976d2;">${alertaCero}</small></td>
                    <td class="col-recurrente" style="padding: 8px; text-align: center; font-size: 13px; color: #555;">${ing.recurrente === "si" ? "🔄 Sí" : "📌 No"}</td>
                    <td class="col-monto" style="padding: 8px; text-align: right; font-weight: bold; color: #1976d2;">+ ${formatMoneda(ing.monto)}</td>
                    <td style="padding: 8px; text-align: center;">
                        <button onclick="renderizarTablaIngresosAdic('${ing.id}')" style="background:none; border:none; cursor:pointer;">✏️</button>
                        <button onclick="borrarIngresoAdicional('${ing.id}')" style="background:none; border:none; cursor:pointer;">🗑️</button>
                    </td>
                </tr>
            `;
        }
    });
}

function mostrarFilaNuevoIngresoAdic() { renderizarTablaIngresosAdic("NUEVO"); }

async function guardarIngresoAdicional() {
    const usuario = auth.currentUser;
    const nombre = document.getElementById("inputNombreIngreso").value.trim();
    const recurrente = document.getElementById("selectRecurrenteIngreso").value;
    const monto = parseFloat(document.getElementById("inputMontoIngreso").value);

    if (!nombre || isNaN(monto) || monto < 0) return alert("Completa los datos correctamente.");
    
    const { claveMes } = obtenerInfoMesActual();
    await db.collection("usuarios").doc(usuario.uid).collection("presupuestos").doc(claveMes).collection("ingresosAdicionales").add({
        nombre, recurrente, monto, fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function actualizarIngresoAdicional(id) {
    const usuario = auth.currentUser;
    const nombre = document.getElementById(`editNombreIngreso_${id}`).value.trim();
    const recurrente = document.getElementById(`editRecurrenteIngreso_${id}`).value;
    const monto = parseFloat(document.getElementById(`editMontoIngreso_${id}`).value);

    if (!nombre || isNaN(monto) || monto < 0) return alert("Datos inválidos.");
    
    const { claveMes } = obtenerInfoMesActual();
    await db.collection("usuarios").doc(usuario.uid).collection("presupuestos").doc(claveMes).collection("ingresosAdicionales").doc(id).update({ 
        nombre, recurrente, monto 
    });
}

async function borrarIngresoAdicional(id) {
    if (!confirm("¿Eliminar este ingreso?")) return;
    const { claveMes } = obtenerInfoMesActual();
    await db.collection("usuarios").doc(auth.currentUser.uid).collection("presupuestos").doc(claveMes).collection("ingresosAdicionales").doc(id).delete();
}


// ==========================================
// GESTIÓN DE GASTOS MENSUALES
// ==========================================
function renderizarTablaGastos(idEdicion = null) {
    const tbody = document.getElementById("tablaGastosBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (idEdicion === "NUEVO") {
        tbody.innerHTML += `
            <tr class="form-crear-gasto" style="background-color: #fff9c4;">
                <td style="padding: 5px;"><input type="text" id="inputNombreGasto" placeholder="Ej: Luz"></td>
                <td class="col-recurrente" style="padding: 5px;">
                    <select id="selectRecurrente"><option value="si">Sí</option><option value="no">No</option></select>
                </td>
                <td class="col-monto" style="padding: 5px;"><input type="number" id="inputMontoGasto" placeholder="0"></td>
                <td class="td-acciones" style="padding: 5px; display: flex; gap: 5px;">
                    <button onclick="guardarNuevoGasto()" style="background-color: #c62828; color: white; padding: 8px; border: none; border-radius: 4px; flex: 1;">Guardar</button>
                    <button onclick="renderizarTablaGastos()" style="background-color: #757575; color: white; padding: 8px; border: none; border-radius: 4px; flex: 1;">Cancelar</button>
                </td>
            </tr>
        `;
    }

    gastosGuardados.forEach((gasto) => {
        const alertaCero = gasto.monto === 0 ? "⚠️ Cargar monto" : "";

        if (idEdicion === gasto.id) {
            tbody.innerHTML += `
                <tr class="form-crear-gasto" style="background-color: #ffebee;">
                    <td style="padding: 5px;"><input type="text" id="editNombreGasto_${gasto.id}" value="${gasto.nombre}"></td>
                    <td class="col-recurrente" style="padding: 5px;">
                        <select id="editRecurrente_${gasto.id}">
                            <option value="si" ${gasto.recurrente === 'si' ? 'selected' : ''}>Sí</option>
                            <option value="no" ${gasto.recurrente === 'no' ? 'selected' : ''}>No</option>
                        </select>
                    </td>
                    <td class="col-monto" style="padding: 5px;"><input type="number" id="editMontoGasto_${gasto.id}" value="${gasto.monto}"></td>
                    <td class="td-acciones" style="padding: 5px; display: flex; gap: 5px;">
                        <button onclick="actualizarGasto('${gasto.id}')" style="background-color: #c62828; color: white; padding: 8px; border: none; border-radius: 4px; flex:1;">Guardar</button>
                        <button onclick="renderizarTablaGastos()" style="background-color: #757575; color: white; padding: 8px; border: none; border-radius: 4px; flex:1;">Cancelar</button>
                    </td>
                </tr>
            `;
        } else {
            const estiloFila = gasto.monto === 0 ? "background-color: #fff3e0; border-left: 4px solid #e65100;" : "border-bottom: 1px solid #ddd;";
            
            tbody.innerHTML += `
                <tr style="${estiloFila}">
                    <td style="padding: 8px;"><strong>${gasto.nombre}</strong> <br><small style="color:#e65100;">${alertaCero}</small></td>
                    <td class="col-recurrente" style="padding: 8px; text-align: center; font-size: 13px; color: #555;">${gasto.recurrente === "si" ? "🔄 Sí" : "📌 No"}</td>
                    <td class="col-monto" style="padding: 8px; text-align: right; font-weight: bold; color: #c62828;">- ${formatMoneda(gasto.monto)}</td>
                    <td class="td-acciones" style="padding: 8px; text-align: center;">
                        <button onclick="renderizarTablaGastos('${gasto.id}')" style="background: none; border: none; cursor: pointer;">✏️</button>
                        <button onclick="borrarGasto('${gasto.id}')" style="background: none; border: none; cursor: pointer;">🗑️</button>
                    </td>
                </tr>
            `;
        }
    });
}

function mostrarFilaNuevoGasto() { renderizarTablaGastos("NUEVO"); }

async function guardarNuevoGasto() {
    const usuario = auth.currentUser;
    const nombre = document.getElementById("inputNombreGasto").value.trim();
    const recurrente = document.getElementById("selectRecurrente").value;
    const monto = parseFloat(document.getElementById("inputMontoGasto").value);

    if (!nombre || isNaN(monto) || monto < 0) return alert("Completa correctamente.");

    const { claveMes } = obtenerInfoMesActual();
    await db.collection("usuarios").doc(usuario.uid).collection("presupuestos").doc(claveMes).collection("gastos").add({
        nombre, recurrente, monto, fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function actualizarGasto(id) {
    const usuario = auth.currentUser;
    const nombre = document.getElementById(`editNombreGasto_${id}`).value.trim();
    const recurrente = document.getElementById(`editRecurrente_${id}`).value;
    const monto = parseFloat(document.getElementById(`editMontoGasto_${id}`).value);

    if (!nombre || isNaN(monto) || monto < 0) return alert("Datos inválidos.");

    const { claveMes } = obtenerInfoMesActual();
    await db.collection("usuarios").doc(usuario.uid).collection("presupuestos").doc(claveMes).collection("gastos").doc(id).update({
        nombre, recurrente, monto
    });
}

async function borrarGasto(id) {
    if (!confirm("¿Deseas eliminar este gasto?")) return;
    const { claveMes } = obtenerInfoMesActual();
    await db.collection("usuarios").doc(auth.currentUser.uid).collection("presupuestos").doc(claveMes).collection("gastos").doc(id).delete();
}