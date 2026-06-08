import { WorkerMailer } from 'worker-mailer'

export async function sendRecapEmail({ credentials, to, subject, text, html }) {
  const mailer = await WorkerMailer.connect({
    credentials,
    authType: 'plain',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
  })

  await mailer.send({
    from: { name: 'RAO - Saisie vocale', email: credentials.username },
    to: { email: to },
    subject,
    text,
    html,
  })

  return { success: true }
}
