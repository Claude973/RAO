import { describe, it, expect, vi, beforeEach } from 'vitest'

const { submitEntryMock, sendRecapEmailMock } = vi.hoisted(() => ({
  submitEntryMock: vi.fn(),
  sendRecapEmailMock: vi.fn(),
}))

vi.mock('../src/quform.js', () => ({ submitEntry: submitEntryMock }))
vi.mock('../src/mailer.js', () => ({ sendRecapEmail: sendRecapEmailMock }))

import worker from '../src/index.js'

const ENV = {
  GMAIL_USERNAME: 'rao.app@gmail.com',
  GMAIL_APP_PASSWORD: 'mot-de-passe-application',
  CLIENT_RECAP_EMAIL: 'claudegermain1@gmail.com',
}

function postJson(path, payload) {
  return new Request(`https://relay.example.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

beforeEach(() => {
  submitEntryMock.mockReset()
  sendRecapEmailMock.mockReset()
})

describe('worker fetch handler', () => {
  it('POST /submit-entry transmet la fiche à submitEntry et renvoie 200 en cas de succès', async () => {
    submitEntryMock.mockResolvedValue({ success: true })

    const entry = { date: '2026-06-08', sexe: 'Féminin', trancheAge: '6 - 10 ans', departement: '69' }
    const response = await worker.fetch(postJson('/submit-entry', entry), ENV)

    expect(submitEntryMock).toHaveBeenCalledWith(entry)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
  })

  it('POST /submit-entry renvoie 502 quand submitEntry échoue', async () => {
    submitEntryMock.mockResolvedValue({ success: false, error: 'http_500' })

    const response = await worker.fetch(postJson('/submit-entry', {}), ENV)

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ success: false, error: 'http_500' })
  })

  it('POST /send-recap transmet objet/corps et les identifiants de l\'environnement à sendRecapEmail', async () => {
    sendRecapEmailMock.mockResolvedValue({ success: true })

    const response = await worker.fetch(
      postJson('/send-recap', { subject: 'Récapitulatif RAO 8 juin 2026', text: 'Total : 12 personnes.' }),
      ENV
    )

    expect(sendRecapEmailMock).toHaveBeenCalledWith({
      credentials: { username: 'rao.app@gmail.com', password: 'mot-de-passe-application' },
      to: 'claudegermain1@gmail.com',
      subject: 'Récapitulatif RAO 8 juin 2026',
      text: 'Total : 12 personnes.',
    })
    expect(response.status).toBe(200)
  })

  it('renvoie 405 pour une méthode autre que POST', async () => {
    const response = await worker.fetch(new Request('https://relay.example.com/submit-entry'), ENV)

    expect(response.status).toBe(405)
  })

  it('renvoie 404 pour une route inconnue', async () => {
    const response = await worker.fetch(postJson('/route-inconnue', {}), ENV)

    expect(response.status).toBe(404)
  })

  it('renvoie 400 pour /submit-entry si le corps n\'est pas du JSON valide', async () => {
    const response = await worker.fetch(
      new Request('https://relay.example.com/submit-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'ceci n\'est pas du JSON',
      }),
      ENV
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'bad_request' })
    expect(submitEntryMock).not.toHaveBeenCalled()
  })

  it('renvoie 400 pour /send-recap si le corps n\'est pas du JSON valide', async () => {
    const response = await worker.fetch(
      new Request('https://relay.example.com/send-recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'ceci n\'est pas du JSON',
      }),
      ENV
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'bad_request' })
    expect(sendRecapEmailMock).not.toHaveBeenCalled()
  })

  it('renvoie 400 pour /send-recap si subject ou text est manquant', async () => {
    const response = await worker.fetch(postJson('/send-recap', { subject: 'Sans corps' }), ENV)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'bad_request' })
    expect(sendRecapEmailMock).not.toHaveBeenCalled()
  })
})
