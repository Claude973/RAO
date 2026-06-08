import { describe, it, expect, vi, beforeEach } from 'vitest'
import { submitEntry, sendRecap } from '../src/relayClient.js'

const RELAY_URL = 'https://rao-relay.claudegermain1.workers.dev'

const ENTRY = { date: '2026-06-08', sexe: 'Féminin', trancheAge: '6 - 10 ans', departement: '69' }

beforeEach(() => {
  global.fetch = vi.fn()
})

describe('submitEntry', () => {
  it('poste la fiche au relais et renvoie le résultat en cas de succès', async () => {
    global.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))

    const result = await submitEntry(ENTRY)

    expect(global.fetch).toHaveBeenCalledWith(`${RELAY_URL}/submit-entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ENTRY),
    })
    expect(result).toEqual({ success: true })
  })

  it('renvoie l\'échec rapporté par le relais', async () => {
    global.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, error: 'http_500' }), { status: 502 })
    )

    const result = await submitEntry(ENTRY)

    expect(result).toEqual({ success: false, error: 'http_500' })
  })

  it('renvoie un échec invalid_response si la réponse n\'est pas du JSON valide', async () => {
    global.fetch.mockResolvedValueOnce(new Response('<html>Erreur</html>', { status: 200 }))

    const result = await submitEntry(ENTRY)

    expect(result).toEqual({ success: false, error: 'invalid_response' })
  })
})

describe('sendRecap', () => {
  it('poste le sujet et le corps au relais et renvoie le résultat en cas de succès', async () => {
    global.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))

    const payload = { subject: 'Récapitulatif RAO 8 juin 2026', text: 'Total : 12 personnes.' }
    const result = await sendRecap(payload)

    expect(global.fetch).toHaveBeenCalledWith(`${RELAY_URL}/send-recap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    expect(result).toEqual({ success: true })
  })

  it('renvoie l\'échec rapporté par le relais', async () => {
    global.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, error: 'http_502' }), { status: 502 })
    )

    const result = await sendRecap({ subject: 'Sujet', text: 'Corps' })

    expect(result).toEqual({ success: false, error: 'http_502' })
  })

  it('renvoie un échec invalid_response si la réponse n\'est pas du JSON valide', async () => {
    global.fetch.mockResolvedValueOnce(new Response('<html>Erreur</html>', { status: 200 }))

    const result = await sendRecap({ subject: 'Sujet', text: 'Corps' })

    expect(result).toEqual({ success: false, error: 'invalid_response' })
  })

  it('transmet le contenu HTML quand il est fourni', async () => {
    global.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))

    const payload = {
      subject: 'Récapitulatif RAO 8 juin 2026',
      text: 'Total : 12 personnes.',
      html: '<table><tr><td>Féminin</td></tr></table>',
    }
    await sendRecap(payload)

    expect(global.fetch).toHaveBeenCalledWith(`${RELAY_URL}/send-recap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  })
})
