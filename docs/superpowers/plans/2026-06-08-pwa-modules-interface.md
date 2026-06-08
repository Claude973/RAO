# PWA — Modules d'interface (capture vocale, notifications, récapitulatif HTML) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire les modules purs et testables (sans DOM) qui serviront de fondations à l'interface de la PWA RAO — capture vocale, notifications, génération du récapitulatif HTML — et faire évoluer le relais et le client HTTP pour transporter ce récapitulatif en HTML.

**Architecture:** Chaque module est une fonction-fabrique injectable (même principe que `createSessionStore(storage)` du Plan 2a) : `createSpeechCapture` reçoit un constructeur `SpeechRecognition` injecté, `createNotifier` reçoit l'API `Notification` injectée — aucun n'accède directement à `window`/`navigator`, ce qui les rend testables sans navigateur réel. `buildRecapEmail` est une fonction pure. Le relais (`relay/`) et `relayClient.js` sont étendus pour transporter un champ `html` optionnel de bout en bout.

**Tech Stack:** JavaScript ES modules, Vitest (`vi.fn`, `vi.mock`), conventions héritées du Plan 2a (`pwa/src/sessionStore.js`, `pwa/src/relayClient.js`) et du relais Cloudflare Worker (`relay/src/mailer.js`, `relay/src/index.js`).

---

### Task 1: Speech capture — wrapper autour de la Web Speech API

**Files:**
- Create: `pwa/src/speechCapture.js`
- Test: `pwa/test/speechCapture.test.js`

**Contexte :** la Web Speech API expose un constructeur `SpeechRecognition` (ou `webkitSpeechRecognition`) qu'on instancie, configure (`lang`, `continuous`, `interimResults`), puis pilote via `start()`/`stop()` et les callbacks `onresult`/`onerror`. Pour rester testable sans navigateur, ce constructeur est **injecté** — exactement comme `createSessionStore(storage)` injecte le stockage dans le Plan 2a.

- [ ] **Step 1: Write the failing tests**

Create `pwa/test/speechCapture.test.js`:

