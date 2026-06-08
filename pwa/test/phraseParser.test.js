import { describe, it, expect } from 'vitest'
import { extractDate, extractSexe, extractCount, extractTrancheAge, extractDepartement } from '../src/phraseParser.js'

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

describe('extractSexe', () => {
  it('détecte "filles" comme Féminin', () => {
    expect(extractSexe('quatre filles, entre 6 et 10 ans')).toBe('Féminin')
  })

  it('détecte "garçons" comme Masculin', () => {
    expect(extractSexe('deux garçons, entre 11 et 15 ans')).toBe('Masculin')
  })

  it('détecte "féminin" et "masculin" dictés directement', () => {
    expect(extractSexe('une personne, féminin, 19-25 ans')).toBe('Féminin')
    expect(extractSexe('une personne, masculin, 19-25 ans')).toBe('Masculin')
  })

  it('renvoie null si le sexe n\'est pas détecté', () => {
    expect(extractSexe('quatre personnes, entre 6 et 10 ans')).toBeNull()
  })
})

describe('extractCount', () => {
  it('extrait un nombre énoncé en toutes lettres avant "filles"', () => {
    expect(extractCount('Le 8 juin 2026, quatre filles, entre 6 et 10 ans')).toBe(4)
  })

  it('extrait un nombre énoncé en toutes lettres avant "garçons"', () => {
    expect(extractCount('deux garçons, entre 11 et 15 ans')).toBe(2)
  })

  it('extrait un nombre composé avant "personnes"', () => {
    expect(extractCount('vingt-deux personnes, masculin, 19-25 ans')).toBe(22)
  })

  it('extrait un nombre dicté en chiffres', () => {
    expect(extractCount('3 filles, entre 6 et 10 ans')).toBe(3)
  })

  it('renvoie null si aucun nombre n\'est trouvé avant le mot clé', () => {
    expect(extractCount('des filles, entre 6 et 10 ans')).toBeNull()
  })
})

describe('extractTrancheAge', () => {
  it('reconnaît "entre 6 et 10 ans"', () => {
    expect(extractTrancheAge('quatre filles, entre 6 et 10 ans, département 69')).toBe('6 - 10 ans')
  })

  it('reconnaît "entre 11 et 15 ans"', () => {
    expect(extractTrancheAge('deux garçons, entre 11 et 15 ans')).toBe('11 - 15 ans')
  })

  it('reconnaît "entre 16 et 18 ans"', () => {
    expect(extractTrancheAge('une personne, entre 16 et 18 ans')).toBe('16 - 18 ans')
  })

  it('reconnaît "entre 19 et 25 ans"', () => {
    expect(extractTrancheAge('trois personnes, entre 19 et 25 ans')).toBe('19 - 25 ans')
  })

  it('reconnaît les formulations de "plus de 25 ans"', () => {
    expect(extractTrancheAge('une personne, plus de 25 ans')).toBe('+25 ans')
    expect(extractTrancheAge('une personne, +25 ans')).toBe('+25 ans')
    expect(extractTrancheAge('une personne, 25 ans et plus')).toBe('+25 ans')
  })

  it('renvoie null si aucune tranche d\'âge connue n\'est trouvée', () => {
    expect(extractTrancheAge('quatre filles, département 69')).toBeNull()
    expect(extractTrancheAge('quatre filles, entre 30 et 40 ans')).toBeNull()
  })
})

describe('extractDepartement', () => {
  it('convertit un département énoncé en toutes lettres ("soixante-neuf" -> "69")', () => {
    expect(extractDepartement('département soixante-neuf')).toBe('69')
  })

  it('convertit un département énoncé en toutes lettres à un chiffre, avec zéro initial ("neuf" -> "09")', () => {
    expect(extractDepartement('département neuf')).toBe('09')
  })

  it('accepte un département dicté en chiffres, avec zéro initial si besoin', () => {
    expect(extractDepartement('département 69')).toBe('69')
    expect(extractDepartement('département 8')).toBe('08')
  })

  it('convertit un département composé ("quatre-vingt-treize" -> "93")', () => {
    expect(extractDepartement('département quatre-vingt-treize')).toBe('93')
  })

  it('renvoie null si aucun département n\'est trouvé', () => {
    expect(extractDepartement('quatre filles, entre 6 et 10 ans')).toBeNull()
  })
})
