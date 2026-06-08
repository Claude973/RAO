import { describe, it, expect } from 'vitest'
import { wordToNumber } from '../src/numberWords.js'

describe('wordToNumber — unités, dizaines simples et nombres de 11 à 19', () => {
  it('convertit les unités', () => {
    expect(wordToNumber('zéro')).toBe(0)
    expect(wordToNumber('un')).toBe(1)
    expect(wordToNumber('une')).toBe(1)
    expect(wordToNumber('quatre')).toBe(4)
    expect(wordToNumber('neuf')).toBe(9)
  })

  it('convertit les nombres de 11 à 19', () => {
    expect(wordToNumber('onze')).toBe(11)
    expect(wordToNumber('seize')).toBe(16)
    expect(wordToNumber('dix-sept')).toBe(17)
    expect(wordToNumber('dix-neuf')).toBe(19)
  })

  it('convertit les dizaines rondes', () => {
    expect(wordToNumber('vingt')).toBe(20)
    expect(wordToNumber('trente')).toBe(30)
    expect(wordToNumber('soixante')).toBe(60)
  })

  it('est insensible à la casse, aux espaces et accepte espaces ou tirets', () => {
    expect(wordToNumber('QUATRE')).toBe(4)
    expect(wordToNumber('  dix-sept  ')).toBe(17)
    expect(wordToNumber('dix sept')).toBe(17)
  })

  it('renvoie null pour un mot qui n\'est pas un nombre', () => {
    expect(wordToNumber('bonjour')).toBeNull()
    expect(wordToNumber('')).toBeNull()
  })
})

describe('wordToNumber — nombres composés (21 à 99)', () => {
  it('convertit les dizaines + unité avec tiret', () => {
    expect(wordToNumber('vingt-deux')).toBe(22)
    expect(wordToNumber('trente-cinq')).toBe(35)
  })

  it('convertit les dizaines + unité avec "et"', () => {
    expect(wordToNumber('vingt-et-un')).toBe(21)
    expect(wordToNumber('vingt et un')).toBe(21)
  })

  it('convertit soixante-dix à soixante-dix-neuf (60 + nombre de 10 à 19)', () => {
    expect(wordToNumber('soixante-dix')).toBe(70)
    expect(wordToNumber('soixante-et-onze')).toBe(71)
    expect(wordToNumber('soixante-quinze')).toBe(75)
    expect(wordToNumber('soixante-dix-neuf')).toBe(79)
  })

  it('convertit soixante + unité (61 à 69)', () => {
    expect(wordToNumber('soixante-neuf')).toBe(69)
  })

  it('convertit quatre-vingts et ses dérivés (80 à 99)', () => {
    expect(wordToNumber('quatre-vingts')).toBe(80)
    expect(wordToNumber('quatre-vingt')).toBe(80)
    expect(wordToNumber('quatre-vingt-trois')).toBe(83)
    expect(wordToNumber('quatre-vingt-dix')).toBe(90)
    expect(wordToNumber('quatre-vingt-dix-sept')).toBe(97)
  })
})
