// ==========================================
// MÓDULO DE MEDICAMENTOS (TOMAS DIARIAS Y HORARIO AUTOMÁTICO)
// ==========================================

let medicamentosGuardados = [];

auth.onAuthStateChanged((user) => {
    if (user) {
        cargarMedicamentos(user.uid);
    }
});

function cargarMedicamentos(uid) {
    db.collection("usuarios").doc(uid).collection("medicamentos")
      .orderBy("fechaRegistro", "desc")
      .onSnapshot((snapshot) => {
          medicamentosGuardados = [];
          snapshot.forEach((doc) => {
              medicamentosGuardados.push({ id: doc.id, ...doc.data() });
          });
          renderizarTabla();
      });
}

function renderizarTabla(idEdicion = null) {
    const tbody = document.getElementById("tablaMedicamentosBody");
    tbody.innerHTML = "";

    // 1. FILA DE CREACIÓN
    if (idEdicion === "NUEVO") {
        tbody.innerHTML += `
            <tr class="form-crear-medicamento" style="background-color: #fff9c4;">
                <td style="padding: 5px;">
                    <label class="label-mobile" style="display:none; font-weight:bold; font-size:12px;">Nombre y Gramaje:</label>
                    <input type="text" id="inputNombre" placeholder="Ej: Tafirol 500mg">
                </td>
                <td class="col-tomas-diarias" style="padding: 5px;">
                    <label class="label-mobile" style="display:none; font-weight:bold; font-size:12px;">Tomas Diarias:</label>
                    <select id="selectVeces">
                        ${generarOpcionesVeces(1)}
                    </select>
                </td>
                <td class="col-primera-toma" style="padding: 5px;">
                    <label class="label-mobile" style="display:none; font-weight:bold; font-size:12px;">1ª Toma:</label>
                    <input type="time" id="inputPrimeraToma">
                </td>
                <td class="col-horarios" style="padding: 5px; color: #777; font-size: 12px; text-align: center;"></td>
                <td class="td-acciones" style="padding: 5px;">
                    <div class="contenedor-botones-form" style="width: 100%;">
                        <button onclick="guardarNuevoMedicamento()" class="btn-guardar" style="background-color: #2e7d32; color: white; padding: 10px; border: none; border-radius: 6px; font-weight: bold;">Guardar</button>
                        <button onclick="renderizarTabla()" class="btn-cancelar" style="background-color: #757575; color: white; padding: 10px; border: none; border-radius: 6px; font-weight: bold;">Cancelar</button>
                    </div>
                </td>
            </tr>
        `;
    }

    // 2. FILAS DE MEDICAMENTOS REGISTRADOS
    medicamentosGuardados.forEach((med) => {
        if (idEdicion === med.id) {
            // MODO EDICIÓN
            tbody.innerHTML += `
                <tr class="form-crear-medicamento" style="background-color: #e1f5fe;">
                    <td style="padding: 5px;">
                        <label class="label-mobile" style="display:none; font-weight:bold; font-size:12px;">Nombre y Gramaje:</label>
                        <input type="text" id="editNombre_${med.id}" value="${med.nombre}">
                    </td>
                    <td class="col-tomas-diarias" style="padding: 5px;">
                        <label class="label-mobile" style="display:none; font-weight:bold; font-size:12px;">Tomas Diarias:</label>
                        <select id="editSelectVeces_${med.id}">
                            ${generarOpcionesVeces(med.veces)}
                        </select>
                    </td>
                    <td class="col-primera-toma" style="padding: 5px;">
                        <label class="label-mobile" style="display:none; font-weight:bold; font-size:12px;">1ª Toma:</label>
                        <input type="time" id="editPrimeraToma_${med.id}" value="${med.primeraToma || ''}">
                    </td>
                    <td class="col-horarios" style="padding: 5px; color: #777; font-size: 12px; text-align: center;"></td>
                    <td class="td-acciones" style="padding: 5px;">
                        <div class="contenedor-botones-form" style="width: 100%;">
                            <button onclick="actualizarMedicamento('${med.id}')" class="btn-guardar" style="background-color: #0288d1; color: white; padding: 10px; border: none; border-radius: 6px; font-weight: bold;">Guardar</button>
                            <button onclick="renderizarTabla()" class="btn-cancelar" style="background-color: #757575; color: white; padding: 10px; border: none; border-radius: 6px; font-weight: bold;">Cancelar</button>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            // MODO LECTURA
            const horariosTexto = Array.isArray(med.horariosCalculados) ? med.horariosCalculados.join(" hs, ") + " hs" : "Sin calcular";

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px;"><strong>${med.nombre}</strong></td>
                    <td class="col-tomas-diarias" style="padding: 8px;">${med.veces} ${med.veces == 1 ? 'toma' : 'tomas'} al día</td>
                    <td class="col-primera-toma" style="padding: 8px;">${med.primeraToma || '-'} hs</td>
                    <td style="padding: 8px;"><span style="color: #2e7d32; font-weight: bold;">${horariosTexto}</span></td>
                    <td class="td-acciones" style="padding: 8px; text-align: center;">
                        <button onclick="activarEdicion('${med.id}')" style="background: none; border: none; cursor: pointer; font-size: 18px;" title="Editar">✏️</button>
                        <button onclick="borrarMedicamento('${med.id}')" style="background: none; border: none; cursor: pointer; font-size: 18px;" title="Eliminar">🗑️</button>
                    </td>
                </tr>
            `;
        }
    });
}

