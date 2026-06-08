# Relais de soumission — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire un petit relais serverless (Cloudflare Worker) qui (1) soumet une fiche
au formulaire officiel "Questionnaire jeunes PROX'" de raid-aventure.org et (2) envoie l'e-mail
récapitulatif final au client via Gmail SMTP — entièrement testable sans jamais appeler le
vrai site ni envoyer de vrai e-mail pendant les tests automatisés.

**Architecture:** Un Cloudflare Worker expose deux routes JSON (`POST /submit-entry` et
`POST /send-recap`). En interne, `quform.js` récupère un jeton anti-spam frais sur la page du
formulaire puis poste une fiche via `wp-admin/admin-ajax.php` (action `quform`) ; `mailer.js`
envoie l'e-mail récapitulatif via SMTP Gmail grâce à la librairie `worker-mailer`. Tous les
appels externes (`fetch` vers raid-aventure.org, connexion SMTP) sont simulés dans les tests —
rien ne touche jamais le vrai site ni n'envoie de vrai e-mail pendant les tests automatisés.

**Tech Stack:** JavaScript (ES modules), Cloudflare Workers + Wrangler CLI, Vitest, worker-mailer.

---

## Repères techniques (issus de l'analyse du formulaire — voir le cahier des charges)

- URL du formulaire : `https://raid-aventure.org/questionnaire-jeunes-prox/`
- Endpoint de soumission AJAX : `https://raid-aventure.org/wp-admin/admin-ajax.php`
  avec le paramètre `action=quform`
- Champs cachés à transmettre, extraits de la page du formulaire à chaque soumission :
  `quform_form_uid`, `quform_loaded`, `quform_csrf_token`, `post_id`
- Champs fixes constants : `quform_form_id=9`, `quform_count=1`,
  `form_url=https://raid-aventure.org/questionnaire-jeunes-prox/`, `referring_url=` (vide),
  `quform_current_page_id=1`
- Champ piège anti-spam `quform_9_398351` : doit **toujours rester vide**
- Réponses fixes du questionnaire : `quform_9_3=Oui`, `quform_9_4=Les deux`,
  `quform_9_5=Non`, `quform_9_6=Oui`, `quform_9_7=Bon`
- Champs variables dictés : `quform_9_17` (date, format `YYYY-MM-DD`), `quform_9_15`
  (`Féminin`/`Masculin`), `quform_9_19` (`6 - 10 ans`, `11 - 15 ans`, `16 - 18 ans`,
  `19 - 25 ans`, `+ de 25 ans`), `quform_9_14` (département en chiffres)

---

### Task 1: Scaffolding du projet relais

**Files:**
- Create: `relay/package.json`
- Create: `relay/wrangler.toml`
- Create: `relay/vitest.config.js`
- Create: `relay/.gitignore`

- [ ] **Step 1: Initialiser le projet npm et installer les dépendances**

```bash
mkdir relay
cd relay
npm init -y
npm install --save-dev vitest wrangler
npm install worker-mailer
```

Expected: `relay/package.json`, `relay/package-lock.json` et `relay/node_modules/` sont créés.

- [ ] **Step 2: Configurer `package.json` (module ES + scripts)**

Ouvrir `relay/package.json` et le remplacer par :

```json
{
  "name": "rao-relay",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "vitest": "<version installée par npm install>",
    "wrangler": "<version installée par npm install>"
  },
  "dependencies": {
    "worker-mailer": "<version installée par npm install>"
  }
}
```

Remplacer `<version installée par npm install>` par les numéros de version réellement
installés (visibles dans `package-lock.json` ou en ouvrant `node_modules/<paquet>/package.json`).

- [ ] **Step 3: Créer `relay/wrangler.toml`**

```toml
name = "rao-relay"
main = "src/index.js"
compatibility_date = "2026-06-08"
compatibility_flags = ["nodejs_compat"]
```

- [ ] **Step 4: Créer `relay/vitest.config.js`**

```javascript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
  },
})
```

- [ ] **Step 5: Créer `relay/.gitignore`**

```
node_modules/
.wrangler/
.dev.vars
```

- [ ] **Step 6: Vérifier que les tests (vides) tournent**

```bash
cd relay
npm test
```

