// ==========================================
// MÓDULO DE CONTACTOS (MÉDICO Y FAMILIAR)
// ==========================================

auth.onAuthStateChanged((user) => {
    if (user) {
        cargarContactos(user.uid);
    }
});

// Función helper para limpiar números de teléfono (útil para WhatsApp / Llamadas)
function estandarizarTelefono(numero) {
    if (!numero) return "";
    // Elimina espacios, guiones y paréntesis para dejarlo estandarizado
    return numero.replace(/[\s\-\(\)]/g, "");
}

// Cargar contactos guardados desde Firestore
async function cargarContactos(uid) {
    try {
        const docRef = db.collection("usuarios").doc(uid).collection("contactos").doc("emergencia");
        const doc = await docRef.get();

        if (doc.exists) {
            const data = doc.data();
            
            // Cargar datos Médico
            if (data.medicoNombre) document.getElementById("contactoMedicoNombre").value = data.medicoNombre;
            if (data.medicoTel) document.getElementById("contactoMedicoTel").value = data.medicoTel;
            if (data.medicoEmail) document.getElementById("contactoMedicoEmail").value = data.medicoEmail;

            // Cargar datos Familiar
            if (data.familiarNombre) document.getElementById("contactoFamiliarNombre").value = data.familiarNombre;
            if (data.familiarTel) document.getElementById("contactoFamiliarTel").value = data.familiarTel;
            if (data.familiarEmail) document.getElementById("contactoFamiliarEmail").value = data.familiarEmail;
        }
    } catch (error) {
        console.error("Error al cargar contactos:", error);
    }
}

// Guardar datos del Médico de Cabecera
async function guardarContactoMedico() {
    const user = auth.currentUser;
    if (!user) return;

    const medicoNombre = document.getElementById("contactoMedicoNombre").value.trim();
    const medicoTelBruto = document.getElementById("contactoMedicoTel").value.trim();
    const medicoEmail = document.getElementById("contactoMedicoEmail").value.trim();

    const medicoTel = estandarizarTelefono(medicoTelBruto);

    if (!medicoNombre && !medicoTel && !medicoEmail) {
        alert("Por favor ingresa al menos un dato del médico.");
        return;
    }

    try {
        await db.collection("usuarios").doc(user.uid).collection("contactos").doc("emergencia").set({
            medicoNombre: medicoNombre,
            medicoTel: medicoTel,
            medicoEmail: medicoEmail,
            ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        alert("🩺 Contacto del Médico guardado correctamente.");
    } catch (error) {
        alert("Error al guardar: " + error.message);
    }
}

// Guardar datos del Familiar a Cargo
async function guardarContactoFamiliar() {
    const user = auth.currentUser;
    if (!user) return;

    const familiarNombre = document.getElementById("contactoFamiliarNombre").value.trim();
    const familiarTelBruto = document.getElementById("contactoFamiliarTel").value.trim();
    const familiarEmail = document.getElementById("contactoFamiliarEmail").value.trim();

    const familiarTel = estandarizarTelefono(familiarTelBruto);

    if (!familiarNombre && !familiarTel && !familiarEmail) {
        alert("Por favor ingresa al menos un dato del familiar.");
        return;
    }

    try {
        await db.collection("usuarios").doc(user.uid).collection("contactos").doc("emergencia").set({
            familiarNombre: familiarNombre,
            familiarTel: familiarTel,
            familiarEmail: familiarEmail,
            ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        alert("👨‍👩‍👧 Contacto del Familiar guardado correctamente.");
    } catch (error) {
        alert("Error al guardar: " + error.message);
    }
}