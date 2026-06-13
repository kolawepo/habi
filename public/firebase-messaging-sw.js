importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDRe5VC2gPrpNn07c6x8BH3VLlXhaO-ICk",
  authDomain: "habi-3e0a6.firebaseapp.com",
  projectId: "habi-3e0a6",
  storageBucket: "habi-3e0a6.firebasestorage.app",
  messagingSenderId: "1056100831110",
  appId: "1:1056100831110:web:a9661ea3dcbd6c3a92a607",
});

const messaging = firebase.messaging();

// Background messages (app closed / minimised)
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Habi';
  const body  = payload.notification?.body  || '';
  const link  = payload.data?.link || '/';

  self.registration.showNotification(title, {
    body,
    icon: '/bibi.png',
    badge: '/favicon.svg',
    data: { link },
  });
});

// Notification click → open / focus the app on the right tab
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  const target = 'https://habi-sepia.vercel.app' + link;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith('https://habi-sepia.vercel.app') && 'focus' in client) {
            client.postMessage({ type: 'NOTIFICATION_TAB', link });
            return client.focus();
          }
        }
        return clients.openWindow(target);
      })
  );
});
