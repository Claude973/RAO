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

  return { addEntry, getCount, getEntries, reset }
}
