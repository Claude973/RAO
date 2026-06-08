const STORAGE_KEY = 'rao-session'

function loadEntries(storage) {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function createSessionStore(storage) {
  let entries = loadEntries(storage)

  function persist() {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }

  function addEntry(entry) {
    entries.push(entry)
    persist()
    return {
      count: entries.length,
      shouldNotify: entries.length > 0 && entries.length % 10 === 0,
    }
  }

  function getCount() {
    return entries.length
  }

  function getEntries() {
    return [...entries]
  }

  function reset() {
    entries = []
    persist()
  }

  function getSummary() {
    const summary = { total: entries.length, bySexe: {}, byTrancheAge: {}, byDepartement: {} }

    for (const entry of entries) {
      summary.bySexe[entry.sexe] = (summary.bySexe[entry.sexe] ?? 0) + 1
      summary.byTrancheAge[entry.trancheAge] = (summary.byTrancheAge[entry.trancheAge] ?? 0) + 1
      summary.byDepartement[entry.departement] = (summary.byDepartement[entry.departement] ?? 0) + 1
    }

    return summary
  }

  return { addEntry, getCount, getEntries, getSummary, reset }
}
