const RELAY_URL = 'https://rao-relay.claudegermain1.workers.dev'

async function postJson(path, payload) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`${RELAY_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    try {
      return await response.json()
    } catch {
      return { success: false, error: 'invalid_response' }
    }
  } catch (error) {
    clearTimeout(timeout)
    return { success: false, error: error.name === 'AbortError' ? 'timeout' : 'network_error' }
  }
}

export async function submitEntry(entry) {
  return postJson('/submit-entry', entry)
}

export async function sendRecap({ subject, text, html }) {
  return postJson('/send-recap', { subject, text, html })
}
