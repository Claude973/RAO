// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createDicteeScreen } from '../../src/ui/dicteeScreen.js'

function makeContainer() {
  const div = document.createElement('div')
  document.body.appendChild(div)
  return div
}

function createFakeSpeechCapture() {
  let transcriptHandler = null
  let errorHandler = null
  let endHandler = null
  return {
    start: vi.fn(),
    stop: vi.fn(),
    onTranscript: (h) => { transcriptHandler = h },
    onError: (h) => { errorHandler = h },
    onEnd: (h) => { endHandler = h },
    _fireTranscript: (text) => transcriptHandler?.(text),
    _fireError: (error) => errorHandler?.(error),
    _fireEnd: () => endHandler?.(),
  }
}

function makeDeps(overrides = {}) {
  return {
    speechCapture: createFakeSpeechCapture(),
    parsePhrase: vi.fn(),
    buildEntries: vi.fn().mockReturnValue([]),
    submitEntry: vi.fn(),
    sessionStore: {
      addEntry: vi.fn().mockReturnValue({ count: 1, shouldNotify: false }),
      getCount: vi.fn().mockReturnValue(0),
      getEntries: vi.fn().mockReturnValue([]),
      reset: vi.fn(),
    },
    notifier: { notify: vi.fn() },
    ...overrides,
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('createDicteeScreen — repos', () => {
  it('affiche le compteur de session et le bouton micro au repos', () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.sessionStore.getCount.mockReturnValue(5)

    createDicteeScreen(container, deps).show()

    expect(container.querySelector('.session-counter').textContent).toBe('5 fiches enregistrées')
    expect(container.querySelector('#mic-btn').textContent).toBe('🎤 Appuyer pour dicter')
  })
})

describe('createDicteeScreen — enregistrement', () => {
  it('démarre speechCapture et change le texte du bouton quand on clique sur le micro', () => {
    const container = makeContainer()
    const deps = makeDeps()

    createDicteeScreen(container, deps).show()
    container.querySelector('#mic-btn').click()

    expect(deps.speechCapture.start).toHaveBeenCalledTimes(1)
    expect(container.querySelector('#mic-btn').textContent).toBe('⏹ Appuyer pour arrêter')
  })

  it('arrête speechCapture et affiche le message d\'analyse quand on reclique', () => {
    const container = makeContainer()
    const deps = makeDeps()

    createDicteeScreen(container, deps).show()
    container.querySelector('#mic-btn').click()
    container.querySelector('#mic-btn').click()

    expect(deps.speechCapture.stop).toHaveBeenCalledTimes(1)
    expect(container.querySelector('#processing-msg')).not.toBeNull()
  })
})

describe('createDicteeScreen — erreur de reconnaissance vocale', () => {
  it('affiche un message d\'erreur et le bouton "Redicter" en cas d\'erreur vocale', () => {
    const container = makeContainer()
    const deps = makeDeps()

    createDicteeScreen(container, deps).show()
    container.querySelector('#mic-btn').click()
    deps.speechCapture._fireError('no-speech')

    expect(container.querySelector('.error-msg').textContent).toContain('Erreur de reconnaissance vocale')
    expect(container.querySelector('#retry-btn')).not.toBeNull()
  })

  it('retourne à l\'écran repos en cliquant sur "Redicter"', () => {
    const container = makeContainer()
    const deps = makeDeps()

    createDicteeScreen(container, deps).show()
    container.querySelector('#mic-btn').click()
    deps.speechCapture._fireError('no-speech')
    container.querySelector('#retry-btn').click()

    expect(container.querySelector('#mic-btn').textContent).toBe('🎤 Appuyer pour dicter')
  })
})

describe('createDicteeScreen — erreur d\'analyse (parsePhrase)', () => {
  it('affiche les champs manquants quand parsePhrase retourne ok=false', () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.parsePhrase.mockReturnValue({ ok: false, missingFields: ['date', 'trancheAge'] })

    createDicteeScreen(container, deps).show()
    container.querySelector('#mic-btn').click()
    container.querySelector('#mic-btn').click()
    deps.speechCapture._fireTranscript('deux filles département soixante-neuf')

    expect(container.querySelector('.error-msg').textContent).toContain('la date')
    expect(container.querySelector('.error-msg').textContent).toContain("la tranche d'âge")
  })
})

describe('createDicteeScreen — revue/confirmation', () => {
  const PARSED_OK = {
    ok: true,
    date: '2026-06-08',
    count: 3,
    sexe: 'Féminin',
    trancheAge: '6 - 10 ans',
    departement: '69',
  }

  function navigateToReview(container, deps) {
    deps.parsePhrase.mockReturnValue(PARSED_OK)
    createDicteeScreen(container, deps).show()
    container.querySelector('#mic-btn').click()
    container.querySelector('#mic-btn').click()
    deps.speechCapture._fireTranscript('test')
  }

  it('affiche les champs pré-remplis avec les valeurs extraites', () => {
    const container = makeContainer()
    const deps = makeDeps()
    navigateToReview(container, deps)

    expect(container.querySelector('#f-date').value).toBe('2026-06-08')
    expect(container.querySelector('#f-sexe').value).toBe('Féminin')
    expect(container.querySelector('#f-tranche').value).toBe('6 - 10 ans')
    expect(container.querySelector('#f-dept').value).toBe('69')
    expect(container.querySelector('#f-count').value).toBe('3')
  })

  it('affiche les boutons "Valider" et "Redicter depuis le début"', () => {
    const container = makeContainer()
    const deps = makeDeps()
    navigateToReview(container, deps)

    expect(container.querySelector('#validate-btn')).not.toBeNull()
    expect(container.querySelector('#retry-btn')).not.toBeNull()
  })

  it('le select tranche d\'âge propose les 5 tranches dans le bon ordre', () => {
    const container = makeContainer()
    const deps = makeDeps()
    navigateToReview(container, deps)

    const options = [...container.querySelectorAll('#f-tranche option')].map((o) => o.value)
    expect(options).toEqual(['6 - 10 ans', '11 - 15 ans', '16 - 18 ans', '19 - 25 ans', '+25 ans'])
  })

  it('retourne à l\'écran repos en cliquant sur "Redicter depuis le début"', () => {
    const container = makeContainer()
    const deps = makeDeps()
    navigateToReview(container, deps)
    container.querySelector('#retry-btn').click()

    expect(container.querySelector('#mic-btn').textContent).toBe('🎤 Appuyer pour dicter')
  })
})

