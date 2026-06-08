import { wordToNumber } from './numberWords.js'

const MONTHS = {
  janvier: 1,
  février: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  août: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  décembre: 12,
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

export function extractDate(phrase) {
  const lower = phrase.toLowerCase()
  const monthNames = Object.keys(MONTHS).join('|')
  const match = lower.match(new RegExp(`(\\d{1,2})\\s+(${monthNames})\\s+(\\d{4})`))
  if (!match) return null

  const day = parseInt(match[1], 10)
  const month = MONTHS[match[2]]
  const year = match[3]

  return `${year}-${pad2(month)}-${pad2(day)}`
}

export function extractSexe(phrase) {
  const lower = phrase.toLowerCase()

  if (/\b(filles?|féminin)\b/.test(lower)) return 'Féminin'
  if (/\b(garçons?|masculin)\b/.test(lower)) return 'Masculin'

  return null
}

export function extractCount(phrase) {
  const lower = phrase.toLowerCase()
  const match = lower.match(/([a-zà-öø-ÿ0-9]+(?:-[a-zà-öø-ÿ]+)*)\s+(?:filles?|garçons?|personnes?)/)
  if (!match) return null

  const raw = match[1]
  if (/^\d+$/.test(raw)) return parseInt(raw, 10)

  return wordToNumber(raw)
}

const TRANCHE_RANGES = [
  { min: 6, max: 10, label: '6 - 10 ans' },
  { min: 11, max: 15, label: '11 - 15 ans' },
  { min: 16, max: 18, label: '16 - 18 ans' },
  { min: 19, max: 25, label: '19 - 25 ans' },
]

export function extractTrancheAge(phrase) {
  const lower = phrase.toLowerCase()

  if (/plus de 25 ans|\+\s*25 ans|25 ans et plus/.test(lower)) {
    return '+25 ans'
  }

  const rangeMatch = lower.match(/entre\s+(\d+)\s+et\s+(\d+)\s+ans/)
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10)
    const max = parseInt(rangeMatch[2], 10)
    const found = TRANCHE_RANGES.find((range) => range.min === min && range.max === max)
    if (found) return found.label
  }

  return null
}
