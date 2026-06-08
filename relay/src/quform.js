import { extractHiddenValue } from './htmlFields.js'
import { FIXED_ANSWERS } from './fixedAnswers.js'

const FORM_URL = 'https://raid-aventure.org/questionnaire-jeunes-prox/'

// Le formulaire rejette les soumissions trop rapides après le chargement de
// la page (protection anti-spam de Quform) avec le message "Veuillez
// patienter un instant avant de soumettre le formulaire."
const MIN_FILL_DELAY_MS = 6000

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchFormContext(formUrl) {
  const response = await fetch(formUrl)
  const html = await response.text()

  return {
    csrfToken: extractHiddenValue(html, 'quform_csrf_token'),
    formUid: extractHiddenValue(html, 'quform_form_uid'),
    quformLoaded: extractHiddenValue(html, 'quform_loaded'),
    postId: extractHiddenValue(html, 'post_id'),
    cookie: response.headers.get('set-cookie'),
  }
}

export async function submitEntry(entry) {
  const context = await fetchFormContext(FORM_URL)

  if (!context.csrfToken || !context.formUid || !context.quformLoaded || !context.postId) {
    return { success: false, error: 'form_context_unavailable' }
  }

  await wait(MIN_FILL_DELAY_MS)

  const body = new FormData()
  body.append('quform_form_id', '9')
  body.append('quform_form_uid', context.formUid)
  body.append('quform_count', '1')
  body.append('form_url', FORM_URL)
  body.append('referring_url', '')
  body.append('post_id', context.postId)
  body.append('post_title', "Questionnaire jeunes PROX'")
  body.append('quform_current_page_id', '1')
  body.append('quform_loaded', context.quformLoaded)
  body.append('quform_csrf_token', context.csrfToken)
  body.append('quform_9_398351', '')
  body.append('quform_9_17', entry.date)
  body.append('quform_9_15', entry.sexe)
  body.append('quform_9_19', entry.trancheAge)
  body.append('quform_9_14', entry.departement)
  for (const [field, value] of Object.entries(FIXED_ANSWERS)) {
    body.append(field, value)
  }
  body.append('quform_ajax', '1')
  body.append('quform_submit', 'submit')
  body.append('quform_removed_upload_uids', '')

  const response = await fetch(FORM_URL, {
    method: 'POST',
    headers: { Cookie: context.cookie ?? '' },
    body,
  })

  if (!response.ok) {
    return { success: false, error: `http_${response.status}` }
  }

  let result
  try {
    result = await response.json()
  } catch {
    return { success: false, error: 'invalid_response' }
  }

  if (result && result.success) {
    return { success: true }
  }
  return { success: false, error: result?.message ?? 'submission_rejected' }
}
