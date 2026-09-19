// ==========================================
// MÓDULO DE CONTACTOS (MÉDICO Y MÚLTIPLES FAMILIARES)
// ==========================================

let itiMedico = null;
let itiNuevoFamiliar = null;
let itiEdicionMap = {};
let unsubFamiliares = null;

auth.onAuthStateChanged((user) => {
    if (user) {
        inicializarWidgetsTelefono();
        cargarContactoMedico(user.uid);
        escucharFamiliares(user.uid);
    }
});

// Función helper para inicializar el widget intlTelInput
function crearIti(inputElement) {
    if (!inputElement) return null;
    return window.intlTelInput(inputElement, {
        initialCountry: "ar",
        separateDialCode: true,
        preferredCountries: ["ar", "cl", "uy", "br", "es", "us"],
        utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js"
    });
}

function inicializarWidgetsTelefono() {
    const inputMedico = document.getElementById("contactoMedicoTel");
    const inputNuevoFam = document.getElementById("nuevoFamiliarTel");

    if (inputMedico && !itiMedico) {
        itiMedico = crearIti(inputMedico);
    }
    if (inputNuevoFam && !itiNuevoFamiliar) {
        itiNuevoFamiliar = crearIti(inputNuevoFam);
    }
}

// ==========================================
// 1. GESTIÓN DEL MÉDICO DE CABECERA
// ==========================================
async function cargarContactoMedico(uid) {
    try {
        const docRef = db.collection("usuarios").doc(uid).collection("contactos").doc("medico");
        const doc = await docRef.get();

        if (doc.exists) {
            const data = doc.data();
            if (data.nombre) document.getElementById("contactoMedicoNombre").value = data.nombre;
            if (data.email) document.getElementById("contactoMedicoEmail").value = data.email;
            if (data.tel && itiMedico) {
                itiMedico.setNumber(data.tel);
            }
        }
    } catch (error) {
        console.error("Error al cargar contacto del médico:", error);
    }
}

