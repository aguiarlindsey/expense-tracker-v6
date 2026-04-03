// sw-push.js — loaded via importScripts() inside the generated service worker
// Handles Web Push events for recurring expense reminders

self.addEventListener('push', function (event) {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Expense Reminder', body: event.data.text(), url: '/' }
  }

  const title = payload.title || 'Expense Reminder'
  const options = {
    body:      payload.body || 'You have a recurring expense due soon.',
    icon:      '/pwa-192.svg',
    badge:     '/pwa-192.svg',
    tag:       'recurring-reminder',  // collapses into one notification per day
    renotify:  true,
    data:      { url: payload.url || '/' },
    actions: [
      { action: 'open',    title: 'View Recurring' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  if (event.action === 'dismiss') return

  const url = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
