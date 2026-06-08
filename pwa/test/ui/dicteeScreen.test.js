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
  return {
    start: vi.fn(),
    stop: vi.fn(),
    onTranscript: (h) => { transcriptHandler = h },
    onError: (h) => { errorHandler = h },
    _fireTranscript: (text) => transcriptHandler?.(text),
    _fireError: (error) => errorHandler?.(error),
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
