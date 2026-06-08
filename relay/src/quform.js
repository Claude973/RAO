import { extractHiddenValue } from './htmlFields.js'
import { FIXED_ANSWERS } from './fixedAnswers.js'

const FORM_URL = 'https://raid-aventure.org/questionnaire-jeunes-prox/'
const AJAX_URL = 'https://raid-aventure.org/wp-admin/admin-ajax.php'

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

  const body = new FormData()
  body.append('action', 'quform')
  body.append('quform_form_id', '9')
  body.append('quform_form_uid', context.formUid)
  body.append('quform_count', '1')
  body.append('form_url', FORM_URL)
  body.append('referring_url', '')
  body.append('post_id', context.postId)
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
  body.append('quform_submit', 'submit')

  const response = await fetch(AJAX_URL, {
    method: 'POST',
    headers: { Cookie: context.cookie ?? '' },
    body,
  })

  if (!response.ok) {
    return { success: false, error: `http_${response.status}` }
  }

  const result = await response.json()
  if (result && result.success) {
    return { success: true }
  }
  return { success: false, error: result?.message ?? 'submission_rejected' }
}
