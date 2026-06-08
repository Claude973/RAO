export function createNotifier(NotificationImpl, onFallback) {
  function notify(message) {
    if (NotificationImpl && NotificationImpl.permission === 'granted') {
      new NotificationImpl('RAO', { body: message })
      return
    }
    onFallback(message)
  }

  return { notify }
}

export async function requestNotificationPermission(NotificationImpl) {
  if (!NotificationImpl || NotificationImpl.permission !== 'default') return
  await NotificationImpl.requestPermission()
}