describe('createDicteeScreen — envoi', () => {
  const PARSED_OK = {
    ok: true,
    date: '2026-06-08',
    count: 2,
    sexe: 'Féminin',
    trancheAge: '6 - 10 ans',
    departement: '69',
  }
  const ENTRIES = [
    { date: '2026-06-08', sexe: 'Féminin', trancheAge: '6 - 10 ans', departement: '69' },
    { date: '2026-06-08', sexe: 'Féminin', trancheAge: '6 - 10 ans', departement: '69' },
  ]

  function navigateToReview(container, deps) {
    deps.parsePhrase.mockReturnValue(PARSED_OK)
    deps.buildEntries.mockReturnValue(ENTRIES)
    createDicteeScreen(container, deps).show()
    container.querySelector('#mic-btn').click()
    container.querySelector('#mic-btn').click()
    deps.speechCapture._fireTranscript('test')
  }

  it('affiche le bouton "Retour à l\'accueil" une fois toutes les fiches envoyées avec succès', async () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.submitEntry = vi.fn().mockResolvedValue({ success: true })
    navigateToReview(container, deps)

    container.querySelector('#validate-btn').click()

    await vi.waitFor(() => expect(container.querySelector('#back-btn')).not.toBeNull())

    expect(deps.submitEntry).toHaveBeenCalledTimes(2)
    expect(deps.sessionStore.addEntry).toHaveBeenCalledTimes(2)
  })

  it('affiche le bouton "Relancer" pour les fiches échouées', async () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.submitEntry = vi.fn().mockResolvedValue({ success: false, error: 'network_error' })
    navigateToReview(container, deps)

    container.querySelector('#validate-btn').click()

    await vi.waitFor(() => expect(container.querySelector('.retry-entry-btn')).not.toBeNull())

    expect(container.querySelector('.retry-entry-btn')).not.toBeNull()
    expect(container.querySelector('#back-btn')).not.toBeNull()
    expect(deps.sessionStore.addEntry).not.toHaveBeenCalled()
  })

  it('relance une fiche échouée et la marque comme réussie', async () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.submitEntry = vi.fn()
      .mockResolvedValueOnce({ success: false, error: 'network_error' })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValue({ success: true })
    navigateToReview(container, deps)

    container.querySelector('#validate-btn').click()
    await vi.waitFor(() => expect(container.querySelector('.retry-entry-btn')).not.toBeNull())

    container.querySelector('.retry-entry-btn').click()
    await vi.waitFor(() => expect(container.querySelector('.retry-entry-btn')).toBeNull())

    expect(deps.sessionStore.addEntry).toHaveBeenCalledTimes(2)
  })

  it('déclenche la notification quand addEntry retourne shouldNotify=true', async () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.submitEntry = vi.fn().mockResolvedValue({ success: true })
    deps.sessionStore.addEntry = vi.fn().mockReturnValue({ count: 10, shouldNotify: true })
    navigateToReview(container, deps)

    container.querySelector('#validate-btn').click()
    await vi.waitFor(() => expect(container.querySelector('#back-btn')).not.toBeNull())

    expect(deps.notifier.notify).toHaveBeenCalledWith('10 fiches enregistrées')
  })

  it('retourne à l\'écran repos en cliquant sur "Retour à l\'accueil"', async () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.submitEntry = vi.fn().mockResolvedValue({ success: true })
    navigateToReview(container, deps)

    container.querySelector('#validate-btn').click()
    await vi.waitFor(() => expect(container.querySelector('#back-btn')).not.toBeNull())
    container.querySelector('#back-btn').click()

    expect(container.querySelector('#mic-btn').textContent).toBe('🎤 Appuyer pour dicter')
  })
})

describe('createDicteeScreen — comportement iOS (transcript pendant enregistrement)', () => {
  it('traite automatiquement la transcription reçue pendant l\'enregistrement', () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.parsePhrase.mockReturnValue({
      ok: true,
      date: '2026-06-09',
      count: 1,
      sexe: 'Masculin',
      trancheAge: '11 - 15 ans',
      departement: '69',
    })

    createDicteeScreen(container, deps).show()
    container.querySelector('#mic-btn').click()
    deps.speechCapture._fireTranscript('un garçon onze quinze ans département soixante-neuf')

    expect(deps.speechCapture.stop).toHaveBeenCalled()
    expect(container.querySelector('.review-form')).not.toBeNull()
    expect(container.querySelector('#f-date').value).toBe('2026-06-09')
  })

  it('affiche une erreur si onEnd se déclenche sans résultat (état processing)', () => {
    const container = makeContainer()
    const deps = makeDeps()

    createDicteeScreen(container, deps).show()
    container.querySelector('#mic-btn').click()
    container.querySelector('#mic-btn').click()
    deps.speechCapture._fireEnd()

    expect(container.querySelector('.error-msg')).not.toBeNull()
    expect(container.querySelector('.error-msg').textContent).toContain('sans résultat')
  })
})
