import { extractHiddenValue } from './htmlFields.js'

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