Expected: Vitest démarre et indique "No test files found" (aucun test créé pour l'instant —
c'est normal).

- [ ] **Step 7: Commit**

```bash
cd "c:\Users\PC Jo\Documents\RAO"
git add relay/package.json relay/package-lock.json relay/wrangler.toml relay/vitest.config.js relay/.gitignore
git commit -m "Initialise le projet relais (Cloudflare Worker + Vitest + worker-mailer)"
```

---

### Task 2: Réponses fixes du questionnaire (constante partagée)

**Files:**
- Create: `relay/src/fixedAnswers.js`
- Test: `relay/test/fixedAnswers.test.js`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `relay/test/fixedAnswers.test.js` :

```javascript
import { describe, it, expect } from 'vitest'
import { FIXED_ANSWERS } from '../src/fixedAnswers.js'

describe('FIXED_ANSWERS', () => {
  it('contient les cinq réponses fixes attendues du questionnaire', () => {
    expect(FIXED_ANSWERS).toEqual({
      quform_9_3: 'Oui',
      quform_9_4: 'Les deux',
      quform_9_5: 'Non',
      quform_9_6: 'Oui',
      quform_9_7: 'Bon',
    })
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
cd relay
npx vitest run test/fixedAnswers.test.js
```

Expected: FAIL — `Cannot find module '../src/fixedAnswers.js'`

- [ ] **Step 3: Implémenter `relay/src/fixedAnswers.js`**

```javascript
export const FIXED_ANSWERS = {
  quform_9_3: 'Oui',
  quform_9_4: 'Les deux',
  quform_9_5: 'Non',
  quform_9_6: 'Oui',
  quform_9_7: 'Bon',
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

```bash
npx vitest run test/fixedAnswers.test.js
```

Expected: PASS — 1 test réussi

- [ ] **Step 5: Commit**

```bash
cd "c:\Users\PC Jo\Documents\RAO"
git add relay/src/fixedAnswers.js relay/test/fixedAnswers.test.js
git commit -m "Ajoute la constante des réponses fixes du questionnaire PROX'"
```

---

### Task 3: Extraction des champs cachés depuis le HTML du formulaire

**Files:**
- Create: `relay/src/htmlFields.js`
- Test: `relay/test/htmlFields.test.js`
- Create: `relay/test/fixtures/form-page.html`

- [ ] **Step 1: Créer la page de test (doublure locale du formulaire)**

Créer `relay/test/fixtures/form-page.html` — un extrait minimal reproduisant la structure des
champs cachés du vrai formulaire, avec des valeurs fictives clairement identifiables comme
données de test :

```html
<!DOCTYPE html>
<html lang="fr-FR">
<body>
<form id="quform-form-test" class="quform-form quform-form-9" action="/questionnaire-jeunes-prox/#quform-test" method="post" enctype="multipart/form-data">
  <input type="hidden" name="quform_form_id" value="9" />
  <input type="hidden" name="quform_form_uid" value="TEST_UID_abc123" />
  <input type="hidden" name="quform_count" value="1" />
  <input type="hidden" name="form_url" value="https://raid-aventure.org/questionnaire-jeunes-prox/" />
  <input type="hidden" name="referring_url" value="" />
  <input type="hidden" name="post_id" value="9999" />
  <input type="hidden" name="quform_current_page_id" value="1" />
  <input type="hidden" name="quform_loaded" value="1111111111|TEST_LOADED_HASH" />
  <input type="hidden" name="quform_csrf_token" value="TEST_CSRF_TOKEN_xyz789" />
</form>
</body>
</html>
```

- [ ] **Step 2: Écrire le test qui échoue**

Créer `relay/test/htmlFields.test.js` :

```javascript
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
```

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

```bash
npx vitest run test/htmlFields.test.js
```

Expected: FAIL — `Cannot find module '../src/htmlFields.js'`

- [ ] **Step 4: Implémenter `relay/src/htmlFields.js`**

```javascript
export function extractHiddenValue(html, fieldName) {
  const pattern = new RegExp(`name="${fieldName}"\\s+value="([^"]*)"`)
  const match = html.match(pattern)
  return match ? match[1] : null
}
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

```bash
npx vitest run test/htmlFields.test.js
```

Expected: PASS — 2 tests réussis

- [ ] **Step 6: Commit**

```bash
cd "c:\Users\PC Jo\Documents\RAO"
git add relay/src/htmlFields.js relay/test/htmlFields.test.js relay/test/fixtures/form-page.html
git commit -m "Ajoute l'extraction des champs cachés du formulaire (avec doublure de test)"
```

---

### Task 4: Récupération du contexte de soumission (jeton, cookie de session)

**Files:**
- Modify: `relay/src/quform.js` (créer)
- Test: `relay/test/quform.test.js`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `relay/test/quform.test.js` :

```javascript
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
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
npx vitest run test/quform.test.js
```

Expected: FAIL — `Cannot find module '../src/quform.js'`

- [ ] **Step 3: Implémenter `fetchFormContext` dans `relay/src/quform.js`**

```javascript
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
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

```bash
npx vitest run test/quform.test.js
```

Expected: PASS — 1 test réussi

- [ ] **Step 5: Commit**

```bash
cd "c:\Users\PC Jo\Documents\RAO"
git add relay/src/quform.js relay/test/quform.test.js
git commit -m "Ajoute la récupération du contexte de soumission (jeton + cookie de session)"
```

---

### Task 5: Soumission d'une fiche au formulaire officiel

**Files:**
- Modify: `relay/src/quform.js`
- Modify: `relay/test/quform.test.js`

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à la fin de `relay/test/quform.test.js` :

```javascript
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
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

```bash
npx vitest run test/quform.test.js
```

Expected: FAIL — `submitEntry is not a function` (ou `Cannot find export`)

- [ ] **Step 3: Implémenter `submitEntry` dans `relay/src/quform.js`**

Ajouter en haut du fichier :

```javascript
import { FIXED_ANSWERS } from './fixedAnswers.js'

const FORM_URL = 'https://raid-aventure.org/questionnaire-jeunes-prox/'
const AJAX_URL = 'https://raid-aventure.org/wp-admin/admin-ajax.php'
```

Puis ajouter à la fin du fichier :

```javascript
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
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

```bash
npx vitest run test/quform.test.js
```

Expected: PASS — 4 tests réussis

- [ ] **Step 5: Commit**

```bash
cd "c:\Users\PC Jo\Documents\RAO"
git add relay/src/quform.js relay/test/quform.test.js
git commit -m "Ajoute la soumission d'une fiche au formulaire officiel (avec réponses fixes et champ piège vide)"
```

---

### Task 6: Envoi de l'e-mail récapitulatif via Gmail SMTP

**Files:**
- Create: `relay/src/mailer.js`
- Test: `relay/test/mailer.test.js`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `relay/test/mailer.test.js` :

```javascript
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
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
npx vitest run test/mailer.test.js
```

Expected: FAIL — `Cannot find module '../src/mailer.js'`

- [ ] **Step 3: Implémenter `relay/src/mailer.js`**

```javascript
import { WorkerMailer } from 'worker-mailer'

export async function sendRecapEmail({ credentials, to, subject, text }) {
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
  })

  return { success: true }
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

