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

  if (normalized === 'quatre-vingts' || normalized === 'quatre-vingt') return 80
  if (normalized === 'soixante-dix') return 70
  if (normalized === 'quatre-vingt-dix') return 90

  const sixtyEightyMatch = normalized.match(/^(soixante|quatre-vingt)-(?:et-)?(.+)$/)
  if (sixtyEightyMatch) {
    const base = sixtyEightyMatch[1] === 'soixante' ? 60 : 80
    const rest = wordToNumber(sixtyEightyMatch[2])
    if (rest !== null && rest >= 1 && rest <= 19) return base + rest
  }

  const tensMatch = normalized.match(/^(vingt|trente|quarante|cinquante)-(?:et-)?(.+)$/)
  if (tensMatch) {
    const base = TENS[tensMatch[1]]
    const rest = wordToNumber(tensMatch[2])
    if (rest !== null && rest >= 1 && rest <= 9) return base + rest
  }

  return null
}
