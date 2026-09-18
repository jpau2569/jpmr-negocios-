/* ============================================================================
   CASTRESANA — Service Worker de Firebase Cloud Messaging
   ----------------------------------------------------------------------------
   Recibe push en segundo plano. La configuración llega por querystring desde
   messaging.ts (este archivo estático no puede leer variables de entorno),
   así que aquí NO hay ninguna clave hardcodeada.
   Convive con /sw.js (offline): FCM registra este SW con su propio scope
   interno de la librería (/firebase-cloud-messaging-push-scope).
   ============================================================================ */

/* global importScripts, firebase, clients */

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;

const config = {
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
};

if (config.apiKey && config.projectId && config.appId) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  // Push recibido con la app cerrada o en segundo plano.
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? 'Castresana';
    const body = payload.notification?.body ?? 'Tienes actividad nueva.';
    const link = payload.fcmOptions?.link ?? payload.data?.link ?? '/inbox';

    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      data: { link },
      tag: payload.data?.tag ?? 'castresana',
    });
  });
}

// Al pulsar la notificación: enfoca una pestaña existente o abre una nueva.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link ?? '/inbox';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(link);
          return;
        }
      }
      return clients.openWindow(link);
    }),
  );
});
