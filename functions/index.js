const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

// ==========================================
// CONFIGURACIÓN DE CORREO (Para Familiares)
// ==========================================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "unodigital111@gmail.com", // REEMPLAZA CON TU CORREO
    pass: "wdoosydgvxoipetk" // REEMPLAZA CON LA CLAVE DE APLICACIÓN
  }
});

// ==========================================
// FUNCIÓN 1: ALARMA DE MEDICAMENTOS (Cada 1 minuto)
// ==========================================
exports.verificarAlarmaMedicamentos = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "America/Argentina/Buenos_Aires",
  },
  async (event) => {
    const ahora = new Date();
    const horaActual = ahora.toLocaleTimeString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    console.log(`[Ejecución Cron] Hora evaluada en el servidor: ${horaActual}`);

    const usuariosSnap = await db.collection("usuarios").get();

    for (const userDoc of usuariosSnap.docs) {
      const userData = userDoc.data();
      const token = userData.fcmToken;

      if (token) {
        const medsSnap = await db
          .collection("usuarios")
          .doc(userDoc.id)
          .collection("medicamentos")
          .get();

        for (const medDoc of medsSnap.docs) {
          const med = medDoc.data();
          const horarios = med.horariosCalculados;

          if (horarios && horarios.includes(horaActual)) {
            const message = {
              notification: {
                title: "💊 Recordatorio de Medicina",
                body: `Es hora de tomar tu medicamento: ${med.nombre}`,
              },
              token: token,
            };

            try {
              await admin.messaging().send(message);
              console.log(`Notificación enviada a ${userData.email} para ${med.nombre}`);
            } catch (err) {
              console.error("Error enviando mensaje Push:", err);
            }
          }
        }
      }
    }
  }
);

// ==========================================
// FUNCIÓN 2: RECORDATORIO DE TURNOS (Todos los días a las 8:00 AM)
// ==========================================
exports.enviarRecordatoriosTurnos = onSchedule(
  {
    schedule: "0 8 * * *", 
    timeZone: "America/Argentina/Buenos_Aires",
  },
  async (event) => {
    const ahora = new Date();
    
    // Rango de 24 horas para el día de mañana
    const mananaInicio = new Date(ahora);
    mananaInicio.setDate(mananaInicio.getDate() + 1);
    mananaInicio.setHours(0, 0, 0, 0);

    const mananaFin = new Date(ahora);
    mananaFin.setDate(mananaFin.getDate() + 1);
    mananaFin.setHours(23, 59, 59, 999);

    const usuariosSnap = await db.collection("usuarios").get();

    for (const userDoc of usuariosSnap.docs) {
      const uid = userDoc.id;
      const userData = userDoc.data();

      // Buscar turnos programados para mañana que no hayan sido avisados
      const turnosSnap = await db.collection("usuarios").doc(uid).collection("turnos")
        .where("fechaHora", ">=", mananaInicio)
        .where("fechaHora", "<=", mananaFin)
        .where("recordatorio24hEnviado", "==", false)
        .get();

      if (turnosSnap.empty) continue;

      // Obtener lista de correos (Usuario + Familiares)
      let destinatariosEmail = [];
      if (userData.email) destinatariosEmail.push(userData.email);

      const familiaresSnap = await db.collection("usuarios").doc(uid).collection("familiares").get();
      familiaresSnap.forEach(fam => {
        const dataFam = fam.data();
        if (dataFam.email) destinatariosEmail.push(dataFam.email);
      });

      // Procesar cada turno encontrado
      for (const turnoDoc of turnosSnap.docs) {
        const turno = turnoDoc.data();
        
        // 1. ENVIAR NOTIFICACIÓN PUSH AL USUARIO (Si tiene la app abierta/token válido)
        if (userData.fcmToken) {
          const pushMessage = {
            notification: {
              title: "🗓️ Turno Médico Mañana",
              body: `Tienes turno de ${turno.especialidad} a las ${turno.hora} hs.`,
            },
            token: userData.fcmToken,
          };
          try {
            await admin.messaging().send(pushMessage);
            console.log(`Push de turno enviado a ${userData.email}`);
          } catch (err) {
            console.error("Error enviando Push de turno:", err);
          }
        }

        // 2. ENVIAR CORREO A LOS FAMILIARES (Y al usuario)
        if (destinatariosEmail.length > 0) {
          const htmlMensaje = `
            <div style="font-family: sans-serif; padding: 20px;">
              <h2 style="color: #2e7d32;">🗓️ Recordatorio de Turno Médico</h2>
              <p>Hola, les recordamos que el paciente tiene un turno programado para mañana:</p>
              <div style="background-color: #f1f8e9; padding: 15px; border-radius: 8px;">
                <p><strong>🩺 Especialidad/Médico:</strong> ${turno.especialidad}</p>
                <p><strong>📅 Fecha:</strong> ${turno.fecha}</p>
                <p><strong>⏰ Hora:</strong> ${turno.hora} hs</p>
              </div>
              <p>Por favor tomar los recaudos necesarios para la asistencia.</p>
            </div>
          `;

          try {
            await transporter.sendMail({
              from: '"Asistente Médico" <tu_correo@gmail.com>', // REEMPLAZA CON TU CORREO
              to: destinatariosEmail.join(", "),
              subject: `⏰ Alerta de Turno: ${turno.especialidad} - Mañana a las ${turno.hora} hs`,
              html: htmlMensaje
            });
            console.log(`Correo de turno enviado a: ${destinatariosEmail.join(", ")}`);
          } catch (err) {
            console.error("Error enviando correo de turno:", err);
          }
        }

        // 3. MARCAR COMO ENVIADO EN FIRESTORE
        await turnoDoc.ref.update({ recordatorio24hEnviado: true });
      }
    }
  }
);