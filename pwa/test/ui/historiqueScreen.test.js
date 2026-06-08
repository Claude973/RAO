// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHistoriqueScreen } from '../../src/ui/historiqueScreen.js'

function makeContainer() {
  const div = document.createElement('div')
  document.body.appendChild(div)
  return div
}

function makeDeps(overrides = {}) {
  return {
    sessionStore: {
      getSummary: vi.fn().mockReturnValue({
        total: 4,
        bySexe: { Féminin: 3, Masculin: 1 },
        byTrancheAge: { '6 - 10 ans': 4 },
        byDepartement: { '69': 4 },
      }),
      getEntries: vi.fn().mockReturnValue([]),
      reset: vi.fn(),
    },
    buildRecapEmail: vi.fn().mockReturnValue({
      subject: 'Récapitulatif RAO 8 juin 2026',
      text: 'Total : 4',
      html: '<table></table>',
    }),
    sendRecap: vi.fn().mockResolvedValue({ success: true }),
    onSessionTerminated: vi.fn(),
    getDate: vi.fn().mockReturnValue('8 juin 2026'),
    ...overrides,
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('createHistoriqueScreen — affichage', () => {
  it('affiche le total de la session', () => {
    const container = makeContainer()
    createHistoriqueScreen(container, makeDeps()).show()

    expect(container.querySelector('.histo-total').textContent).toBe('4 fiches enregistrées durant cette session')
  })

  it('affiche la répartition par sexe', () => {
    const container = makeContainer()
    createHistoriqueScreen(container, makeDeps()).show()

    const text = container.querySelector('.histo-bySexe').textContent
    expect(text).toContain('Féminin : 3')
    expect(text).toContain('Masculin : 1')
  })

  it('affiche la répartition par tranche d\'âge', () => {
    const container = makeContainer()
    createHistoriqueScreen(container, makeDeps()).show()

    expect(container.querySelector('.histo-byAge').textContent).toContain('6 - 10 ans : 4')
  })

  it('affiche la répartition par département', () => {
    const container = makeContainer()
    createHistoriqueScreen(container, makeDeps()).show()

    expect(container.querySelector('.histo-byDept').textContent).toContain('69 : 4')
  })

  it('désactive le bouton "Terminer la session" quand il n\'y a aucune fiche', () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.sessionStore.getSummary.mockReturnValue({ total: 0, bySexe: {}, byTrancheAge: {}, byDepartement: {} })

    createHistoriqueScreen(container, deps).show()

    expect(container.querySelector('#terminer-btn').disabled).toBe(true)
  })

  it('active le bouton "Terminer la session" quand il y a des fiches', () => {
    const container = makeContainer()
    createHistoriqueScreen(container, makeDeps()).show()

    expect(container.querySelector('#terminer-btn').disabled).toBe(false)
  })
})

describe('createHistoriqueScreen — terminer la session', () => {
  it('appelle buildRecapEmail puis sendRecap avec les bons arguments', async () => {
    const container = makeContainer()
    const deps = makeDeps()

    createHistoriqueScreen(container, deps).show()
    container.querySelector('#terminer-btn').click()

    await vi.waitFor(() => expect(deps.sendRecap).toHaveBeenCalled())

    expect(deps.buildRecapEmail).toHaveBeenCalledWith([], '8 juin 2026')
    expect(deps.sendRecap).toHaveBeenCalledWith({
      subject: 'Récapitulatif RAO 8 juin 2026',
      text: 'Total : 4',
      html: '<table></table>',
    })
  })

  it('appelle reset + onSessionTerminated en cas de succès', async () => {
    const container = makeContainer()
    const deps = makeDeps()

    createHistoriqueScreen(container, deps).show()
    container.querySelector('#terminer-btn').click()

    await vi.waitFor(() => expect(deps.onSessionTerminated).toHaveBeenCalled())

    expect(deps.sessionStore.reset).toHaveBeenCalled()
    expect(deps.onSessionTerminated).toHaveBeenCalled()
  })

  it('affiche une erreur et le bouton "Réessayer" en cas d\'échec', async () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.sendRecap = vi.fn().mockResolvedValue({ success: false })

    createHistoriqueScreen(container, deps).show()
    container.querySelector('#terminer-btn').click()

    await vi.waitFor(() => expect(container.querySelector('.recap-error')).not.toBeNull())

    expect(container.querySelector('.recap-error').textContent).toContain('échoué')
    expect(container.querySelector('#retry-recap-btn')).not.toBeNull()
    expect(deps.sessionStore.reset).not.toHaveBeenCalled()
    expect(deps.onSessionTerminated).not.toHaveBeenCalled()
  })

  it('relance l\'envoi depuis le bouton "Réessayer l\'envoi"', async () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.sendRecap = vi.fn()
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: true })

    createHistoriqueScreen(container, deps).show()
    container.querySelector('#terminer-btn').click()

    await vi.waitFor(() => expect(container.querySelector('#retry-recap-btn')).not.toBeNull())
    container.querySelector('#retry-recap-btn').click()

    await vi.waitFor(() => expect(deps.onSessionTerminated).toHaveBeenCalled())

    expect(deps.sendRecap).toHaveBeenCalledTimes(2)
    expect(deps.sessionStore.reset).toHaveBeenCalled()
  })
})