```bash
npx vitest run test/mailer.test.js
```

Expected: PASS — 3 tests réussis

- [ ] **Step 5: Commit**

```bash
cd "c:\Users\PC Jo\Documents\RAO"
git add relay/src/mailer.js relay/test/mailer.test.js
git commit -m "Ajoute l'envoi de l'e-mail récapitulatif via Gmail SMTP (worker-mailer)"
```

---

### Task 7: Point d'entrée du Worker (routes HTTP)

**Files:**
- Create: `relay/src/index.js`
- Test: `relay/test/index.test.js`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `relay/test/index.test.js` :

```javascript
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
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
npx vitest run test/index.test.js
```

Expected: FAIL — `Cannot find module '../src/index.js'`

- [ ] **Step 3: Implémenter `relay/src/index.js`**

```javascript
import { submitEntry } from './quform.js'
import { sendRecapEmail } from './mailer.js'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'method_not_allowed' }, 405)
    }

    if (url.pathname === '/submit-entry') {
      const entry = await request.json()
      const result = await submitEntry(entry)
      return jsonResponse(result, result.success ? 200 : 502)
    }

    if (url.pathname === '/send-recap') {
      const { subject, text } = await request.json()
      const result = await sendRecapEmail({
        credentials: { username: env.GMAIL_USERNAME, password: env.GMAIL_APP_PASSWORD },
        to: env.CLIENT_RECAP_EMAIL,
        subject,
        text,
      })
      return jsonResponse(result, result.success ? 200 : 502)
    }

    return jsonResponse({ error: 'not_found' }, 404)
  },
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

```bash
npx vitest run test/index.test.js
```

Expected: PASS — 5 tests réussis

- [ ] **Step 5: Lancer toute la suite de tests du relais**

```bash
npm test
```

Expected: PASS — tous les tests (fixedAnswers, htmlFields, quform, mailer, index) réussissent,
0 échec

- [ ] **Step 6: Commit**

```bash
cd "c:\Users\PC Jo\Documents\RAO"
git add relay/src/index.js relay/test/index.test.js
git commit -m "Ajoute le point d'entrée du Worker (routes /submit-entry et /send-recap)"
```

---

### Task 8: Configuration des secrets et déploiement gratuit

**Files:**
- Create: `relay/.dev.vars.example`

- [ ] **Step 1: Documenter les variables d'environnement attendues**

Créer `relay/.dev.vars.example` (fichier d'exemple, sans vraies valeurs — le vrai fichier
`.dev.vars` est ignoré par git, voir Task 1 Step 5) :

```
GMAIL_USERNAME=adresse-gmail-dediee-a-l-app@gmail.com
GMAIL_APP_PASSWORD=mot-de-passe-application-genere-depuis-le-compte-google
CLIENT_RECAP_EMAIL=claudegermain1@gmail.com
```

- [ ] **Step 2: Créer un compte Cloudflare gratuit et s'authentifier**

```bash
cd relay
npx wrangler login
```

Expected: ouverture du navigateur pour connecter le compte Cloudflare (gratuit) à Wrangler.

- [ ] **Step 3: Créer un mot de passe d'application Gmail**

Sur le compte Gmail qui enverra les e-mails (https://myaccount.google.com/apppasswords),
générer un "mot de passe d'application" dédié à ce projet — ne jamais utiliser le mot de passe
principal du compte Gmail.

- [ ] **Step 4: Enregistrer les secrets sur Cloudflare**

```bash
cd relay
npx wrangler secret put GMAIL_USERNAME
npx wrangler secret put GMAIL_APP_PASSWORD
npx wrangler secret put CLIENT_RECAP_EMAIL
```

Expected: Wrangler demande la valeur de chaque secret (saisie masquée) et confirme
l'enregistrement.

- [ ] **Step 5: Créer un fichier `.dev.vars` local pour le développement**

Copier `relay/.dev.vars.example` vers `relay/.dev.vars` et y renseigner les vraies valeurs
(ce fichier ne sera jamais commité, voir `.gitignore` de la Task 1).

- [ ] **Step 6: Déployer le Worker**

```bash
cd relay
npm run deploy
```

Expected: Wrangler affiche l'URL publique du Worker déployé
(ex. `https://rao-relay.<compte>.workers.dev`)

