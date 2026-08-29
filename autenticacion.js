// GUARDAR CAMBIOS DE TELÉFONO DESDE "MI USUARIO" (CREA O ACTUALIZA)
async function guardarDatosPerfil() {
    const user = auth.currentUser;
    if (!user) return;

    const nuevoTelefono = itiPerfil.getNumber();
    const esValido = itiPerfil.isValidNumber();

    if (!nuevoTelefono || !esValido) {
        alert("Por favor ingresa un número de teléfono válido.");
        return;
    }

    try {
        // .set con { merge: true } crea el documento si no existe o actualiza si ya existe
        await db.collection("usuarios").doc(user.uid).set({
            telefono: nuevoTelefono,
            email: user.email, // Guarda el email por si es un usuario antiguo
            ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        alert("¡Teléfono guardado con éxito!");
    } catch (error) {
        alert("Error al actualizar perfil: " + error.message);
    }
}