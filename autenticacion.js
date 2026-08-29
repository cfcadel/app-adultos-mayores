// ==========================================
// AUTENTICACIÓN Y PERFIL DE USUARIO
// ==========================================

// REGISTRAR USUARIO CON TELÉFONO OBLIGATORIO
async function registrarUsuario() {
    const usuario = document.getElementById("regNombreUsuario").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const confirmEmail = document.getElementById("regConfirmEmail").value.trim();
    const pass = document.getElementById("regPassword").value;
    const confirmPass = document.getElementById("regConfirmPassword").value;

    // Obtener número completo con código de país (Ej: +5491122334455)
    const telefonoCompleto = itiRegistro.getNumber();
    const esTelefonoValido = itiRegistro.isValidNumber();

    if (!usuario || !email || !confirmEmail || !pass || !confirmPass) {
        alert("Por favor completa todos los campos.");
        return;
    }

    if (!telefonoCompleto || !esTelefonoValido) {
        alert("Por favor ingresa un número de teléfono válido con su caracteristica.");
        return;
    }

    if (email !== confirmEmail) {
        alert("Los correos electrónicos no coinciden.");
        return;
    }

    if (pass !== confirmPass) {
        alert("Las contraseñas no coinciden.");
        return;
    }

    if (pass.length < 6) {
        alert("La contraseña debe tener al menos 6 caracteres.");
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
        const uid = userCredential.user.uid;

        // Guardar datos adicionales en Firestore
        await db.collection("usuarios").doc(uid).set({
            nombreUsuario: usuario,
            email: email,
            telefono: telefonoCompleto,
            fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("¡Cuenta creada con éxito!");
        mostrarPantallaPrincipal();

    } catch (error) {
        alert("Error al registrar cuenta: " + error.message);
    }
}

// CARGAR DATOS EN LA SECCIÓN "MI USUARIO"
async function cargarDatosPerfil() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const doc = await db.collection("usuarios").doc(user.uid).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById("perfilNombreUsuario").value = data.nombreUsuario || "";
            document.getElementById("perfilEmail").value = data.email || user.email;
            
            if (data.telefono) {
                itiPerfil.setNumber(data.telefono);
            }
        }
    } catch (error) {
        console.error("Error al cargar perfil:", error);
    }
}

// GUARDAR CAMBIOS DE TELÉFONO DESDE "MI USUARIO"
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
        await db.collection("usuarios").doc(user.uid).update({
            telefono: nuevoTelefono
        });
        alert("¡Teléfono actualizado con éxito!");
    } catch (error) {
        alert("Error al actualizar perfil: " + error.message);
    }
}

// INICIAR SESIÓN
async function iniciarSesion() {
    const userInput = document.getElementById("loginUsuarioEmail").value.trim();
    const pass = document.getElementById("loginPassword").value;

    if (!userInput || !pass) {
        alert("Ingresa tu usuario/correo y contraseña.");
        return;
    }

    try {
        let emailAAutenticar = userInput;

        // Si no es un email, buscar por nombre de usuario en Firestore
        if (!userInput.includes("@")) {
            const snapshot = await db.collection("usuarios")
                .where("nombreUsuario", "==", userInput)
                .get();

            if (snapshot.empty) {
                alert("El nombre de usuario no existe.");
                return;
            }

            emailAAutenticar = snapshot.docs[0].data().email;
        }

        await auth.signInWithEmailAndPassword(emailAAutenticar, pass);
        mostrarPantallaPrincipal();

    } catch (error) {
        alert("Error al iniciar sesión: " + error.message);
    }
}

// CERRAR SESIÓN
function cerrarSesion() {
    auth.signOut().then(() => {
        document.getElementById("pantallaApp").style.display = "none";
        document.getElementById("cabeceraApp").style.display = "none";
        mostrarVista("vistaLogin");
    });
}

// CAMBIAR VISTAS (LOGIN / REGISTRO / RECUPERAR)
function mostrarVista(idVista) {
    document.getElementById("vistaLogin").style.display = "none";
    document.getElementById("vistaRegistro").style.display = "none";
    document.getElementById("vistaRecuperar").style.display = "none";
    document.getElementById(idVista).style.display = "block";
}

function mostrarPantallaPrincipal() {
    document.getElementById("vistaLogin").style.display = "none";
    document.getElementById("vistaRegistro").style.display = "none";
    document.getElementById("vistaRecuperar").style.display = "none";
    document.getElementById("cabeceraApp").style.display = "flex";
    document.getElementById("pantallaApp").style.display = "block";
    cambiarSeccion("seccionInicio");
}

function validarContrasenaEnVivo() {
    const pass = document.getElementById("regPassword").value;
    const help = document.getElementById("regPasswordHelp");
    if (pass.length < 6) {
        help.style.color = "red";
    } else {
        help.style.color = "green";
    }
}

function recuperarContrasena() {
    const input = document.getElementById("recuperarEmailOUsuario").value.trim();
    if (!input) {
        alert("Por favor ingresa tu correo o usuario.");
        return;
    }
    alert("Si la cuenta existe, se enviará un correo de restablecimiento.");
}

// EVALUAR ESTADO DE SESIÓN AL CARGAR
auth.onAuthStateChanged((user) => {
    if (user) {
        mostrarPantallaPrincipal();
    } else {
        mostrarVista("vistaLogin");
    }
});