import { describe, it, expect, vi } from 'vitest'
import { createNotifier, requestNotificationPermission } from '../src/notify.js'

describe('createNotifier', () => {
  it('affiche une notification système quand la permission est accordée', () => {
    const NotificationSpy = vi.fn()
    NotificationSpy.permission = 'granted'
    const onFallback = vi.fn()

    const notifier = createNotifier(NotificationSpy, onFallback)
    notifier.notify('10 fiches enregistrées')

    expect(NotificationSpy).toHaveBeenCalledWith('RAO', { body: '10 fiches enregistrées' })
    expect(onFallback).not.toHaveBeenCalled()
  })

  it('utilise le repli interne quand la permission est refusée', () => {
    const NotificationSpy = vi.fn()
    NotificationSpy.permission = 'denied'
    const onFallback = vi.fn()

    const notifier = createNotifier(NotificationSpy, onFallback)
    notifier.notify('10 fiches enregistrées')

    expect(NotificationSpy).not.toHaveBeenCalled()
    expect(onFallback).toHaveBeenCalledWith('10 fiches enregistrées')
  })

  it('utilise le repli interne quand l\'API Notification est indisponible', () => {
    const onFallback = vi.fn()

    const notifier = createNotifier(undefined, onFallback)
    notifier.notify('10 fiches enregistrées')

    expect(onFallback).toHaveBeenCalledWith('10 fiches enregistrées')
  })
})

describe('requestNotificationPermission', () => {
  it('demande la permission quand elle est encore "default"', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    const NotificationSpy = { permission: 'default', requestPermission }

    await requestNotificationPermission(NotificationSpy)

    expect(requestPermission).toHaveBeenCalled()
  })

  it('ne redemande pas la permission si elle est déjà accordée', async () => {
    const requestPermission = vi.fn()
    const NotificationSpy = { permission: 'granted', requestPermission }

    await requestNotificationPermission(NotificationSpy)

    expect(requestPermission).not.toHaveBeenCalled()
  })

  it('ne fait rien quand l\'API Notification est indisponible', async () => {
    await expect(requestNotificationPermission(undefined)).resolves.toBeUndefined()
  })
})