```javascript
import { describe, it, expect, vi } from 'vitest'
import { createSpeechCapture } from '../src/speechCapture.js'

function createFakeSpeechRecognitionClass() {
  const instances = []

  class FakeSpeechRecognition {
    constructor() {
      this.lang = null
      this.continuous = null
      this.interimResults = null
      this.onresult = null
      this.onerror = null
      this.startCalls = 0
      this.stopCalls = 0
      instances.push(this)
    }

    start() {
      this.startCalls += 1
    }

    stop() {
      this.stopCalls += 1
    }
  }

  return { FakeSpeechRecognition, instances }
}

describe('createSpeechCapture', () => {
  it('configure la reconnaissance en français, en écoute continue, et la démarre', () => {
    const { FakeSpeechRecognition, instances } = createFakeSpeechRecognitionClass()
    const capture = createSpeechCapture(FakeSpeechRecognition)

    capture.start()

    expect(instances[0].lang).toBe('fr-FR')
    expect(instances[0].continuous).toBe(true)
    expect(instances[0].interimResults).toBe(false)
    expect(instances[0].startCalls).toBe(1)
  })

  it('arrête la reconnaissance en cours', () => {
    const { FakeSpeechRecognition, instances } = createFakeSpeechRecognitionClass()
    const capture = createSpeechCapture(FakeSpeechRecognition)

    capture.start()
    capture.stop()

    expect(instances[0].stopCalls).toBe(1)
  })

  it('transmet le texte transcrit au gestionnaire enregistré via onTranscript', () => {
    const { FakeSpeechRecognition, instances } = createFakeSpeechRecognitionClass()
    const capture = createSpeechCapture(FakeSpeechRecognition)
    const handler = vi.fn()

    capture.onTranscript(handler)
    capture.start()
    instances[0].onresult({
      results: [[{ transcript: 'Le 8 juin 2026' }], [{ transcript: 'quatre filles' }]],
    })

    expect(handler).toHaveBeenCalledWith('Le 8 juin 2026 quatre filles')
  })

  it('transmet les erreurs au gestionnaire enregistré via onError', () => {
    const { FakeSpeechRecognition, instances } = createFakeSpeechRecognitionClass()
    const capture = createSpeechCapture(FakeSpeechRecognition)
    const handler = vi.fn()

    capture.onError(handler)
    capture.start()
    instances[0].onerror({ error: 'no-speech' })

    expect(handler).toHaveBeenCalledWith('no-speech')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `pwa/`): `npx vitest run test/speechCapture.test.js`
Expected: FAIL — `Cannot find module '../src/speechCapture.js'`

- [ ] **Step 3: Implement `createSpeechCapture`**

Create `pwa/src/speechCapture.js`:

```javascript
export function createSpeechCapture(SpeechRecognitionImpl) {
  const recognition = new SpeechRecognitionImpl()
  recognition.lang = 'fr-FR'
  recognition.continuous = true
  recognition.interimResults = false

  let transcriptHandler = null
  let errorHandler = null

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0].transcript)
      .join(' ')
    transcriptHandler?.(transcript)
  }

  recognition.onerror = (event) => {
    errorHandler?.(event.error)
  }

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    onTranscript: (handler) => {
      transcriptHandler = handler
    },
    onError: (handler) => {
      errorHandler = handler
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/speechCapture.test.js`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add pwa/src/speechCapture.js pwa/test/speechCapture.test.js
git commit -m "feat(pwa): ajouter le wrapper de capture vocale autour de la Web Speech API"
```

---

### Task 2: Notifications de session (système avec repli interne)

**Files:**
- Create: `pwa/src/notify.js`
- Test: `pwa/test/notify.test.js`

**Contexte :** d'après la spec (section 7 du design `docs/superpowers/specs/2026-06-08-pwa-interface-saisie-design.md`), la notification "tous les 10" doit utiliser l'API `Notification` du navigateur si la permission est accordée, et se replier sur un affichage interne sinon. La demande de permission est une opération séparée (déclenchée une fois au démarrage de l'app), distincte de l'affichage d'une notification.

- [ ] **Step 1: Write the failing tests**

Create `pwa/test/notify.test.js`:

```javascript
import { describe, it, expect, vi } from 'vitest'
import { createNotifier, requestNotificationPermission } from '../src/notify.js'

describe('createNotifier', () => {
  it('affiche une notification système quand la permission est accordée', () => {
    const NotificationSpy = vi.fn()
    NotificationSpy.permission = 'granted'
    const onFallback = vi.fn()

    const notifier = createNotifier(NotificationSpy, onFallback)
    notifier.notify('10 fiches enregistrées')

    expect(NotificationSpy).toHaveBeenCalledWith('RAO', { body: '10 fiches enregistrées' })
    expect(onFallback).not.toHaveBeenCalled()
  })

  it('utilise le repli interne quand la permission est refusée', () => {
    const NotificationSpy = vi.fn()
    NotificationSpy.permission = 'denied'
    const onFallback = vi.fn()

    const notifier = createNotifier(NotificationSpy, onFallback)
    notifier.notify('10 fiches enregistrées')

    expect(NotificationSpy).not.toHaveBeenCalled()
    expect(onFallback).toHaveBeenCalledWith('10 fiches enregistrées')
  })

  it('utilise le repli interne quand l\'API Notification est indisponible', () => {
    const onFallback = vi.fn()

    const notifier = createNotifier(undefined, onFallback)
    notifier.notify('10 fiches enregistrées')

    expect(onFallback).toHaveBeenCalledWith('10 fiches enregistrées')
  })
})

describe('requestNotificationPermission', () => {
  it('demande la permission quand elle est encore "default"', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    const NotificationSpy = { permission: 'default', requestPermission }

    await requestNotificationPermission(NotificationSpy)

    expect(requestPermission).toHaveBeenCalled()
  })

  it('ne redemande pas la permission si elle est déjà accordée', async () => {
    const requestPermission = vi.fn()
    const NotificationSpy = { permission: 'granted', requestPermission }

    await requestNotificationPermission(NotificationSpy)

    expect(requestPermission).not.toHaveBeenCalled()
  })

  it('ne fait rien quand l\'API Notification est indisponible', async () => {
    await expect(requestNotificationPermission(undefined)).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `pwa/`): `npx vitest run test/notify.test.js`
Expected: FAIL — `Cannot find module '../src/notify.js'`

- [ ] **Step 3: Implement `createNotifier` and `requestNotificationPermission`**

Create `pwa/src/notify.js`:

```javascript
export function createNotifier(NotificationImpl, onFallback) {
  function notify(message) {
    if (NotificationImpl && NotificationImpl.permission === 'granted') {
      new NotificationImpl('RAO', { body: message })
      return
    }
    onFallback(message)
  }

  return { notify }
}

export async function requestNotificationPermission(NotificationImpl) {
  if (!NotificationImpl || NotificationImpl.permission !== 'default') return
  await NotificationImpl.requestPermission()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/notify.test.js`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add pwa/src/notify.js pwa/test/notify.test.js
git commit -m "feat(pwa): ajouter la gestion des notifications de session (système avec repli interne)"
```

---

### Task 3: Génération du récapitulatif (objet, corps texte, tableau HTML croisé)

**Files:**
- Create: `pwa/src/recapEmail.js`
- Test: `pwa/test/recapEmail.test.js`

**Contexte :** d'après la section 6 du design, ce module construit `{ subject, text, html }` à partir des entrées brutes de la session (`sessionStore.getEntries()`) et de la date du jour. Le `html` présente une **analyse croisée sexe × tranche d'âge** sous forme de tableau ; le `text` reste une version simple de secours. Ce module est indépendant de `sessionStore.getSummary()`.

- [ ] **Step 1: Write the failing tests**

Create `pwa/test/recapEmail.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { buildRecapEmail } from '../src/recapEmail.js'

const ENTRIES = [
  { date: '2026-06-08', sexe: 'Féminin', trancheAge: '6 - 10 ans', departement: '69' },
  { date: '2026-06-08', sexe: 'Féminin', trancheAge: '6 - 10 ans', departement: '69' },
  { date: '2026-06-08', sexe: 'Féminin', trancheAge: '11 - 15 ans', departement: '08' },
  { date: '2026-06-08', sexe: 'Masculin', trancheAge: '6 - 10 ans', departement: '69' },
]

describe('buildRecapEmail', () => {
  it('construit l\'objet avec la date fournie', () => {
    const result = buildRecapEmail(ENTRIES, '8 juin 2026')

    expect(result.subject).toBe('Récapitulatif RAO 8 juin 2026')
  })

  it('construit le corps texte avec le total et la répartition croisée sexe x tranche d\'âge', () => {
    const result = buildRecapEmail(ENTRIES, '8 juin 2026')

    expect(result.text).toBe(
      [
        'Récapitulatif de la session RAO',
        '',
        'Total : 4 personnes saisies',
        '',
        "Répartition par sexe et tranche d'âge :",
        '- Féminin, 6 - 10 ans : 2',
        '- Féminin, 11 - 15 ans : 1',
        '- Masculin, 6 - 10 ans : 1',
      ].join('\n')
    )
  })

  it('construit un tableau HTML avec une ligne par combinaison et le total', () => {
    const result = buildRecapEmail(ENTRIES, '8 juin 2026')

    expect(result.html).toContain('<table')
    expect(result.html).toContain('<th style="padding: 8px; border: 1px solid #cccccc; text-align: left;">Sexe</th>')
    expect(result.html).toContain('<th style="padding: 8px; border: 1px solid #cccccc; text-align: left;">Tranche d\'âge</th>')
    expect(result.html).toContain('<td style="padding: 8px; border: 1px solid #cccccc;">Féminin</td>')
    expect(result.html).toContain('<td style="padding: 8px; border: 1px solid #cccccc;">6 - 10 ans</td>')
    expect(result.html).toContain('<td style="padding: 8px; border: 1px solid #cccccc;">11 - 15 ans</td>')
    expect(result.html).toContain('<td style="padding: 8px; border: 1px solid #cccccc;">Masculin</td>')
    expect(result.html).toContain('<td style="padding: 8px; border: 1px solid #cccccc; text-align: right;">2</td>')
    expect(result.html).toContain('<td style="padding: 8px; border: 1px solid #cccccc; text-align: right;">1</td>')
    expect(result.html).toContain('Total : <strong>4 personnes saisies</strong>')
  })

  it('renvoie un récapitulatif vide quand il n\'y a aucune entrée', () => {
    const result = buildRecapEmail([], '8 juin 2026')

    expect(result.text).toBe(
      [
        'Récapitulatif de la session RAO',
        '',
        'Total : 0 personnes saisies',
        '',
        "Répartition par sexe et tranche d'âge :",
      ].join('\n')
    )
    expect(result.html).toContain('Total : <strong>0 personnes saisies</strong>')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `pwa/`): `npx vitest run test/recapEmail.test.js`
Expected: FAIL — `Cannot find module '../src/recapEmail.js'`

- [ ] **Step 3: Implement `buildRecapEmail`**

Create `pwa/src/recapEmail.js`:

```javascript
const CELL_STYLE = 'padding: 8px; border: 1px solid #cccccc;'
const CELL_STYLE_RIGHT = 'padding: 8px; border: 1px solid #cccccc; text-align: right;'
const HEADER_STYLE = 'padding: 8px; border: 1px solid #cccccc; text-align: left;'
const HEADER_STYLE_RIGHT = 'padding: 8px; border: 1px solid #cccccc; text-align: right;'

export function buildRecapEmail(entries, date) {
  const subject = `Récapitulatif RAO ${date}`
  const total = entries.length
  const rows = buildCrosstabRows(entries)

  return {
    subject,
    text: buildTextBody(total, rows),
    html: buildHtmlBody(total, rows),
  }
}

function buildCrosstabRows(entries) {
  const counts = new Map()
  const order = []

  for (const entry of entries) {
    const key = `${entry.sexe}|${entry.trancheAge}`
    if (!counts.has(key)) {
      counts.set(key, 0)
      order.push(key)
    }
    counts.set(key, counts.get(key) + 1)
  }

  return order.map((key) => {
    const [sexe, trancheAge] = key.split('|')
    return { sexe, trancheAge, count: counts.get(key) }
  })
}

function buildTextBody(total, rows) {
  return [
    'Récapitulatif de la session RAO',
    '',
    `Total : ${total} personnes saisies`,
    '',
    "Répartition par sexe et tranche d'âge :",
    ...rows.map(({ sexe, trancheAge, count }) => `- ${sexe}, ${trancheAge} : ${count}`),
  ].join('\n')
}

function buildHtmlBody(total, rows) {
  const bodyRows = rows
    .map(
      ({ sexe, trancheAge, count }, index) => `
      <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f2f2f2'};">
        <td style="${CELL_STYLE}">${sexe}</td>
        <td style="${CELL_STYLE}">${trancheAge}</td>
        <td style="${CELL_STYLE_RIGHT}">${count}</td>
      </tr>`
    )
    .join('')

  return `
    <h2 style="font-family: Arial, sans-serif; color: #1f4e79;">Récapitulatif de la session RAO</h2>
    <p style="font-family: Arial, sans-serif;">Total : <strong>${total} personnes saisies</strong></p>
    <table style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">
      <thead>
        <tr style="background-color: #1f4e79; color: #ffffff;">
          <th style="${HEADER_STYLE}">Sexe</th>
          <th style="${HEADER_STYLE}">Tranche d'âge</th>
          <th style="${HEADER_STYLE_RIGHT}">Nombre</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
      <tfoot>
        <tr style="font-weight: bold;">
          <td style="${CELL_STYLE}" colspan="2">Total</td>
          <td style="${CELL_STYLE_RIGHT}">${total}</td>
        </tr>
      </tfoot>
    </table>`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/recapEmail.test.js`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add pwa/src/recapEmail.js pwa/test/recapEmail.test.js
git commit -m "feat(pwa): générer le récapitulatif de session (objet, corps texte et tableau HTML croisé sexe/tranche d'âge)"
```

---

### Task 4: Relais — transmettre le contenu HTML optionnel de l'e-mail (`mailer.js`)

**Files:**
- Modify: `relay/src/mailer.js`
- Modify: `relay/test/mailer.test.js`

**Contexte :** `relay/src/mailer.js` exporte `sendRecapEmail({ credentials, to, subject, text })`, qui se connecte au SMTP Gmail via `worker-mailer` et envoie l'e-mail. La librairie `worker-mailer` accepte nativement un champ `html` optionnel dans `mailer.send(...)` (en plus de `text`, qui sert de repli pour les clients mail sans rendu HTML). Cette tâche ajoute le passage de ce champ, sans rien changer au comportement existant (l'égalité utilisée par `toHaveBeenCalledWith` ignore les propriétés `undefined`, donc les tests existants restent valides sans modification).

- [ ] **Step 1: Write the failing test**

Open `relay/test/mailer.test.js` and APPEND this test inside the existing `describe('sendRecapEmail', ...)` block (after the last `it`, before the closing `})`):

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `relay/`): `npx vitest run test/mailer.test.js`
Expected: FAIL — the new test's expectation includes `html`, but `sendMock` is currently called without it.

- [ ] **Step 3: Pass `html` through to `mailer.send`**

In `relay/src/mailer.js`, change the function signature and the `mailer.send` call:

```javascript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/mailer.test.js`
Expected: PASS — entire `relay/test/mailer.test.js` suite green (4 tests, including the new one). The pre-existing test `'envoie l\'e-mail avec le bon destinataire, objet et corps'` stays green unmodified: `toHaveBeenCalledWith` ignores `undefined`-valued properties, so the absence of `html` in its expectation still matches a call where `html` is `undefined`.

- [ ] **Step 5: Commit**

```bash
git add relay/src/mailer.js relay/test/mailer.test.js
git commit -m "feat(relay): transmettre le contenu HTML optionnel de l'e-mail récapitulatif (sendRecapEmail)"
```

---

### Task 5: Relais — transmettre le champ `html` depuis l'endpoint `/send-recap`

**Files:**
- Modify: `relay/src/index.js`
- Modify: `relay/test/index.test.js`

**Contexte :** l'endpoint `/send-recap` du worker lit `{ subject, text }` du corps JSON et les transmet à `sendRecapEmail`. Cette tâche ajoute la lecture et la transmission d'un champ `html` optionnel (la validation `bad_request` reste basée sur `subject`/`text`, qui restent obligatoires).

- [ ] **Step 1: Write the failing test**

Open `relay/test/index.test.js` and APPEND this test inside the `describe('worker fetch handler', ...)` block (after the existing `'POST /send-recap transmet objet/corps...'` test, before the next `it`):

```javascript
  it('POST /send-recap transmet le contenu HTML optionnel à sendRecapEmail', async () => {
    sendRecapEmailMock.mockResolvedValue({ success: true })

    const response = await worker.fetch(
      postJson('/send-recap', {
        subject: 'Récapitulatif RAO 8 juin 2026',
        text: 'Total : 12 personnes.',
        html: '<table><tr><td>Féminin</td></tr></table>',
      }),
      ENV
    )

    expect(sendRecapEmailMock).toHaveBeenCalledWith({
      credentials: { username: 'rao.app@gmail.com', password: 'mot-de-passe-application' },
      to: 'claudegermain1@gmail.com',
      subject: 'Récapitulatif RAO 8 juin 2026',
      text: 'Total : 12 personnes.',
      html: '<table><tr><td>Féminin</td></tr></table>',
    })
    expect(response.status).toBe(200)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `relay/`): `npx vitest run test/index.test.js`
Expected: FAIL — `sendRecapEmailMock` is called without `html` (it's not read from the payload yet).

- [ ] **Step 3: Read and pass through `html`**

In `relay/src/index.js`, inside the `/send-recap` branch, change:

```javascript
      const { subject, text } = payload
      if (!subject || !text) {
        return jsonResponse({ error: 'bad_request' }, 400)
      }
      const result = await sendRecapEmail({
        credentials: { username: env.GMAIL_USERNAME, password: env.GMAIL_APP_PASSWORD },
        to: env.CLIENT_RECAP_EMAIL,
        subject,
        text,
      })
```

to:

```javascript
      const { subject, text, html } = payload
      if (!subject || !text) {
        return jsonResponse({ error: 'bad_request' }, 400)
      }
      const result = await sendRecapEmail({
        credentials: { username: env.GMAIL_USERNAME, password: env.GMAIL_APP_PASSWORD },
        to: env.CLIENT_RECAP_EMAIL,
        subject,
        text,
        html,
      })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/index.test.js`
Expected: PASS — entire `relay/test/index.test.js` suite green (the pre-existing `/send-recap` test stays green unmodified, for the same `undefined`-ignoring equality reason as Task 4).

- [ ] **Step 5: Run the whole relay test suite**

Run (from `relay/`): `npm test`
Expected: PASS — all 5 test files green, no failures.

- [ ] **Step 6: Commit**

```bash
git add relay/src/index.js relay/test/index.test.js
git commit -m "feat(relay): transmettre le champ html optionnel du récapitulatif vers sendRecapEmail (/send-recap)"
```

---

### Task 6: Client relais PWA — transmettre `html` dans `sendRecap`

**Files:**
- Modify: `pwa/src/relayClient.js`
- Modify: `pwa/test/relayClient.test.js`

**Contexte :** `pwa/src/relayClient.js` exporte `sendRecap({ subject, text })`, qui poste `{ subject, text }` au relais via le helper interne `postJson`. Cette tâche étend `sendRecap` pour transmettre également un champ `html` optionnel — complétant la chaîne de bout en bout démarrée dans les tâches 4 et 5 (PWA → relais → e-mail).

- [ ] **Step 1: Write the failing test**

Open `pwa/test/relayClient.test.js` and APPEND this test inside the existing `describe('sendRecap', ...)` block (after the last `it`, before the closing `})`):

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `pwa/`): `npx vitest run test/relayClient.test.js`
Expected: FAIL — the request body sent by `sendRecap` omits `html` (it isn't destructured/forwarded yet), so it doesn't match `JSON.stringify(payload)` which includes `html`.

- [ ] **Step 3: Forward `html` in `sendRecap`**

In `pwa/src/relayClient.js`, change:

```javascript
export async function sendRecap({ subject, text }) {
  return postJson('/send-recap', { subject, text })
}
```

to:

```javascript
export async function sendRecap({ subject, text, html }) {
  return postJson('/send-recap', { subject, text, html })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/relayClient.test.js`
Expected: PASS — entire `pwa/test/relayClient.test.js` suite green (7 tests). The pre-existing `sendRecap` tests stay green unmodified: `JSON.stringify({ subject, text, html: undefined })` produces the exact same string as `JSON.stringify({ subject, text })`, since `JSON.stringify` omits `undefined`-valued properties.

- [ ] **Step 5: Run the whole PWA test suite**

Run (from `pwa/`): `npm test`
Expected: PASS — all 7 test files (`numberWords`, `phraseParser`, `sessionStore`, `relayClient`, `speechCapture`, `notify`, `recapEmail`) green, no failures.

- [ ] **Step 6: Commit**

```bash
git add pwa/src/relayClient.js pwa/test/relayClient.test.js
git commit -m "feat(pwa): transmettre le contenu HTML du récapitulatif au relais (sendRecap)"
```

---

## Out of scope reminders (for the next plan — UI screens & wiring)

- Les écrans "Dictée"/"Historique", `app.js` (câblage `localStorage`/`window`/notifications natives), le manifeste PWA et le service worker **ne font pas partie de ce plan** — ils consommeront les modules construits ici (`createSpeechCapture`, `createNotifier`, `requestNotificationPermission`, `buildRecapEmail`) ainsi que ceux du Plan 2a (`parsePhrase`, `buildEntries`, `createSessionStore`, `submitEntry`, `sendRecap`).
- Aucun appel réel à la Web Speech API, à l'API Notifications, ou aux services Gmail/`raid-aventure.org` dans les tests de ce plan — tout est injecté/mocké, conformément à la stratégie de test (section 9 du design).