- [ ] **Step 7: Commit**

```bash
cd "c:\Users\PC Jo\Documents\RAO"
git add relay/.dev.vars.example
git commit -m "Documente les variables d'environnement nécessaires au déploiement du relais"
```

---

### Task 9: Vérification finale concertée sur le vrai site (hors tests automatisés)

**Files:** aucun fichier modifié — étapes manuelles de vérification, conformément à la
stratégie de test du cahier des charges (section 7).

- [ ] **Step 1: Capturer une vraie soumission via les outils de développement du navigateur**

Ouvrir le formulaire officiel dans Chrome/Edge, ouvrir l'onglet "Réseau" des outils de
développement, remplir et soumettre **une fois manuellement** le formulaire avec de vraies
réponses. Comparer la requête réellement envoyée (URL, en-têtes, champs du corps) avec ce que
`submitEntry` construit dans `relay/src/quform.js`. Ajuster le code si des différences
apparaissent (ex. nom de champ différent, en-tête supplémentaire requis).

- [ ] **Step 2: Prévenir le client RAO**

Avant toute soumission de test réelle, informer le client (par e-mail ou message) qu'un petit
nombre d'entrées de test va apparaître dans ses réponses au questionnaire, avec des valeurs
clairement identifiables (par exemple département `00` et une date très éloignée comme
`2099-01-01`), et lui indiquer qu'il pourra les supprimer depuis l'administration de son site
WordPress une fois la vérification terminée.

- [ ] **Step 3: Effectuer 1 à 3 soumissions réelles minimales et vérifier leur réception**

Appeler la route `POST /submit-entry` du Worker déployé (Task 8) avec 1 à 3 fiches de test
clairement identifiables (ex. `{ date: '2099-01-01', sexe: 'Féminin', trancheAge: '6 - 10 ans', departement: '00' }`),
et vérifier dans l'administration WordPress du client que les réponses apparaissent
correctement dans les statistiques du formulaire.

- [ ] **Step 4: Vérifier l'envoi de l'e-mail récapitulatif réel**

Appeler la route `POST /send-recap` du Worker déployé avec un objet et un corps de test, et
vérifier que l'e-mail arrive bien à l'adresse du client (`claudegermain1@gmail.com`), avec le
bon objet et le bon contenu.

- [ ] **Step 5: Confirmer la suppression des entrées de test par le client**

Confirmer avec le client que les entrées de test identifiées à l'étape 3 ont bien été
supprimées de ses statistiques.
