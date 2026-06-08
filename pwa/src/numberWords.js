const UNITS = {
  zéro: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
}

const TEENS = {
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  'dix-sept': 17,
  'dix-huit': 18,
  'dix-neuf': 19,
}

const TENS = {
  vingt: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
}

export function wordToNumber(words) {
  const normalized = words.trim().toLowerCase().replace(/\s+/g, '-')
  if (normalized === '') return null

  if (normalized in UNITS) return UNITS[normalized]
  if (normalized in TEENS) return TEENS[normalized]
  if (normalized in TENS) return TENS[normalized]

  return null
}
