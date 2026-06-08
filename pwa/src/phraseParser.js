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
