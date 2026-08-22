// ==========================================
// MÓDULO DE AUTENTICACIÓN Y GESTIÓN DE VISTAS
// ==========================================

// Control de vistas (Cambiar entre Login, Registro y Recuperar)
function mostrarVista(idVista) {
    document.getElementById("vistaLogin").style.display = "none";
    document.getElementById("vistaRegistro").style.display = "none";
    document.getElementById("vistaRecuperar").style.display = "none";
    document.getElementById(idVista).style.display = "block";
}

// Vigilante del estado de la sesión de Firebase
auth.onAuthStateChanged((user) => {
    if (user) {
        usuarioActual = user;
        // Ocultar vistas de autenticación y mostrar la app + cabecera
        document.getElementById("vistaLogin").style.display = "none";
        document.getElementById("vistaRegistro").style.display = "none";
        document.getElementById("vistaRecuperar").style.display = "none";
        document.getElementById("cabeceraApp").style.display = "flex";
        document.getElementById("pantallaApp").style.display = "block";
    } else {
        usuarioActual = null;
        // Ocultar la app + cabecera y mostrar el login por defecto
        document.getElementById("cabeceraApp").style.display = "none";
        document.getElementById("pantallaApp").style.display = "none";
        mostrarVista("vistaLogin");
    }
});

// Validación visual en vivo para la contraseña
function validarContrasenaEnVivo() {
    const password = document.getElementById("regPassword").value;
    const textoAyuda = document.getElementById("regPasswordHelp");
    
    if (password.length >= 6) {
        textoAyuda.textContent = "✓ Contraseña válida (mínimo 6 caracteres).";
        textoAyuda.className = "texto-ayuda indicador-valido";
    } else {
        textoAyuda.textContent = "Requisito: Mínimo 6 caracteres (" + password.length + "/6).";
        textoAyuda.className = "texto-ayuda indicador-invalido";
    }
}

// Registro de usuario nuevo
async function registrarUsuario() {
    const nombreUsuario = document.getElementById("regNombreUsuario").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const confirmEmail = document.getElementById("regConfirmEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const confirmPassword = document.getElementById("regConfirmPassword").value;

    if (!nombreUsuario || !email || !confirmEmail || !password || !confirmPassword) {
        alert("Por favor, completa todos los campos.");
        return;
    }
    if (email !== confirmEmail) {
        alert("Los correos electrónicos no coinciden.");
        return;
    }
    if (password !== confirmPassword) {
        alert("Las contraseñas no coinciden.");
        return;
    }
    if (password.length < 6) {
        alert("La contraseña debe tener al menos 6 caracteres.");
        return;
    }

    try {
        const consultaUsuario = await db.collection("usuarios").where("nombreUsuario", "==", nombreUsuario).get();
        if (!consultaUsuario.empty) {
            alert("El nombre de usuario ya está registrado. Por favor, elige otro.");
            return;
        }

        const credencial = await auth.createUserWithEmailAndPassword(email, password);
        
        await db.collection("usuarios").doc(credencial.user.uid).set({
            nombreUsuario: nombreUsuario,
            email: email
        });

        alert("¡Cuenta creada exitosamente!");
    } catch (error) {
        alert("Error al registrarse: " + error.message);
    }
}

// Iniciar sesión con Correo o Nombre de Usuario
async function iniciarSesion() {
    const entrada = document.getElementById("loginUsuarioEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!entrada || !password) {
        alert("Por favor, completa ambos campos.");
        return;
    }

    let emailAUsar = entrada;

    if (!entrada.includes("@")) {
        try {
            const consulta = await db.collection("usuarios").where("nombreUsuario", "==", entrada).get();
            if (consulta.empty) {
                alert("No existe una cuenta con ese nombre de usuario.");
                return;
            }
            emailAUsar = consulta.docs[0].data().email;
        } catch (error) {
            alert("Error al validar usuario: " + error.message);
            return;
        }
    }

    auth.signInWithEmailAndPassword(emailAUsar, password)
        .catch((error) => alert("Error al ingresar: Verifique las credenciales."));
}

// Recuperar contraseña
async function recuperarContrasena() {
    const entrada = document.getElementById("recuperarEmailOUsuario").value.trim();

    if (!entrada) {
        alert("Ingresa tu correo o nombre de usuario.");
        return;
    }

    let emailAUsar = entrada;

    if (!entrada.includes("@")) {
        try {
            const consulta = await db.collection("usuarios").where("nombreUsuario", "==", entrada).get();
            if (consulta.empty) {
                alert("No se encontró ningún usuario registrado con ese nombre.");
                return;
            }
            emailAUsar = consulta.docs[0].data().email;
        } catch (error) {
            alert("Error al buscar usuario: " + error.message);
            return;
        }
    }

    auth.languageCode = 'es';

    const configuracionCorreo = {
        url: "https://appadultosmayores.vercel.app/",
        handleCodeInApp: false
    };

    auth.sendPasswordResetEmail(emailAUsar, configuracionCorreo)
        .then(() => {
            alert("Se ha enviado un correo electrónico a " + emailAUsar + " con las instrucciones. Revisa también tu carpeta de SPAM.");
            mostrarVista("vistaLogin");
        })
        .catch((error) => alert("Error: " + error.message));
}

// Cerrar sesión
function cerrarSesion() {
    cerrarMenu();
    auth.signOut();
}