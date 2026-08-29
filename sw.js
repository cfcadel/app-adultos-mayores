// Service Worker para PWA y Notificaciones en segundo plano

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalado correctamente');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activado');
    return self.clients.claim();
});

// Escuchar eventos Push enviadas desde Firebase
self.addEventListener('push', (event) => {
    let data = { title: '💊 Recordatorio de Medicina', body: 'Es hora de tomar tu medicamento.' };
    
    if (event.data) {
        data = event.data.json();
    }

    const opciones = {
        body: data.body,
        icon: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: 'medicina-notification',
        renotify: true
    };

    event.waitUntil(
        self.registration.showNotification(data.title, opciones)
    );
});