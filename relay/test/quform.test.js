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
