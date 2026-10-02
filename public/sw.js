// VisualSky Service Worker for 24/7 Background, Cross-Tab & Closed-Browser Web Push Notifications
const recentNotificationTags = new Map();

function shouldSuppressDuplicateTag(tag) {
  if (!tag) return false;
  const now = Date.now();
  for (const [k, ts] of recentNotificationTags.entries()) {
    if (now - ts > 45000) {
      recentNotificationTags.delete(k);
    }
  }
  if (recentNotificationTags.has(tag)) {
    return true;
  }
  recentNotificationTags.set(tag, now);
  return false;
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.resolve()
      .then(() => {
        if (self.caches && typeof self.caches.keys === 'function') {
          return self.caches.keys().then((keys) => Promise.all(keys.map((k) => self.caches.delete(k))));
        }
      })
      .catch(() => {})
      .then(() => self.clients.claim())
  );
});

// 1. Real RFC 8030 Web Push Event — Fires even when the browser or app tab is COMPLETELY CLOSED (as long as Wi-Fi or Mobile Data is ON!)
self.addEventListener('push', (event) => {
  let payload = {
    title: '📩 VisualSky Notification',
    body: 'You have a new email update in your Smart Inbox.',
    tag: 'vs-push-' + Date.now(),
    linkTab: 'inbox',
    data: { linkTab: 'inbox' }
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        payload = Object.assign(payload, parsed);
      }
    } catch (e) {
      try {
        payload.body = event.data.text() || payload.body;
      } catch (_) {}
    }
  }

  const tag = payload.tag || ('vs-push-' + Date.now());
  if (shouldSuppressDuplicateTag(tag)) {
    return;
  }

  const options = {
    body: payload.body || payload.message || '',
    icon: payload.icon || '/favicon.svg',
    badge: payload.badge || '/favicon.svg',
    tag: tag,
    renotify: true,
    requireInteraction: payload.requireInteraction !== undefined ? Boolean(payload.requireInteraction) : true,
    vibrate: [250, 100, 250, 100, 300],
    timestamp: payload.timestamp || Date.now(),
    data: Object.assign(
      {
        linkTab: payload.linkTab || 'inbox',
        leadEmail: payload.leadEmail || '',
        threadId: payload.threadId || '',
        url: payload.url || '/?tab=inbox'
      },
      payload.data || {}
    ),
    actions: [
      { action: 'open', title: '📬 Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || '📩 VisualSky Alert', options).then(() => {
      // Also notify any open background/foreground client tabs so their in-app bell & audio chime update immediately
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          try {
            client.postMessage({
              type: 'VS_PUSH_RECEIVED',
              payload: payload
            });
          } catch (_) {}
        }
      });
    })
  );
});

// 2. Message Event — Triggered by background/active tabs when polling detects new mail or open events
self.addEventListener('message', (event) => {
  const data = event.data;
  if (data && data.type === 'SHOW_NOTIFICATION' && data.title) {
    const rawOpts = data.options || {};
    const tag = rawOpts.tag || ('vs-msg-' + Date.now());
    if (shouldSuppressDuplicateTag(tag)) {
      return;
    }
    const options = Object.assign(
      {
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        vibrate: [250, 100, 250, 100, 300],
        renotify: true,
        requireInteraction: true
      },
      rawOpts,
      { tag }
    );
    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});

// 3. Notification Click — Focuses existing tab or opens a new window straight into Smart Inbox / Sent Tracker
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') {
    return;
  }

  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || (notifData.linkTab === 'sent' ? '/?tab=sent' : '/?tab=inbox');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus().then(() => {
            client.postMessage({
              type: 'VS_NOTIFICATION_CLICK',
              data: notifData
            });
          });
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
