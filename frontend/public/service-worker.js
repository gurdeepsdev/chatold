// CRM Chat Service Worker v2.0
const CACHE = 'crm-chat-v2';
const STATIC = ['/', '/index.html', '/manifest.json'];

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// ── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (e.request.method === 'GET' && res.status === 200) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/index.html')))
  );
});

// ── Push notification ────────────────────────────────────────
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data?.json() || {}; } catch { data = { title: 'CRM Chat', body: e.data?.text() || 'New message' }; }

  const title = data.title || '💬 CRM Chat';
  const options = {
    body: data.body || 'You have a new message',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    tag: data.group_id ? `group-${data.group_id}` : 'crm-chat',
    renotify: true,
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200, 100, 400],   // phone vibration pattern
    timestamp: Date.now(),
    data: { group_id: data.group_id, url: data.group_id ? `/?group=${data.group_id}` : '/' },
    actions: [
      { action: 'open',    title: '💬 Open Chat' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  e.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        // Update badge count
        if ('setAppBadge' in self.registration) {
          // Not widely available in SW context, rely on client-side navigator.setAppBadge
        }
      })
  );
});

// ── Notification click ───────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;

  const groupId = e.notification.data?.group_id;
  const target = groupId ? `/?group=${groupId}` : '/';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', group_id: groupId });
          return client.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});

// ── Messages from main thread ─────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'SET_BADGE') {
    try {
      if (e.data.count > 0) self.registration.badge?.set(e.data.count);
      else self.registration.badge?.clear();
    } catch {}
  }
});

// ── Background sync ──────────────────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'sync-messages') console.log('[SW] Background sync triggered');
});
