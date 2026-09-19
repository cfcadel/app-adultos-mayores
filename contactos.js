// ==========================================
// MÓDULO DE CONTACTOS (MÉDICO Y FAMILIARES)
// ==========================================

let itiMedico = null;
let itiNuevoFamiliar = null;
let itiEdicionMap = {};
let unsubFamiliares = null;

let datosMedicoGuardados = null;

auth.onAuthStateChanged((user) => {
    if (user) {
        inicializarWidgetsTelefono();
        cargarContactoMedico(user.uid);
        escucharFamiliares(user.uid);
    }
});

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

        if (doc.exists && doc.data().nombre) {
            datosMedicoGuardados = doc.data();
            mostrarVistaBloqueadaMedico(datosMedicoGuardados);
        } else {
            mostrarFormularioMedico();
        }
    } catch (error) {
        console.error("Error al cargar médico:", error);
    }
}

function mostrarVistaBloqueadaMedico(data) {
    document.getElementById("txtMedicoNombre").innerText = data.nombre || "Sin especificar";
    
    const linkTel = document.getElementById("linkMedicoTel");
    if (data.tel) {
        linkTel.href = `tel:${data.tel}`;
        linkTel.innerText = data.tel;
    } else {
        linkTel.href = "#";
        linkTel.innerText = "No registrado";
    }

    const linkEmail = document.getElementById("linkMedicoEmail");
    if (data.email) {
        linkEmail.href = `mailto:${data.email}`;
        linkEmail.innerText = data.email;
    } else {
        linkEmail.href = "#";
        linkEmail.innerText = "No registrado";
    }

    document.getElementById("vistaMedico").style.display = "block";
    document.getElementById("btnEditarMedico").style.display = "inline-block";
    document.getElementById("formMedico").style.display = "none";
}

function mostrarFormularioMedico() {
    document.getElementById("vistaMedico").style.display = "none";
    document.getElementById("btnEditarMedico").style.display = "none";
    document.getElementById("formMedico").style.display = "block";

    if (datosMedicoGuardados) {
        document.getElementById("btnCancelarMedico").style.display = "inline-block";
        document.getElementById("contactoMedicoNombre").value = datosMedicoGuardados.nombre || "";
        document.getElementById("contactoMedicoEmail").value = datosMedicoGuardados.email || "";
        if (itiMedico && datosMedicoGuardados.tel) itiMedico.setNumber(datosMedicoGuardados.tel);
    } else {
        document.getElementById("btnCancelarMedico").style.display = "none";
    }
}

function activarEdicionMedico() {
    mostrarFormularioMedico();
}

function cancelarEdicionMedico() {
    if (datosMedicoGuardados) {
        mostrarVistaBloqueadaMedico(datosMedicoGuardados);
    }
}

async function guardarContactoMedico() {
    const user = auth.currentUser;
    if (!user) return;

    const nombre = document.getElementById("contactoMedicoNombre").value.trim();
    const email = document.getElementById("contactoMedicoEmail").value.trim();
    const tel = itiMedico ? itiMedico.getNumber() : "";

    if (!nombre) {
        alert("Por favor ingresa al menos el nombre del médico.");
        return;
    }

    const datosActualizados = {
        nombre: nombre,
        tel: tel,
        email: email,
        ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection("usuarios").doc(user.uid).collection("contactos").doc("medico").set(datosActualizados, { merge: true });
        datosMedicoGuardados = datosActualizados;
        mostrarVistaBloqueadaMedico(datosMedicoGuardados);
    } catch (error) {
        alert("Error al guardar: " + error.message);
    }
}

// ==========================================
// 2. GESTIÓN DE FAMILIARES A CARGO
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
            contenedor.innerHTML = `<p style="color: #757575; font-size: 14px; text-align: left; margin: 10px 0;">No tienes familiares registrados aún.</p>`;
            return;
        }

        snapshot.forEach((doc) => {
            const fam = { id: doc.id, ...doc.data() };
            
            const linkTelHTML = fam.tel 
                ? `<a href="tel:${fam.tel}" class="link-contacto">${fam.tel}</a>`
                : `<span style="color:#757575;">No registrado</span>`;

            const linkEmailHTML = fam.email 
                ? `<a href="mailto:${fam.email}" class="link-contacto" style="font-weight: normal;">${fam.email}</a>`
                : `<span style="color:#757575;">No registrado</span>`;

            contenedor.innerHTML += `
                <div id="cardFamiliar_${fam.id}" style="background-color: #ffffff; border: 1px solid #bbdefb; border-radius: 8px; padding: 15px; margin-bottom: 12px; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div id="viewFamiliar_${fam.id}">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px; margin-bottom: 10px;">
                            <strong style="color: #1565c0; font-size: 18px;">👤 ${fam.nombre}</strong>
                            <div>
                                <button onclick="activarEdicionFamiliar('${fam.id}', '${fam.nombre}', '${fam.email || ''}', '${fam.tel || ''}')" style="background:none; border:none; cursor:pointer; font-size: 16px; margin-right: 5px;" title="Editar">✏️</button>
                                <button onclick="borrarFamiliar('${fam.id}')" style="background:none; border:none; cursor:pointer; font-size: 16px;" title="Eliminar">🗑️</button>
                            </div>
                        </div>
                        <div style="font-size: 15px; line-height: 1.6;">
                            <p style="margin: 4px 0;"><strong>📞 Teléfono:</strong> ${linkTelHTML}</p>
                            <p style="margin: 4px 0;"><strong>✉️ Mail:</strong> ${linkEmailHTML}</p>
                        </div>
                    </div>

                    <div id="editFamiliar_${fam.id}" style="display: none; text-align: left;">
                        <label style="font-size: 12px; font-weight: bold; display: block; margin-bottom: 2px;">Nombre/Vínculo:</label>
                        <input type="text" id="editFamNombre_${fam.id}" value="${fam.nombre}" style="width: 100%; margin-bottom: 8px; padding: 6px; box-sizing: border-box;">

                        <label style="font-size: 12px; font-weight: bold; display: block; margin-bottom: 2px;">Teléfono:</label>
                        <div style="margin-bottom: 8px; width: 100%;">
                            <input type="tel" id="editFamTel_${fam.id}" style="width: 100%;">
                        </div>

                        <label style="font-size: 12px; font-weight: bold; display: block; margin-bottom: 2px;">Email:</label>
                        <input type="email" id="editFamEmail_${fam.id}" value="${fam.email || ''}" style="width: 100%; margin-bottom: 8px; padding: 6px; box-sizing: border-box;">

                        <div style="display: flex; gap: 8px; margin-top: 10px;">
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