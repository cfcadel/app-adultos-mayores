// ==========================================
// MÓDULO DE CONTACTOS DE EMERGENCIA
// ==========================================

auth.onAuthStateChanged((user) => {
    if (user) {
        cargarContactos(user.uid);
    }
});

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

            // Cargar datos Familiar
            if (data.familiarNombre) document.getElementById("contactoFamiliarNombre").value = data.familiarNombre;
            if (data.familiarTel) document.getElementById("contactoFamiliarTel").value = data.familiarTel;
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
    const medicoTel = document.getElementById("contactoMedicoTel").value.trim();

    if (!medicoNombre && !medicoTel) {
        alert("Por favor ingresa al menos un dato del médico.");
        return;
    }

    try {
        await db.collection("usuarios").doc(user.uid).collection("contactos").doc("emergencia").set({
            medicoNombre: medicoNombre,
            medicoTel: medicoTel,
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
    const familiarTel = document.getElementById("contactoFamiliarTel").value.trim();

    if (!familiarNombre && !familiarTel) {
        alert("Por favor ingresa al menos un dato del familiar.");
        return;
    }

    try {
        await db.collection("usuarios").doc(user.uid).collection("contactos").doc("emergencia").set({
            familiarNombre: familiarNombre,
            familiarTel: familiarTel,
            ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        alert("👨‍👩‍👧 Contacto del Familiar guardado correctamente.");
    } catch (error) {
        alert("Error al guardar: " + error.message);
    }
}