function generarOpcionesVeces(seleccionado) {
    let html = "";
    for (let i = 1; i <= 10; i++) {
        const esSeleccionado = i == seleccionado ? "selected" : "";
        html += `<option value="${i}" ${esSeleccionado}>${i} ${i === 1 ? 'toma' : 'tomas'}</option>`;
    }
    return html;
}

// CÁLCULO AUTOMÁTICO DE HORARIOS BASADO EN 24 HORAS DIVIDIDAS POR TOMAS DIARIAS
function calcularListaHorarios(horaInicio, veces) {
    const lista = [];
    const [horas, minutos] = horaInicio.split(":").map(Number);
    const intervaloHoras = 24 / veces;
    
    let fecha = new Date();
    fecha.setHours(horas, minutos, 0);

    for (let i = 0; i < veces; i++) {
        const h = String(fecha.getHours()).padStart(2, '0');
        const m = String(fecha.getMinutes()).padStart(2, '0');
        lista.push(`${h}:${m}`);
        
        fecha.setMinutes(fecha.getMinutes() + Math.round(intervaloHoras * 60));
    }
    return lista;
}

function mostrarFilaNueva() { renderizarTabla("NUEVO"); }
function activarEdicion(id) { renderizarTabla(id); }

// GUARDAR NUEVO
async function guardarNuevoMedicamento() {
    const usuarioActual = auth.currentUser;
    if (!usuarioActual) return;

    const nombre = document.getElementById("inputNombre").value.trim();
    const veces = parseInt(document.getElementById("selectVeces").value);
    const primeraToma = document.getElementById("inputPrimeraToma").value;

    if (!nombre || !primeraToma) {
        alert("Por favor completa todos los campos requeridos.");
        return;
    }

    const horariosCalculados = calcularListaHorarios(primeraToma, veces);

    try {
        await db.collection("usuarios").doc(usuarioActual.uid).collection("medicamentos").add({
            nombre: nombre,
            veces: veces,
            primeraToma: primeraToma,
            horariosCalculados: horariosCalculados,
            fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        alert("Error al guardar: " + error.message);
    }
}

// ACTUALIZAR
async function actualizarMedicamento(id) {
    const usuarioActual = auth.currentUser;
    if (!usuarioActual) return;

    const nombre = document.getElementById(`editNombre_${id}`).value.trim();
    const veces = parseInt(document.getElementById(`editSelectVeces_${id}`).value);
    const primeraToma = document.getElementById(`editPrimeraToma_${id}`).value;

    if (!nombre || !primeraToma) {
        alert("Por favor completa todos los campos.");
        return;
    }

    const horariosCalculados = calcularListaHorarios(primeraToma, veces);

    try {
        await db.collection("usuarios").doc(usuarioActual.uid).collection("medicamentos").doc(id).update({
            nombre: nombre,
            veces: veces,
            primeraToma: primeraToma,
            horariosCalculados: horariosCalculados
        });
    } catch (error) {
        alert("Error al actualizar: " + error.message);
    }
}

// BORRAR
async function borrarMedicamento(id) {
    if (confirm("¿Estás seguro de que deseas eliminar este medicamento?")) {
        const usuarioActual = auth.currentUser;
        try {
            await db.collection("usuarios").doc(usuarioActual.uid).collection("medicamentos").doc(id).delete();
        } catch (error) {
            alert("Error al eliminar: " + error.message);
        }
    }
}

// ==========================================
// RELOJ INTERNO DE COMPROBACIÓN (CADA 1 MINUTO)
// ==========================================

setInterval(() => {
    verificarTomasProgramadas();
}, 60000);

async function verificarTomasProgramadas() {
    const usuarioActual = auth.currentUser;
    if (!usuarioActual) return;

    const ahora = new Date();
    const horas = String(ahora.getHours()).padStart(2, '0');
    const minutos = String(ahora.getMinutes()).padStart(2, '0');
    const horaActual = `${horas}:${minutos}`;

    try {
        const snapshot = await db.collection("usuarios")
            .doc(usuarioActual.uid)
            .collection("medicamentos")
            .get();

        snapshot.forEach(doc => {
            const med = doc.data();

            if (med.horariosCalculados && med.horariosCalculados.includes(horaActual)) {
                lanzarNotificacionLocal(med.nombre);
            }
        });
    } catch (error) {
        console.error("Error al verificar alarmas:", error);
    }
}

function lanzarNotificacionLocal(nombreMedicamento) {
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification("💊 Recordatorio de Medicina", {
                body: `Es hora de tomar tu medicamento: ${nombreMedicamento}`,
                icon: "https://cdn-icons-png.flaticon.com/512/3063/3063822.png",
                badge: "https://cdn-icons-png.flaticon.com/512/3063/3063822.png",
                vibrate: [200, 100, 200, 100, 200],
                tag: `alerta-${nombreMedicamento}`,
                renotify: true
            });
        });
    }
}