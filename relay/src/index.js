import { submitEntry } from './quform.js'
import { sendRecapEmail } from './mailer.js'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'method_not_allowed' }, 405)
    }

    if (url.pathname === '/submit-entry') {
      let entry
      try {
        entry = await request.json()
      } catch {
        return jsonResponse({ error: 'bad_request' }, 400)
      }
      const result = await submitEntry(entry)
      return jsonResponse(result, result.success ? 200 : 502)
    }

    if (url.pathname === '/send-recap') {
      let payload
      try {
        payload = await request.json()
      } catch {
        return jsonResponse({ error: 'bad_request' }, 400)
      }
      const { subject, text } = payload
      if (!subject || !text) {
        return jsonResponse({ error: 'bad_request' }, 400)
      }
      const result = await sendRecapEmail({
        credentials: { username: env.GMAIL_USERNAME, password: env.GMAIL_APP_PASSWORD },
        to: env.CLIENT_RECAP_EMAIL,
        subject,
        text,
      })
      return jsonResponse(result, result.success ? 200 : 502)
    }

    return jsonResponse({ error: 'not_found' }, 404)
  },
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