async function guardarContactoMedico() {
    const user = auth.currentUser;
    if (!user) return;

    const nombre = document.getElementById("contactoMedicoNombre").value.trim();
    const email = document.getElementById("contactoMedicoEmail").value.trim();
    const tel = itiMedico ? itiMedico.getNumber() : "";

    if (!nombre && !tel && !email) {
        alert("Por favor ingresa al menos un dato del médico.");
        return;
    }

    try {
        await db.collection("usuarios").doc(user.uid).collection("contactos").doc("medico").set({
            nombre: nombre,
            tel: tel,
            email: email,
            ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        alert("🩺 Contacto del Médico guardado correctamente.");
    } catch (error) {
        alert("Error al guardar: " + error.message);
    }
}

// ==========================================
// 2. GESTIÓN DE FAMILIARES A CARGO (MULTIPLE)
// ==========================================
function mostrarFormNuevoFamiliar() {
    document.getElementById("formNuevoFamiliar").style.display = "block";
    document.getElementById("nuevoFamiliarNombre").value = "";
    document.getElementById("nuevoFamiliarEmail").value = "";
    if (itiNuevoFamiliar) itiNuevoFamiliar.setNumber("");
}

function ocultarFormNuevoFamiliar() {
    document.getElementById("formNuevoFamiliar").style.display = "none";
}

async function guardarNuevoFamiliar() {
    const user = auth.currentUser;
    if (!user) return;

    const nombre = document.getElementById("nuevoFamiliarNombre").value.trim();
    const email = document.getElementById("nuevoFamiliarEmail").value.trim();
    const tel = itiNuevoFamiliar ? itiNuevoFamiliar.getNumber() : "";

    if (!nombre) {
        alert("Por favor ingresa al menos el nombre/vínculo del familiar.");
        return;
    }

    try {
        await db.collection("usuarios").doc(user.uid).collection("familiares").add({
            nombre: nombre,
            tel: tel,
            email: email,
            fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
        });

        ocultarFormNuevoFamiliar();
    } catch (error) {
        alert("Error al guardar familiar: " + error.message);
    }
}

function escucharFamiliares(uid) {
    if (unsubFamiliares) unsubFamiliares();

    const familiaresRef = db.collection("usuarios").doc(uid).collection("familiares").orderBy("fechaRegistro", "asc");

    unsubFamiliares = familiaresRef.onSnapshot((snapshot) => {
        const contenedor = document.getElementById("listaFamiliares");
        if (!contenedor) return;

        contenedor.innerHTML = "";
        itiEdicionMap = {};

        if (snapshot.empty) {
            contenedor.innerHTML = `<p style="color: #757575; font-size: 14px; text-align: center; margin: 10px 0;">No tienes familiares registrados aún.</p>`;
            return;
        }

        snapshot.forEach((doc) => {
            const fam = { id: doc.id, ...doc.data() };
            contenedor.innerHTML += `
                <div id="cardFamiliar_${fam.id}" style="background-color: #ffffff; border: 1px solid #bbdefb; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
                    <div id="viewFamiliar_${fam.id}">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <strong style="color: #1565c0; font-size: 16px;">👤 ${fam.nombre}</strong>
                            <div>
                                <button onclick="activarEdicionFamiliar('${fam.id}', '${fam.nombre}', '${fam.email || ''}', '${fam.tel || ''}')" style="background:none; border:none; cursor:pointer;" title="Editar">✏️</button>
                                <button onclick="borrarFamiliar('${fam.id}')" style="background:none; border:none; cursor:pointer;" title="Eliminar">🗑️</button>
                            </div>
                        </div>
                        <p style="margin: 5px 0 0 0; font-size: 14px; color: #333;">📞 Teléfono: ${fam.tel || 'No registrado'}</p>
                        <p style="margin: 3px 0 0 0; font-size: 14px; color: #333;">✉️ Mail: ${fam.email || 'No registrado'}</p>
                    </div>

                    <div id="editFamiliar_${fam.id}" style="display: none;">
                        <label style="font-size: 12px; font-weight: bold; display: block; margin-bottom: 2px;">Nombre/Vínculo:</label>
                        <input type="text" id="editFamNombre_${fam.id}" value="${fam.nombre}" style="width: 100%; margin-bottom: 8px; padding: 6px; box-sizing: border-box;">

                        <label style="font-size: 12px; font-weight: bold; display: block; margin-bottom: 2px;">Teléfono:</label>
                        <div style="margin-bottom: 8px;">
                            <input type="tel" id="editFamTel_${fam.id}" style="width: 100%;">
                        </div>

                        <label style="font-size: 12px; font-weight: bold; display: block; margin-bottom: 2px;">Email:</label>
                        <input type="email" id="editFamEmail_${fam.id}" value="${fam.email || ''}" style="width: 100%; margin-bottom: 8px; padding: 6px; box-sizing: border-box;">

                        <div style="display: flex; gap: 8px; margin-top: 8px;">
                            <button onclick="guardarEdicionFamiliar('${fam.id}')" style="background-color: #1976d2; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Guardar</button>
                            <button onclick="cancelarEdicionFamiliar('${fam.id}')" style="background-color: #757575; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Cancelar</button>
                        </div>
                    </div>
                </div>
            `;
        });
    });
}

function activarEdicionFamiliar(id, nombre, email, tel) {
    document.getElementById(`viewFamiliar_${id}`).style.display = "none";
    document.getElementById(`editFamiliar_${id}`).style.display = "block";

    const inputTel = document.getElementById(`editFamTel_${id}`);
    if (inputTel && !itiEdicionMap[id]) {
        itiEdicionMap[id] = crearIti(inputTel);
    }
    if (itiEdicionMap[id]) {
        itiEdicionMap[id].setNumber(tel);
    }
}

function cancelarEdicionFamiliar(id) {
    document.getElementById(`viewFamiliar_${id}`).style.display = "block";
    document.getElementById(`editFamiliar_${id}`).style.display = "none";
}

async function guardarEdicionFamiliar(id) {
    const user = auth.currentUser;
    if (!user) return;

    const nombre = document.getElementById(`editFamNombre_${id}`).value.trim();
    const email = document.getElementById(`editFamEmail_${id}`).value.trim();
    const iti = itiEdicionMap[id];
    const tel = iti ? iti.getNumber() : "";

    if (!nombre) {
        alert("El nombre es obligatorio.");
        return;
    }

    try {
        await db.collection("usuarios").doc(user.uid).collection("familiares").doc(id).update({
            nombre: nombre,
            tel: tel,
            email: email
        });
    } catch (error) {
        alert("Error al actualizar familiar: " + error.message);
    }
}

async function borrarFamiliar(id) {
    if (!confirm("¿Deseas eliminar este familiar a cargo?")) return;

    const user = auth.currentUser;
    if (!user) return;

    try {
        await db.collection("usuarios").doc(user.uid).collection("familiares").doc(id).delete();
    } catch (error) {
        alert("Error al eliminar familiar: " + error.message);
    }
}