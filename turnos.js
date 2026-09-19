// ==========================================
// MÓDULO DE TURNOS MÉDICOS
// ==========================================

let turnosGuardados = [];
let unsubTurnos = null;

auth.onAuthStateChanged((user) => {
    if (user) {
        escucharTurnos(user.uid);
    }
});

// Escuchar los turnos en tiempo real ordenados por fecha
function escucharTurnos(uid) {
    if (unsubTurnos) unsubTurnos();

    const turnosRef = db.collection("usuarios").doc(uid).collection("turnos").orderBy("fecha", "asc");

    unsubTurnos = turnosRef.onSnapshot((snapshot) => {
        turnosGuardados = [];
        snapshot.forEach((doc) => {
            turnosGuardados.push({ id: doc.id, ...doc.data() });
        });
        renderizarTablaTurnos();
    }, (error) => {
        console.error("Error al escuchar turnos:", error);
    });
}

// Renderizar la lista de turnos (Formato tabulado en PC y condensado en Mobile)
function renderizarTablaTurnos(idEdicion = null) {
    const contenedor = document.getElementById("tablaTurnosBody");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    // 1. FORMULARIO PARA AGREGAR UN NUEVO TURNO
    if (idEdicion === "NUEVO") {
        contenedor.innerHTML += `
            <tr class="fila-formulario">
                <td colspan="4" style="padding: 10px 0;">
                    <div style="background-color: #fffde7; border: 1px solid #fff59d; border-radius: 12px; padding: 15px; text-align: left;">
                        <div style="margin-bottom: 10px;">
                            <label style="font-weight: bold; color: #333; display: block; margin-bottom: 4px;">Especialidad / Médico:</label>
                            <input type="text" id="inputEspecialidadTurno" placeholder="Ej: Cardiología / Dr. Gómez" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px;">
                        </div>
                        
                        <div style="margin-bottom: 10px;">
                            <label style="font-weight: bold; color: #333; display: block; margin-bottom: 4px;">Fecha del Turno:</label>
                            <input type="date" id="inputFechaTurno" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px;">
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                            <label style="font-weight: bold; color: #333; display: block; margin-bottom: 4px;">Hora del Turno:</label>
                            <input type="time" id="inputHoraTurno" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px;">
                        </div>
                        
                        <div style="display: flex; gap: 10px;">
                            <button onclick="guardarNuevoTurno()" style="flex: 1; background-color: #2e7d32; color: white; padding: 10px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Guardar</button>
                            <button onclick="renderizarTablaTurnos()" style="flex: 1; background-color: #757575; color: white; padding: 10px; border: none; border-radius: 6px; cursor: pointer;">Cancelar</button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }

    // 2. SI NO HAY TURNOS REGISTRADOS
    if (turnosGuardados.length === 0 && idEdicion !== "NUEVO") {
        contenedor.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 20px; color: #757575;">
                    No tienes turnos pendientes programados.
                </td>
            </tr>
        `;
        return;
    }

    // 3. RECORRER Y RENDERIZAR CADA TURNO
    turnosGuardados.forEach((turno) => {
        if (idEdicion === turno.id) {
            // Formulario en modo edición
            contenedor.innerHTML += `
                <tr class="fila-formulario">
                    <td colspan="4" style="padding: 10px 0;">
                        <div style="background-color: #e8f5e9; border: 1px solid #c8e6c9; border-radius: 12px; padding: 15px; text-align: left;">
                            <div style="margin-bottom: 10px;">
                                <label style="font-weight: bold; color: #2e7d32; display: block; margin-bottom: 4px;">Especialidad / Médico:</label>
                                <input type="text" id="editEspecialidadTurno_${turno.id}" value="${turno.especialidad}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px;">
                            </div>
                            
                            <div style="margin-bottom: 10px;">
                                <label style="font-weight: bold; color: #2e7d32; display: block; margin-bottom: 4px;">Fecha del Turno:</label>
                                <input type="date" id="editFechaTurno_${turno.id}" value="${turno.fecha}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px;">
                            </div>
                            
                            <div style="margin-bottom: 15px;">
                                <label style="font-weight: bold; color: #2e7d32; display: block; margin-bottom: 4px;">Hora del Turno:</label>
                                <input type="time" id="editHoraTurno_${turno.id}" value="${turno.hora}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px;">
                            </div>
                            
                            <div style="display: flex; gap: 10px;">
                                <button onclick="actualizarTurno('${turno.id}')" style="flex: 1; background-color: #2e7d32; color: white; padding: 10px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Guardar</button>
                                <button onclick="renderizarTablaTurnos()" style="flex: 1; background-color: #757575; color: white; padding: 10px; border: none; border-radius: 6px; cursor: pointer;">Cancelar</button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            // Fila de turno guardado (4 columnas en PC, 2 en Mobile gracias al CSS)
            contenedor.innerHTML += `
                <tr>
                    <!-- Columna 1: Especialidad / Médico -->
                    <td class="col-especialidad">
                        <strong style="font-size: 15px; color: #222;">${turno.especialidad}</strong>
                        
                        <!-- Fecha y Hora combinadas VISIBLES SOLO EN MOBILE -->
                        <div class="info-mobile-turnos">
                            📅 ${formatearFechaLectura(turno.fecha)} &nbsp;|&nbsp; ⏰ ${turno.hora} hs
                        </div>
                    </td>

                    <!-- Columna 2: Fecha (Visible solo en PC) -->
                    <td class="col-fecha">
                        ${formatearFechaLectura(turno.fecha)}
                    </td>

                    <!-- Columna 3: Hora (Visible solo en PC) -->
                    <td class="col-hora">
                        ${turno.hora} hs
                    </td>

                    <!-- Columna 4: Acciones -->
                    <td class="col-acciones">
                        <button onclick="renderizarTablaTurnos('${turno.id}')" class="btn-accion-icono" title="Editar">✏️</button>
                        <button onclick="borrarTurno('${turno.id}')" class="btn-accion-icono" title="Eliminar">🗑️</button>
                    </td>
                </tr>
            `;
        }
    });
}

function mostrarFilaNuevoTurno() {
    renderizarTablaTurnos("NUEVO");
}

// Guardar un nuevo turno en Firestore
async function guardarNuevoTurno() {
    const user = auth.currentUser;
    if (!user) return;

    const especialidad = document.getElementById("inputEspecialidadTurno").value.trim();
    const fecha = document.getElementById("inputFechaTurno").value;
    const hora = document.getElementById("inputHoraTurno").value;

    if (!especialidad || !fecha || !hora) {
        alert("Por favor completa la especialidad/médico, la fecha y la hora.");
        return;
    }

    // Unificamos fecha y hora para que el servidor pueda calcular rangos de 24hs
    const fechaHoraTurno = new Date(`${fecha}T${hora}:00`);

    try {
        await db.collection("usuarios").doc(user.uid).collection("turnos").add({
            especialidad: especialidad,
            fecha: fecha,
            hora: hora,
            fechaHora: firebase.firestore.Timestamp.fromDate(fechaHoraTurno),
            recordatorio24hEnviado: false,
            fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        alert("Error al guardar el turno: " + error.message);
    }
}

// Actualizar un turno existente
async function actualizarTurno(id) {
    const user = auth.currentUser;
    if (!user) return;

    const especialidad = document.getElementById(`editEspecialidadTurno_${id}`).value.trim();
    const fecha = document.getElementById(`editFechaTurno_${id}`).value;
    const hora = document.getElementById(`editHoraTurno_${id}`).value;

    if (!especialidad || !fecha || !hora) {
        alert("Todos los campos son obligatorios.");
        return;
    }

    const fechaHoraTurno = new Date(`${fecha}T${hora}:00`);

    try {
        await db.collection("usuarios").doc(user.uid).collection("turnos").doc(id).update({
            especialidad: especialidad,
            fecha: fecha,
            hora: hora,
            fechaHora: firebase.firestore.Timestamp.fromDate(fechaHoraTurno),
            recordatorio24hEnviado: false
        });
    } catch (error) {
        alert("Error al actualizar: " + error.message);
    }
}

// Borrar un turno
async function borrarTurno(id) {
    if (!confirm("¿Estás seguro de que deseas eliminar este turno?")) return;

    const user = auth.currentUser;
    if (!user) return;

    try {
        await db.collection("usuarios").doc(user.uid).collection("turnos").doc(id).delete();
    } catch (error) {
        alert("Error al eliminar: " + error.message);
    }
}

// Helper para mostrar la fecha YYYY-MM-DD en formato legible DD/MM/YYYY
function formatearFechaLectura(fechaStr) {
    if (!fechaStr) return "";
    const partes = fechaStr.split("-");
    if (partes.length !== 3) return fechaStr;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}