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
