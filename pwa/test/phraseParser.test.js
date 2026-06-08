import { describe, it, expect } from 'vitest'
import { extractDate } from '../src/phraseParser.js'

describe('extractDate', () => {
  it('extrait une date au format "le 8 juin 2026"', () => {
    expect(extractDate('Le 8 juin 2026, quatre filles, entre 6 et 10 ans, département 69')).toBe('2026-06-08')
  })

  it('complète les jours et mois sur un chiffre avec un zéro', () => {
    expect(extractDate('Le 3 mars 2025, deux garçons')).toBe('2025-03-03')
  })

  it('fonctionne sans l\'article "le"', () => {
    expect(extractDate('8 juin 2026, quatre filles')).toBe('2026-06-08')
  })

  it('renvoie null si aucune date n\'est trouvée', () => {
    expect(extractDate('quatre filles, entre 6 et 10 ans, département 69')).toBeNull()
  })
})
