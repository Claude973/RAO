import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { extractHiddenValue } from '../src/htmlFields.js'

const fixtureUrl = new URL('./fixtures/form-page.html', import.meta.url)
const formPageHtml = readFileSync(fileURLToPath(fixtureUrl), 'utf-8')

describe('extractHiddenValue', () => {
  it('extrait la valeur d\'un champ caché donné par son nom', () => {
    expect(extractHiddenValue(formPageHtml, 'quform_csrf_token')).toBe('TEST_CSRF_TOKEN_xyz789')
    expect(extractHiddenValue(formPageHtml, 'quform_form_uid')).toBe('TEST_UID_abc123')
    expect(extractHiddenValue(formPageHtml, 'quform_loaded')).toBe('1111111111|TEST_LOADED_HASH')
    expect(extractHiddenValue(formPageHtml, 'post_id')).toBe('9999')
  })

  it('retourne null si le champ est absent', () => {
    expect(extractHiddenValue(formPageHtml, 'champ_inexistant')).toBeNull()
  })
})
