importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
        apiKey: "AIzaSyCDCilOCoyFf4E3hqKLudI5j8anSi2jV9k",
        authDomain: "appadultosmayores-71aac.firebaseapp.com",
        projectId: "appadultosmayores-71aac",
        storageBucket: "appadultosmayores-71aac.firebasestorage.app",
        messagingSenderId: "636027771154",
        appId: "1:636027771154:web:513f37aff52e78f69d3bcb"
});

const messaging = firebase.messaging();

// Captura automática de mensajes en segundo plano mediante el SDK
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Mensaje FCM recibido:', payload);
    
    const titulo = payload.notification?.title || payload.data?.title || '💊 Recordatorio de Medicina';
    const cuerpo = payload.notification?.body || payload.data?.body || 'Es hora de tomar tu medicamento.';

    const opciones = {
        body: cuerpo,
        icon: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: 'medicina-notification',
        renotify: true
    };

    return self.registration.showNotification(titulo, opciones);
});

// Respaldo nativo para interceptar la trama Push bruta si el SDK no la procesa
self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const titulo = data.notification?.title || data.data?.title || data.title;
        const cuerpo = data.notification?.body || data.data?.body || data.body;

        if (titulo && cuerpo) {
            const opciones = {
                body: cuerpo,
                icon: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png',
                badge: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png',
                vibrate: [200, 100, 200, 100, 200]
            };
            event.waitUntil(self.registration.showNotification(titulo, opciones));
        }
    } catch (e) {
        console.log('[SW] Push procesado por FCM SDK');
    }
});