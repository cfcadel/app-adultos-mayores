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

// Renderizar la tabla de turnos
function renderizarTablaTurnos(idEdicion = null) {
    const tbody = document.getElementById("tablaTurnosBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    // Fila para agregar nuevo turno
    if (idEdicion === "NUEVO") {
        tbody.innerHTML += `
            <tr style="background-color: #fff9c4;">
                <td style="padding: 5px;">
                    <input type="text" id="inputEspecialidadTurno" placeholder="Ej: Cardiología / Dr. Gómez" style="width: 100%;">
                </td>
                <td style="padding: 5px;">
                    <input type="date" id="inputFechaTurno" style="width: 100%;">
                </td>
                <td style="padding: 5px;">
                    <input type="time" id="inputHoraTurno" style="width: 100%;">
                </td>
                <td style="padding: 5px; display: flex; gap: 5px; justify-content: center;">
                    <button onclick="guardarNuevoTurno()" style="background-color: #2e7d32; color: white; padding: 8px; border: none; border-radius: 4px; cursor: pointer;">Guardar</button>
                    <button onclick="renderizarTablaTurnos()" style="background-color: #757575; color: white; padding: 8px; border: none; border-radius: 4px; cursor: pointer;">Cancelar</button>
                </td>
            </tr>
        `;
    }

    if (turnosGuardados.length === 0 && idEdicion !== "NUEVO") {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 15px; color: #757575;">
                    No tienes turnos pendientes programados.
                </td>
            </tr>
        `;
        return;
    }

    turnosGuardados.forEach((turno) => {
        if (idEdicion === turno.id) {
            // Fila en modo edición
            tbody.innerHTML += `
                <tr style="background-color: #e8f5e9;">
                    <td style="padding: 5px;">
                        <input type="text" id="editEspecialidadTurno_${turno.id}" value="${turno.especialidad}" style="width: 100%;">
                    </td>
                    <td style="padding: 5px;">
                        <input type="date" id="editFechaTurno_${turno.id}" value="${turno.fecha}" style="width: 100%;">
                    </td>
                    <td style="padding: 5px;">
                        <input type="time" id="editHoraTurno_${turno.id}" value="${turno.hora}" style="width: 100%;">
                    </td>
                    <td style="padding: 5px; display: flex; gap: 5px; justify-content: center;">
                        <button onclick="actualizarTurno('${turno.id}')" style="background-color: #2e7d32; color: white; padding: 8px; border: none; border-radius: 4px; cursor: pointer;">Guardar</button>
                        <button onclick="renderizarTablaTurnos()" style="background-color: #757575; color: white; padding: 8px; border: none; border-radius: 4px; cursor: pointer;">Cancelar</button>
                    </td>
                </tr>
            `;
        } else {
            // Fila normal
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 10px;"><strong>${turno.especialidad}</strong></td>
                    <td style="padding: 10px;">${formatearFechaLectura(turno.fecha)}</td>
                    <td style="padding: 10px;">${turno.hora} hs</td>
                    <td style="padding: 10px; text-align: center;">
                        <button onclick="renderizarTablaTurnos('${turno.id}')" style="background:none; border:none; cursor:pointer;" title="Editar">✏️</button>
                        <button onclick="borrarTurno('${turno.id}')" style="background:none; border:none; cursor:pointer;" title="Eliminar">🗑️</button>
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
            fechaHora: firebase.firestore.Timestamp.fromDate(fechaHoraTurno), // Nuevo campo
            recordatorio24hEnviado: false, // Bandera de control
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
            fechaHora: firebase.firestore.Timestamp.fromDate(fechaHoraTurno), // Actualizamos el timestamp
            recordatorio24hEnviado: false // Reiniciamos por si se cambió de día
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