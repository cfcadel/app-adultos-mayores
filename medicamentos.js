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
            <tr style="background-color: #fff9c4;">
                <td style="padding: 5px;"><input type="text" id="inputNombre" placeholder="Ej: Tafirol 500mg" style="width: 160px;"></td>
                <td style="padding: 5px;">
                    <select id="selectVeces">
                        ${generarOpcionesVeces(1)}
                    </select>
                </td>
                <td style="padding: 5px;"><input type="time" id="inputPrimeraToma"></td>
                <td style="padding: 5px; color: #777; font-size: 12px;"><i>Se calculará al guardar</i></td>
                <td style="padding: 5px; text-align: center;">
                    <button onclick="guardarNuevoMedicamento()" style="background: none; border: none; cursor: pointer; font-size: 18px;" title="Guardar">✅</button>
                    <button onclick="renderizarTabla()" style="background: none; border: none; cursor: pointer; font-size: 18px;" title="Cancelar">❌</button>
                </td>
            </tr>
        `;
    }

    // 2. FILAS DE MEDICAMENTOS REGISTRADOS
    medicamentosGuardados.forEach((med) => {
        if (idEdicion === med.id) {
            // MODO EDICIÓN
            tbody.innerHTML += `
                <tr style="background-color: #e1f5fe;">
                    <td style="padding: 5px;"><input type="text" id="editNombre_${med.id}" value="${med.nombre}" style="width: 160px;"></td>
                    <td style="padding: 5px;">
                        <select id="editSelectVeces_${med.id}">
                            ${generarOpcionesVeces(med.veces)}
                        </select>
                    </td>
                    <td style="padding: 5px;"><input type="time" id="editPrimeraToma_${med.id}" value="${med.primeraToma || ''}"></td>
                    <td style="padding: 5px; color: #777; font-size: 12px;"><i>Recalculando...</i></td>
                    <td style="padding: 5px; text-align: center;">
                        <button onclick="actualizarMedicamento('${med.id}')" style="background: none; border: none; cursor: pointer; font-size: 18px;" title="Guardar Cambios">✅</button>
                        <button onclick="renderizarTabla()" style="background: none; border: none; cursor: pointer; font-size: 18px;" title="Cancelar">❌</button>
                    </td>
                </tr>
            `;
        } else {
            // MODO LECTURA
            const horariosTexto = Array.isArray(med.horariosCalculados) ? med.horariosCalculados.join(" hs, ") + " hs" : "Sin calcular";

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px;"><strong>${med.nombre}</strong></td>
                    <td style="padding: 8px;">${med.veces} ${med.veces == 1 ? 'toma' : 'tomas'} al día</td>
                    <td style="padding: 8px;">${med.primeraToma || '-'} hs</td>
                    <td style="padding: 8px;"><span style="color: #2e7d32; font-weight: bold;">${horariosTexto}</span></td>
                    <td style="padding: 8px; text-align: center;">
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
        
        // Sumar horas equivalentes al día dividido las tomas
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