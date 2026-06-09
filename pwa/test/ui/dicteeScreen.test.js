// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createDicteeScreen } from '../../src/ui/dicteeScreen.js'

function makeContainer() {
  const div = document.createElement('div')
  document.body.appendChild(div)
  return div
}

function makeDeps(overrides = {}) {
  return {
    buildEntries: vi.fn().mockImplementation(({ count }) =>
      Array.from({ length: count }, (_, i) => ({ id: i }))
    ),
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

function fillAndSubmit(container, { date = '2026-06-09', dept = '69', filles = {}, garcons = {} } = {}) {
  container.querySelector('#f-date').value = date
  container.querySelector('#f-dept').value = dept
  for (const [tranche, count] of Object.entries(filles)) {
    const el = container.querySelector(`.count-input[data-sexe="Féminin"][data-tranche="${tranche}"]`)
    if (el) el.value = String(count)
  }
  for (const [tranche, count] of Object.entries(garcons)) {
    const el = container.querySelector(`.count-input[data-sexe="Masculin"][data-tranche="${tranche}"]`)
    if (el) el.value = String(count)
  }
  container.querySelector('#saisie-form').dispatchEvent(new Event('submit'))
}

describe('createDicteeScreen — formulaire', () => {
  it('affiche le compteur et le formulaire de saisie', () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.sessionStore.getCount.mockReturnValue(3)

    createDicteeScreen(container, deps).show()

    expect(container.querySelector('.session-counter').textContent).toBe('3 fiches enregistrées')
    expect(container.querySelector('#f-date')).not.toBeNull()
    expect(container.querySelector('#f-dept')).not.toBeNull()
    expect(container.querySelectorAll('.count-input[data-sexe="Féminin"]').length).toBe(5)
    expect(container.querySelectorAll('.count-input[data-sexe="Masculin"]').length).toBe(5)
  })

  it('pré-remplit la date avec la date du jour au format YYYY-MM-DD', () => {
    const container = makeContainer()
    createDicteeScreen(container, makeDeps()).show()

    const today = new Date().toISOString().slice(0, 10)
    expect(container.querySelector('#f-date').value).toBe(today)
  })

  it('ne soumet pas si le département est manquant', () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.submitEntry = vi.fn()
    createDicteeScreen(container, deps).show()

    fillAndSubmit(container, { dept: '', filles: { '6 - 10 ans': 2 } })

    expect(deps.submitEntry).not.toHaveBeenCalled()
  })

  it('ne soumet pas si tous les compteurs sont à 0', () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.submitEntry = vi.fn()
    createDicteeScreen(container, deps).show()

    fillAndSubmit(container, { dept: '69' })

    expect(deps.submitEntry).not.toHaveBeenCalled()
  })

  it('appelle buildEntries pour chaque groupe non-nul', () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.submitEntry = vi.fn().mockResolvedValue({ success: true })
    createDicteeScreen(container, deps).show()

    fillAndSubmit(container, {
      filles: { '6 - 10 ans': 3 },
      garcons: { '11 - 15 ans': 2 },
    })

    expect(deps.buildEntries).toHaveBeenCalledWith(
      expect.objectContaining({ sexe: 'Féminin', trancheAge: '6 - 10 ans', count: 3 })
    )
    expect(deps.buildEntries).toHaveBeenCalledWith(
      expect.objectContaining({ sexe: 'Masculin', trancheAge: '11 - 15 ans', count: 2 })
    )
    expect(deps.buildEntries).toHaveBeenCalledTimes(2)
  })

  it('passe la date et le département à buildEntries', () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.submitEntry = vi.fn().mockResolvedValue({ success: true })
    createDicteeScreen(container, deps).show()

    fillAndSubmit(container, {
      date: '2026-06-09',
      dept: '69',
      filles: { '19 - 25 ans': 1 },
    })

    expect(deps.buildEntries).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-06-09', departement: '69' })
    )
  })
})

describe('createDicteeScreen — envoi', () => {
  it('affiche "Retour à l\'accueil" une fois toutes les fiches envoyées', async () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.buildEntries.mockReturnValue([{ id: 1 }, { id: 2 }])
    deps.submitEntry = vi.fn().mockResolvedValue({ success: true })
    createDicteeScreen(container, deps).show()

    fillAndSubmit(container, { filles: { '6 - 10 ans': 2 } })

    await vi.waitFor(() => expect(container.querySelector('#back-btn')).not.toBeNull())

    expect(deps.submitEntry).toHaveBeenCalledTimes(2)
    expect(deps.sessionStore.addEntry).toHaveBeenCalledTimes(2)
  })

  it('affiche le bouton "Relancer" pour les fiches échouées', async () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.buildEntries.mockReturnValue([{ id: 1 }])
    deps.submitEntry = vi.fn().mockResolvedValue({ success: false, error: 'network_error' })
    createDicteeScreen(container, deps).show()

    fillAndSubmit(container, { filles: { '6 - 10 ans': 1 } })

    await vi.waitFor(() => expect(container.querySelector('.retry-entry-btn')).not.toBeNull())

    expect(container.querySelector('#back-btn')).not.toBeNull()
    expect(deps.sessionStore.addEntry).not.toHaveBeenCalled()
  })

  it('relance une fiche échouée et la marque comme réussie', async () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.buildEntries.mockReturnValue([{ id: 1 }])
    deps.submitEntry = vi.fn()
      .mockResolvedValueOnce({ success: false, error: 'network_error' })
      .mockResolvedValue({ success: true })
    createDicteeScreen(container, deps).show()

    fillAndSubmit(container, { filles: { '6 - 10 ans': 1 } })
    await vi.waitFor(() => expect(container.querySelector('.retry-entry-btn')).not.toBeNull())

    container.querySelector('.retry-entry-btn').click()
    await vi.waitFor(() => expect(container.querySelector('.retry-entry-btn')).toBeNull())

    expect(deps.sessionStore.addEntry).toHaveBeenCalledTimes(1)
  })

  it('déclenche la notification quand shouldNotify=true', async () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.buildEntries.mockReturnValue([{ id: 1 }])
    deps.submitEntry = vi.fn().mockResolvedValue({ success: true })
    deps.sessionStore.addEntry = vi.fn().mockReturnValue({ count: 10, shouldNotify: true })
    createDicteeScreen(container, deps).show()

    fillAndSubmit(container, { filles: { '6 - 10 ans': 1 } })

    await vi.waitFor(() => expect(container.querySelector('#back-btn')).not.toBeNull())

    expect(deps.notifier.notify).toHaveBeenCalledWith('10 fiches enregistrées')
  })

  it('retourne au formulaire depuis "Retour à l\'accueil"', async () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.buildEntries.mockReturnValue([{ id: 1 }])
    deps.submitEntry = vi.fn().mockResolvedValue({ success: true })
    createDicteeScreen(container, deps).show()

    fillAndSubmit(container, { filles: { '6 - 10 ans': 1 } })
    await vi.waitFor(() => expect(container.querySelector('#back-btn')).not.toBeNull())
    container.querySelector('#back-btn').click()

    expect(container.querySelector('#saisie-form')).not.toBeNull()
  })
})
