import { describe, it, expect, beforeEach } from 'vitest'
import { createSessionStore } from '../src/sessionStore.js'

function createFakeStorage() {
  const store = new Map()
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  }
}

const ENTRY = { date: '2026-06-08', sexe: 'Féminin', trancheAge: '6 - 10 ans', departement: '69' }

describe('createSessionStore — compteur et notification', () => {
  it('démarre à zéro quand le stockage est vide', () => {
    const store = createSessionStore(createFakeStorage())

    expect(store.getCount()).toBe(0)
    expect(store.getEntries()).toEqual([])
  })

  it('incrémente le compteur à chaque fiche ajoutée', () => {
    const store = createSessionStore(createFakeStorage())

    store.addEntry(ENTRY)
    const result = store.addEntry(ENTRY)

    expect(store.getCount()).toBe(2)
    expect(result.count).toBe(2)
  })

  it('signale shouldNotify uniquement quand le compteur atteint un multiple de 10', () => {
    const store = createSessionStore(createFakeStorage())

    let lastResult
    for (let i = 1; i <= 10; i += 1) {
      lastResult = store.addEntry(ENTRY)
      if (i < 10) {
        expect(lastResult.shouldNotify).toBe(false)
      }
    }

    expect(lastResult.shouldNotify).toBe(true)
    expect(lastResult.count).toBe(10)
  })
})

describe('createSessionStore — persistance locale', () => {
  let storage

  beforeEach(() => {
    storage = createFakeStorage()
  })

  it('persiste les fiches ajoutées dans le stockage fourni', () => {
    const store = createSessionStore(storage)
    store.addEntry(ENTRY)

    expect(JSON.parse(storage.getItem('rao-session'))).toEqual([ENTRY])
  })

  it('recharge les fiches existantes depuis le stockage à la création', () => {
    storage.setItem('rao-session', JSON.stringify([ENTRY, ENTRY]))

    const store = createSessionStore(storage)

    expect(store.getCount()).toBe(2)
    expect(store.getEntries()).toEqual([ENTRY, ENTRY])
  })

  it('ignore un contenu de stockage corrompu et repart de zéro', () => {
    storage.setItem('rao-session', 'ceci n\'est pas du JSON')

    const store = createSessionStore(storage)

    expect(store.getCount()).toBe(0)
  })

  it('réinitialise le compteur et le stockage avec reset', () => {
    const store = createSessionStore(storage)
    store.addEntry(ENTRY)

    store.reset()

    expect(store.getCount()).toBe(0)
    expect(JSON.parse(storage.getItem('rao-session'))).toEqual([])
  })
})

describe('createSessionStore — résumé par sexe / tranche d\'âge / département', () => {
  it('calcule la répartition des fiches enregistrées', () => {
    const store = createSessionStore(createFakeStorage())

    store.addEntry({ date: '2026-06-08', sexe: 'Féminin', trancheAge: '6 - 10 ans', departement: '69' })
    store.addEntry({ date: '2026-06-08', sexe: 'Féminin', trancheAge: '11 - 15 ans', departement: '69' })
    store.addEntry({ date: '2026-06-08', sexe: 'Masculin', trancheAge: '6 - 10 ans', departement: '08' })

    expect(store.getSummary()).toEqual({
      total: 3,
      bySexe: { Féminin: 2, Masculin: 1 },
      byTrancheAge: { '6 - 10 ans': 2, '11 - 15 ans': 1 },
      byDepartement: { '69': 2, '08': 1 },
    })
  })

  it('renvoie un résumé vide quand aucune fiche n\'a été enregistrée', () => {
    const store = createSessionStore(createFakeStorage())

    expect(store.getSummary()).toEqual({
      total: 0,
      bySexe: {},
      byTrancheAge: {},
      byDepartement: {},
    })
  })
})
