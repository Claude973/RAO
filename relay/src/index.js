import { submitEntry } from './quform.js'
import { sendRecapEmail } from './mailer.js'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'method_not_allowed' }, 405)
    }

    if (url.pathname === '/submit-entry') {
      const entry = await request.json()
      const result = await submitEntry(entry)
      return jsonResponse(result, result.success ? 200 : 502)
    }

    if (url.pathname === '/send-recap') {
      const { subject, text } = await request.json()
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
