import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fetchFormContext } from '../src/quform.js'

const fixtureUrl = new URL('./fixtures/form-page.html', import.meta.url)
const formPageHtml = readFileSync(fileURLToPath(fixtureUrl), 'utf-8')

const FORM_URL = 'https://raid-aventure.org/questionnaire-jeunes-prox/'

beforeEach(() => {
  global.fetch = vi.fn()
})

describe('fetchFormContext', () => {
  it('récupère le jeton, l\'identifiant de formulaire et le cookie de session depuis la page', async () => {
    global.fetch.mockResolvedValueOnce(
      new Response(formPageHtml, {
        status: 200,
        headers: {
          'set-cookie': 'quform_session_test=abc123; path=/; secure; httponly',
        },
      })
    )

    const context = await fetchFormContext(FORM_URL)

    expect(global.fetch).toHaveBeenCalledWith(FORM_URL)
    expect(context).toEqual({
      csrfToken: 'TEST_CSRF_TOKEN_xyz789',
      formUid: 'TEST_UID_abc123',
      quformLoaded: '1111111111|TEST_LOADED_HASH',
      postId: '9999',
      cookie: 'quform_session_test=abc123; path=/; secure; httponly',
    })
  })
})

import { submitEntry } from '../src/quform.js'

const AJAX_URL = 'https://raid-aventure.org/wp-admin/admin-ajax.php'

const VALID_ENTRY = {
  date: '2026-06-08',
  sexe: 'Féminin',
  trancheAge: '6 - 10 ans',
  departement: '69',
}

function mockFormPageThenAjaxResponse(ajaxResponse) {
  global.fetch = vi.fn()
  global.fetch.mockResolvedValueOnce(
    new Response(formPageHtml, {
      status: 200,
      headers: { 'set-cookie': 'quform_session_test=abc123; path=/; secure; httponly' },
    })
  )
  global.fetch.mockResolvedValueOnce(ajaxResponse)
}

describe('submitEntry', () => {
  it('poste la fiche avec le jeton frais, les réponses fixes, et le champ piège vide', async () => {
    mockFormPageThenAjaxResponse(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    )

    const result = await submitEntry(VALID_ENTRY)

    expect(result).toEqual({ success: true })
    expect(global.fetch).toHaveBeenCalledTimes(2)

    const [ajaxCallUrl, ajaxCallOptions] = global.fetch.mock.calls[1]
    expect(ajaxCallUrl).toBe(AJAX_URL)
    expect(ajaxCallOptions.method).toBe('POST')
    expect(ajaxCallOptions.headers.Cookie).toBe('quform_session_test=abc123; path=/; secure; httponly')

    const body = ajaxCallOptions.body
    expect(body.get('action')).toBe('quform')
    expect(body.get('quform_form_id')).toBe('9')
    expect(body.get('quform_form_uid')).toBe('TEST_UID_abc123')
    expect(body.get('quform_loaded')).toBe('1111111111|TEST_LOADED_HASH')
    expect(body.get('quform_csrf_token')).toBe('TEST_CSRF_TOKEN_xyz789')
    expect(body.get('post_id')).toBe('9999')
    expect(body.get('quform_9_398351')).toBe('')
    expect(body.get('quform_9_17')).toBe('2026-06-08')
    expect(body.get('quform_9_15')).toBe('Féminin')
    expect(body.get('quform_9_19')).toBe('6 - 10 ans')
    expect(body.get('quform_9_14')).toBe('69')
    expect(body.get('quform_9_3')).toBe('Oui')
    expect(body.get('quform_9_4')).toBe('Les deux')
    expect(body.get('quform_9_5')).toBe('Non')
    expect(body.get('quform_9_6')).toBe('Oui')
    expect(body.get('quform_9_7')).toBe('Bon')
  })

  it('renvoie un échec si le serveur répond par une erreur HTTP', async () => {
    mockFormPageThenAjaxResponse(new Response('Erreur serveur', { status: 500 }))

    const result = await submitEntry(VALID_ENTRY)

    expect(result).toEqual({ success: false, error: 'http_500' })
  })

  it('renvoie un échec si le serveur rejette la soumission', async () => {
    mockFormPageThenAjaxResponse(
      new Response(JSON.stringify({ success: false, message: 'Jeton invalide' }), { status: 200 })
    )

    const result = await submitEntry(VALID_ENTRY)

    expect(result).toEqual({ success: false, error: 'Jeton invalide' })
  })
})
