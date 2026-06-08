import { describe, it, expect, vi, beforeEach } from 'vitest'

const { connectMock, sendMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  sendMock: vi.fn(),
}))

vi.mock('worker-mailer', () => ({
  WorkerMailer: { connect: connectMock },
}))

import { sendRecapEmail } from '../src/mailer.js'

const CREDENTIALS = { username: 'rao.app@gmail.com', password: 'mot-de-passe-application' }

beforeEach(() => {
  connectMock.mockReset()
  sendMock.mockReset()
  connectMock.mockResolvedValue({ send: sendMock })
})

describe('sendRecapEmail', () => {
  it('se connecte au serveur SMTP de Gmail avec les identifiants fournis', async () => {
    await sendRecapEmail({
      credentials: CREDENTIALS,
      to: 'claudegermain1@gmail.com',
      subject: 'Récapitulatif RAO 8 juin 2026',
      text: 'Total : 12 personnes saisies.',
    })

    expect(connectMock).toHaveBeenCalledWith({
      credentials: CREDENTIALS,
      authType: 'plain',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
    })
  })

  it('envoie l\'e-mail avec le bon destinataire, objet et corps', async () => {
    await sendRecapEmail({
      credentials: CREDENTIALS,
      to: 'claudegermain1@gmail.com',
      subject: 'Récapitulatif RAO 8 juin 2026',
      text: 'Total : 12 personnes saisies.',
    })

    expect(sendMock).toHaveBeenCalledWith({
      from: { name: 'RAO - Saisie vocale', email: 'rao.app@gmail.com' },
      to: { email: 'claudegermain1@gmail.com' },
      subject: 'Récapitulatif RAO 8 juin 2026',
      text: 'Total : 12 personnes saisies.',
    })
  })

  it('retourne { success: true } quand l\'envoi réussit', async () => {
    const result = await sendRecapEmail({
      credentials: CREDENTIALS,
      to: 'claudegermain1@gmail.com',
      subject: 'Récapitulatif RAO 8 juin 2026',
      text: 'Total : 12 personnes saisies.',
    })

    expect(result).toEqual({ success: true })
  })

  it('inclut le contenu HTML dans l\'e-mail quand il est fourni', async () => {
    await sendRecapEmail({
      credentials: CREDENTIALS,
      to: 'claudegermain1@gmail.com',
      subject: 'Récapitulatif RAO 8 juin 2026',
      text: 'Total : 12 personnes saisies.',
      html: '<table><tr><td>Féminin</td></tr></table>',
    })

    expect(sendMock).toHaveBeenCalledWith({
      from: { name: 'RAO - Saisie vocale', email: 'rao.app@gmail.com' },
      to: { email: 'claudegermain1@gmail.com' },
      subject: 'Récapitulatif RAO 8 juin 2026',
      text: 'Total : 12 personnes saisies.',
      html: '<table><tr><td>Féminin</td></tr></table>',
    })
  })
})
