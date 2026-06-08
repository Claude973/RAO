const RELAY_URL = 'https://rao-relay.claudegermain1.workers.dev'

async function postJson(path, payload) {
  const response = await fetch(`${RELAY_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  try {
    return await response.json()
  } catch {
    return { success: false, error: 'invalid_response' }
  }
}

export async function submitEntry(entry) {
  return postJson('/submit-entry', entry)
}

export async function sendRecap({ subject, text, html }) {
  return postJson('/send-recap', { subject, text, html })
}
