# PWA — Écrans UI et câblage final (Plan 2b-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire les écrans "Dictée" et "Historique" de la PWA RAO, les câbler dans `app.js` avec les modules purs du Plan 2b-1, et ajouter les fichiers PWA (`index.html`, `manifest.json`, `service-worker.js`).

**Architecture:** Chaque écran est un module pur créé par une fonction-fabrique `createXxxScreen(container, deps)` qui retourne `{ show() }`. Les dépendances (`sessionStore`, `speechCapture`, `submitEntry`, etc.) sont toutes injectées — les écrans ne touchent jamais `window` ni `localStorage` directement. Seul `app.js` accède aux APIs navigateur réelles. Les tests UI utilisent jsdom (via pragma `// @vitest-environment jsdom`) et des mocks vitest injectés, sans navigateur réel.

**Tech Stack:** JavaScript vanilla ES modules, Vitest 4.x + jsdom, modules purs du Plan 2a/2b-1 (`parsePhrase`, `buildEntries`, `createSessionStore`, `submitEntry`, `sendRecap`, `createSpeechCapture`, `createNotifier`, `buildRecapEmail`).

---

### Interfaces des modules existants (référence)

Toutes importées de fichiers déjà sur `master` :

```js
// phraseParser.js
parsePhrase(phrase) → { ok: false, missingFields: string[] }
                   | { ok: true, date, count, sexe, trancheAge, departement }
buildEntries({ date, count, sexe, trancheAge, departement }) → [{ date, sexe, trancheAge, departement }]

// sessionStore.js (via createSessionStore(storage))
sessionStore.addEntry(entry)    → { count: number, shouldNotify: boolean }
sessionStore.getCount()         → number
sessionStore.getEntries()       → entry[]
sessionStore.getSummary()       → { total, bySexe: {}, byTrancheAge: {}, byDepartement: {} }
sessionStore.reset()            → void

// relayClient.js
submitEntry(entry)              → Promise<{ success: boolean }>
sendRecap({ subject, text, html }) → Promise<{ success: boolean }>

// recapEmail.js
buildRecapEmail(entries, date)  → { subject, text, html }

// speechCapture.js (via createSpeechCapture(Impl))
speechCapture.start()
speechCapture.stop()
speechCapture.onTranscript(handler)  // setter
speechCapture.onError(handler)       // setter

// notify.js
createNotifier(NotificationImpl, onFallback) → { notify(message) }
requestNotificationPermission(NotificationImpl) → Promise<void>
```

---

### Task 1: Installer jsdom pour les tests UI

**Files:**
- Modify: `pwa/package.json`

- [ ] **Step 1: Installer jsdom**

Run (from `pwa/`):

```bash
npm install --save-dev jsdom
```

- [ ] **Step 2: Vérifier que les tests existants passent encore**

Run: `npm test`
Expected: PASS — 69/69 tests verts. jsdom s'installe comme dev dependency mais ne change rien aux tests existants (qui tournent dans l'environnement `node` par défaut).

- [ ] **Step 3: Commit**

```bash
git add pwa/package.json pwa/package-lock.json
git commit -m "chore(pwa): installer jsdom pour les tests UI des écrans"
```

---

### Task 2: dicteeScreen — état repos et état enregistrement

**Files:**
- Create: `pwa/src/ui/dicteeScreen.js` (états idle + recording uniquement)
- Create: `pwa/test/ui/dicteeScreen.test.js`

**Contexte :** Le `createDicteeScreen` crée le composant et enregistre immédiatement les handlers `onTranscript` et `onError` sur `speechCapture` (ils restent en place pour toute la durée de vie du composant). `show()` rend l'état repos et réinitialise si le composant était en cours.

- [ ] **Step 1: Write the failing tests**

Create `pwa/test/ui/dicteeScreen.test.js`:

```javascript
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createDicteeScreen } from '../../src/ui/dicteeScreen.js'

function makeContainer() {
  const div = document.createElement('div')
  document.body.appendChild(div)
  return div
}

function createFakeSpeechCapture() {
  let transcriptHandler = null
  let errorHandler = null
  return {
    start: vi.fn(),
    stop: vi.fn(),
    onTranscript: (h) => { transcriptHandler = h },
    onError: (h) => { errorHandler = h },
    _fireTranscript: (text) => transcriptHandler?.(text),
    _fireError: (error) => errorHandler?.(error),
  }
}

function makeDeps(overrides = {}) {
  return {
    speechCapture: createFakeSpeechCapture(),
    parsePhrase: vi.fn(),
    buildEntries: vi.fn().mockReturnValue([]),
    submitEntry: vi.fn(),
    sessionStore: {
      addEntry: vi.fn().mockReturnValue({ count: 1, shouldNotify: false }),
      getCount: vi.fn().mockReturnValue(0),
      getEntries: vi.fn().mockReturnValue([]),
      reset: vi.fn(),
    },
    notifier: { notify: vi.fn() },
    ...overrides,
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('createDicteeScreen — repos', () => {
  it('affiche le compteur de session et le bouton micro au repos', () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.sessionStore.getCount.mockReturnValue(5)

    createDicteeScreen(container, deps).show()

    expect(container.querySelector('.session-counter').textContent).toBe('5 fiches enregistrées')
    expect(container.querySelector('#mic-btn').textContent).toBe('🎤 Appuyer pour dicter')
  })
})

describe('createDicteeScreen — enregistrement', () => {
  it('démarre speechCapture et change le texte du bouton quand on clique sur le micro', () => {
    const container = makeContainer()
    const deps = makeDeps()

    createDicteeScreen(container, deps).show()
    container.querySelector('#mic-btn').click()

    expect(deps.speechCapture.start).toHaveBeenCalledTimes(1)
    expect(container.querySelector('#mic-btn').textContent).toBe('⏹ Appuyer pour arrêter')
  })

  it('arrête speechCapture et affiche le message d\'analyse quand on reclique', () => {
    const container = makeContainer()
    const deps = makeDeps()

    createDicteeScreen(container, deps).show()
    container.querySelector('#mic-btn').click()
    container.querySelector('#mic-btn').click()

    expect(deps.speechCapture.stop).toHaveBeenCalledTimes(1)
    expect(container.querySelector('#processing-msg')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `pwa/`): `npx vitest run test/ui/dicteeScreen.test.js`
Expected: FAIL — `Cannot find module '../../src/ui/dicteeScreen.js'`

- [ ] **Step 3: Implement idle + recording states**

Create `pwa/src/ui/dicteeScreen.js`:

```javascript
export function createDicteeScreen(container, { speechCapture, parsePhrase, buildEntries, submitEntry, sessionStore, notifier }) {
  let state = 'idle'

  speechCapture.onTranscript(handleTranscript)
  speechCapture.onError(handleSpeechError)

  function renderIdle() {
    state = 'idle'
    const count = sessionStore.getCount()
    container.innerHTML = `
      <div class="session-counter">${count} fiches enregistrées</div>
      <button id="mic-btn">🎤 Appuyer pour dicter</button>
    `
    container.querySelector('#mic-btn').addEventListener('click', startRecording)
  }

  function startRecording() {
    state = 'recording'
    const count = sessionStore.getCount()
    container.innerHTML = `
      <div class="session-counter">${count} fiches enregistrées</div>
      <button id="mic-btn">⏹ Appuyer pour arrêter</button>
    `
    container.querySelector('#mic-btn').addEventListener('click', stopRecording)
    speechCapture.start()
  }

  function stopRecording() {
    state = 'processing'
    container.innerHTML = `<div id="processing-msg">Analyse en cours...</div>`
    speechCapture.stop()
  }

  function handleSpeechError(error) {
    if (state !== 'recording') return
    renderError(`Erreur de reconnaissance vocale : ${error} — Peux-tu redicter ?`)
  }

  function handleTranscript(transcript) {
    if (state !== 'processing') return
    const parsed = parsePhrase(transcript)
    if (!parsed.ok) {
      const fieldLabels = {
        date: 'la date',
        count: 'le nombre de personnes',
        sexe: 'le sexe',
        trancheAge: "la tranche d'âge",
        departement: 'le département',
      }
      const missing = parsed.missingFields.map((f) => fieldLabels[f] || f).join(', ')
      renderError(`Je n'ai pas compris ${missing} — peux-tu redicter ?`)
    } else {
      renderReview(parsed)
    }
  }

  function renderError(message) {
    state = 'error'
    container.innerHTML = `
      <div class="error-msg">${message}</div>
      <button id="retry-btn">Redicter</button>
    `
    container.querySelector('#retry-btn').addEventListener('click', renderIdle)
  }

  function renderReview(parsed) {
    state = 'review'
    const SEXE_OPTIONS = ['Féminin', 'Masculin']
    const TRANCHE_OPTIONS = ['6 - 10 ans', '11 - 15 ans', '16 - 18 ans', '19 - 25 ans', '+25 ans']
    const opt = (value, selected) => `<option value="${value}"${value === selected ? ' selected' : ''}>${value}</option>`

    container.innerHTML = `
      <div class="review-form">
        <p class="review-summary">${parsed.count} ${parsed.sexe === 'Féminin' ? 'fille(s)' : 'garçon(s)'}, ${parsed.trancheAge}, dépt ${parsed.departement}, le ${parsed.date}</p>
        <label>Date : <input id="f-date" type="text" value="${parsed.date}" /></label>
        <label>Sexe : <select id="f-sexe">${SEXE_OPTIONS.map((v) => opt(v, parsed.sexe)).join('')}</select></label>
        <label>Tranche d'âge : <select id="f-tranche">${TRANCHE_OPTIONS.map((v) => opt(v, parsed.trancheAge)).join('')}</select></label>
        <label>Département : <input id="f-dept" type="text" value="${parsed.departement}" /></label>
        <label>Nombre : <input id="f-count" type="number" min="1" value="${parsed.count}" /></label>
        <button id="validate-btn">Valider</button>
        <button id="retry-btn">Redicter depuis le début</button>
      </div>
    `
    container.querySelector('#validate-btn').addEventListener('click', () => {
      const formParsed = {
        date: container.querySelector('#f-date').value,
        sexe: container.querySelector('#f-sexe').value,
        trancheAge: container.querySelector('#f-tranche').value,
        departement: container.querySelector('#f-dept').value,
        count: parseInt(container.querySelector('#f-count').value, 10),
      }
      startSending(formParsed)
    })
    container.querySelector('#retry-btn').addEventListener('click', renderIdle)
  }

  async function startSending(parsedForm) {
    state = 'sending'
    const entries = buildEntries(parsedForm)
    const N = entries.length
    const statuses = Array.from({ length: N }, () => null)

    function renderProgress() {
      container.innerHTML = `
        <div class="sending-progress">
          ${statuses
            .map(
              (s, i) => `
            <div class="entry-row">
              Fiche ${i + 1}/${N} ${s === null ? '⏳' : s.success ? '✓' : '✗'}
              ${s !== null && !s.success ? `<button class="retry-entry-btn" data-index="${i}">Relancer</button>` : ''}
            </div>`
            )
            .join('')}
          ${statuses.every((s) => s !== null) ? `<button id="back-btn">Retour à l'accueil</button>` : ''}
        </div>
      `
      statuses.forEach((s, i) => {
        if (s !== null && !s.success) {
          container.querySelector(`.retry-entry-btn[data-index="${i}"]`)?.addEventListener('click', () => retryEntry(i))
        }
      })
      container.querySelector('#back-btn')?.addEventListener('click', renderIdle)
    }

    async function retryEntry(index) {
      statuses[index] = null
      renderProgress()
      const result = await submitEntry(entries[index])
      statuses[index] = result
      if (result.success) {
        const { count, shouldNotify } = sessionStore.addEntry(entries[index])
        if (shouldNotify) notifier.notify(`${count} fiches enregistrées`)
      }
      renderProgress()
    }

    for (let i = 0; i < N; i++) {
      renderProgress()
      const result = await submitEntry(entries[i])
      statuses[i] = result
      if (result.success) {
        const { count, shouldNotify } = sessionStore.addEntry(entries[i])
        if (shouldNotify) notifier.notify(`${count} fiches enregistrées`)
      }
    }
    renderProgress()
  }

  return { show: renderIdle }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/ui/dicteeScreen.test.js`
Expected: PASS — 3 tests verts.

- [ ] **Step 5: Commit**

```bash
git add pwa/src/ui/dicteeScreen.js pwa/test/ui/dicteeScreen.test.js
git commit -m "feat(pwa): ajouter l'écran Dictée — états repos et enregistrement"
```

---

### Task 3: dicteeScreen — états erreur (vocale et analyse)

**Files:**
- Modify: `pwa/test/ui/dicteeScreen.test.js` (ajouter 3 tests)

Note : `dicteeScreen.js` est déjà complet — `renderError`, `handleSpeechError`, et `handleTranscript` sont déjà implémentés depuis la tâche précédente. Cette tâche ajoute uniquement les tests qui couvrent ces états.

- [ ] **Step 1: Write the failing tests**

APPEND these two `describe` blocks at the end of `pwa/test/ui/dicteeScreen.test.js`:

```javascript
describe('createDicteeScreen — erreur de reconnaissance vocale', () => {
  it('affiche un message d\'erreur et le bouton "Redicter" en cas d\'erreur vocale', () => {
    const container = makeContainer()
    const deps = makeDeps()

    createDicteeScreen(container, deps).show()
    container.querySelector('#mic-btn').click()
    deps.speechCapture._fireError('no-speech')

    expect(container.querySelector('.error-msg').textContent).toContain('Erreur de reconnaissance vocale')
    expect(container.querySelector('#retry-btn')).not.toBeNull()
  })

  it('retourne à l\'écran repos en cliquant sur "Redicter"', () => {
    const container = makeContainer()
    const deps = makeDeps()

    createDicteeScreen(container, deps).show()
    container.querySelector('#mic-btn').click()
    deps.speechCapture._fireError('no-speech')
    container.querySelector('#retry-btn').click()

    expect(container.querySelector('#mic-btn').textContent).toBe('🎤 Appuyer pour dicter')
  })
})

describe('createDicteeScreen — erreur d\'analyse (parsePhrase)', () => {
  it('affiche les champs manquants quand parsePhrase retourne ok=false', () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.parsePhrase.mockReturnValue({ ok: false, missingFields: ['date', 'trancheAge'] })

    createDicteeScreen(container, deps).show()
    container.querySelector('#mic-btn').click()
    container.querySelector('#mic-btn').click()
    deps.speechCapture._fireTranscript('deux filles département soixante-neuf')

    expect(container.querySelector('.error-msg').textContent).toContain('la date')
    expect(container.querySelector('.error-msg').textContent).toContain("la tranche d'âge")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/ui/dicteeScreen.test.js`
Expected: FAIL — les 3 nouveaux tests échouent (erreur vocale seulement ignorée si state !== 'recording', et parsePhrase non appelée).

Actually, since the implementation is already there from Task 2, let's check — these tests should actually PASS because `handleSpeechError` and `handleTranscript` are already implemented. Run the tests to verify.

Run: `npx vitest run test/ui/dicteeScreen.test.js`
Expected: PASS — 6/6 tests verts.

- [ ] **Step 3: Commit**

```bash
git add pwa/test/ui/dicteeScreen.test.js
git commit -m "test(pwa): couvrir les états erreur de l'écran Dictée (vocale + analyse)"
```

---

### Task 4: dicteeScreen — état revue/confirmation

**Files:**
- Modify: `pwa/test/ui/dicteeScreen.test.js` (ajouter 4 tests)

Note : `renderReview` est déjà implémentée dans `dicteeScreen.js`. Cette tâche ajoute les tests qui couvrent l'état de revue.

- [ ] **Step 1: Write the failing tests**

APPEND this `describe` block at the end of `pwa/test/ui/dicteeScreen.test.js`:

```javascript
describe('createDicteeScreen — revue/confirmation', () => {
  const PARSED_OK = {
    ok: true,
    date: '2026-06-08',
    count: 3,
    sexe: 'Féminin',
    trancheAge: '6 - 10 ans',
    departement: '69',
  }

  function navigateToReview(container, deps) {
    deps.parsePhrase.mockReturnValue(PARSED_OK)
    createDicteeScreen(container, deps).show()
    container.querySelector('#mic-btn').click()
    container.querySelector('#mic-btn').click()
    deps.speechCapture._fireTranscript('test')
  }

  it('affiche les champs pré-remplis avec les valeurs extraites', () => {
    const container = makeContainer()
    const deps = makeDeps()
    navigateToReview(container, deps)

    expect(container.querySelector('#f-date').value).toBe('2026-06-08')
    expect(container.querySelector('#f-sexe').value).toBe('Féminin')
    expect(container.querySelector('#f-tranche').value).toBe('6 - 10 ans')
    expect(container.querySelector('#f-dept').value).toBe('69')
    expect(container.querySelector('#f-count').value).toBe('3')
  })

  it('affiche les boutons "Valider" et "Redicter depuis le début"', () => {
    const container = makeContainer()
    const deps = makeDeps()
    navigateToReview(container, deps)

    expect(container.querySelector('#validate-btn')).not.toBeNull()
    expect(container.querySelector('#retry-btn')).not.toBeNull()
  })

  it('le select tranche d\'âge propose les 5 tranches dans le bon ordre', () => {
    const container = makeContainer()
    const deps = makeDeps()
    navigateToReview(container, deps)

    const options = [...container.querySelectorAll('#f-tranche option')].map((o) => o.value)
    expect(options).toEqual(['6 - 10 ans', '11 - 15 ans', '16 - 18 ans', '19 - 25 ans', '+25 ans'])
  })

  it('retourne à l\'écran repos en cliquant sur "Redicter depuis le début"', () => {
    const container = makeContainer()
    const deps = makeDeps()
    navigateToReview(container, deps)
    container.querySelector('#retry-btn').click()

    expect(container.querySelector('#mic-btn').textContent).toBe('🎤 Appuyer pour dicter')
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run test/ui/dicteeScreen.test.js`
Expected: PASS — 10/10 tests verts (tous les états couverts jusqu'ici).

- [ ] **Step 3: Commit**

```bash
git add pwa/test/ui/dicteeScreen.test.js
git commit -m "test(pwa): couvrir l'état revue/confirmation de l'écran Dictée"
```

---

### Task 5: dicteeScreen — état envoi (progression, retry, notifications)

**Files:**
- Modify: `pwa/test/ui/dicteeScreen.test.js` (ajouter 5 tests async)

Note : `startSending`, `retryEntry`, et `renderProgress` sont déjà implémentées dans `dicteeScreen.js`. Cette tâche ajoute les tests qui couvrent l'état d'envoi (qui requiert `async/await` + `vi.waitFor`).

- [ ] **Step 1: Write the failing tests**

APPEND this `describe` block at the end of `pwa/test/ui/dicteeScreen.test.js`:

```javascript
describe('createDicteeScreen — envoi', () => {
  const PARSED_OK = {
    ok: true,
    date: '2026-06-08',
    count: 2,
    sexe: 'Féminin',
    trancheAge: '6 - 10 ans',
    departement: '69',
  }
  const ENTRIES = [
    { date: '2026-06-08', sexe: 'Féminin', trancheAge: '6 - 10 ans', departement: '69' },
    { date: '2026-06-08', sexe: 'Féminin', trancheAge: '6 - 10 ans', departement: '69' },
  ]

  function navigateToReview(container, deps) {
    deps.parsePhrase.mockReturnValue(PARSED_OK)
    deps.buildEntries.mockReturnValue(ENTRIES)
    createDicteeScreen(container, deps).show()
    container.querySelector('#mic-btn').click()
    container.querySelector('#mic-btn').click()
    deps.speechCapture._fireTranscript('test')
  }

  it('affiche le bouton "Retour à l\'accueil" une fois toutes les fiches envoyées avec succès', async () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.submitEntry = vi.fn().mockResolvedValue({ success: true })
    navigateToReview(container, deps)

    container.querySelector('#validate-btn').click()

    await vi.waitFor(() => expect(container.querySelector('#back-btn')).not.toBeNull())

    expect(deps.submitEntry).toHaveBeenCalledTimes(2)
    expect(deps.sessionStore.addEntry).toHaveBeenCalledTimes(2)
  })

  it('affiche le bouton "Relancer" pour les fiches échouées', async () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.submitEntry = vi.fn().mockResolvedValue({ success: false, error: 'network_error' })
    navigateToReview(container, deps)

    container.querySelector('#validate-btn').click()

    await vi.waitFor(() => expect(container.querySelector('.retry-entry-btn')).not.toBeNull())

    expect(container.querySelector('.retry-entry-btn')).not.toBeNull()
    expect(container.querySelector('#back-btn')).not.toBeNull()
    expect(deps.sessionStore.addEntry).not.toHaveBeenCalled()
  })

  it('relance une fiche échouée et la marque comme réussie', async () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.submitEntry = vi.fn()
      .mockResolvedValueOnce({ success: false, error: 'network_error' })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValue({ success: true })
    navigateToReview(container, deps)

    container.querySelector('#validate-btn').click()
    await vi.waitFor(() => expect(container.querySelector('.retry-entry-btn')).not.toBeNull())

    container.querySelector('.retry-entry-btn').click()
    await vi.waitFor(() => expect(container.querySelector('.retry-entry-btn')).toBeNull())

    expect(deps.sessionStore.addEntry).toHaveBeenCalledTimes(3)
  })

  it('déclenche la notification quand addEntry retourne shouldNotify=true', async () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.submitEntry = vi.fn().mockResolvedValue({ success: true })
    deps.sessionStore.addEntry = vi.fn().mockReturnValue({ count: 10, shouldNotify: true })
    navigateToReview(container, deps)

    container.querySelector('#validate-btn').click()
    await vi.waitFor(() => expect(container.querySelector('#back-btn')).not.toBeNull())

    expect(deps.notifier.notify).toHaveBeenCalledWith('10 fiches enregistrées')
  })

  it('retourne à l\'écran repos en cliquant sur "Retour à l\'accueil"', async () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.submitEntry = vi.fn().mockResolvedValue({ success: true })
    navigateToReview(container, deps)

    container.querySelector('#validate-btn').click()
    await vi.waitFor(() => expect(container.querySelector('#back-btn')).not.toBeNull())
    container.querySelector('#back-btn').click()

    expect(container.querySelector('#mic-btn').textContent).toBe('🎤 Appuyer pour dicter')
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run test/ui/dicteeScreen.test.js`
Expected: PASS — 15/15 tests verts. Les tests async utilisent `vi.waitFor` pour attendre que les `submitEntry` mockés (résolus immédiatement) terminent le cycle async.

- [ ] **Step 3: Run the full PWA test suite**

Run (from `pwa/`): `npm test`
Expected: PASS — tous les fichiers de test verts.

- [ ] **Step 4: Commit**

```bash
git add pwa/test/ui/dicteeScreen.test.js
git commit -m "test(pwa): couvrir l'état envoi de l'écran Dictée (progression, retry, notifications)"
```

---

### Task 6: historiqueScreen — affichage résumé et terminer la session

**Files:**
- Create: `pwa/src/ui/historiqueScreen.js`
- Create: `pwa/test/ui/historiqueScreen.test.js`

- [ ] **Step 1: Write the failing tests**

Create `pwa/test/ui/historiqueScreen.test.js`:

```javascript
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHistoriqueScreen } from '../../src/ui/historiqueScreen.js'

function makeContainer() {
  const div = document.createElement('div')
  document.body.appendChild(div)
  return div
}

function makeDeps(overrides = {}) {
  return {
    sessionStore: {
      getSummary: vi.fn().mockReturnValue({
        total: 4,
        bySexe: { Féminin: 3, Masculin: 1 },
        byTrancheAge: { '6 - 10 ans': 4 },
        byDepartement: { '69': 4 },
      }),
      getEntries: vi.fn().mockReturnValue([]),
      reset: vi.fn(),
    },
    buildRecapEmail: vi.fn().mockReturnValue({
      subject: 'Récapitulatif RAO 8 juin 2026',
      text: 'Total : 4',
      html: '<table></table>',
    }),
    sendRecap: vi.fn().mockResolvedValue({ success: true }),
    onSessionTerminated: vi.fn(),
    getDate: vi.fn().mockReturnValue('8 juin 2026'),
    ...overrides,
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('createHistoriqueScreen — affichage', () => {
  it('affiche le total de la session', () => {
    const container = makeContainer()
    createHistoriqueScreen(container, makeDeps()).show()

    expect(container.querySelector('.histo-total').textContent).toBe('4 fiches enregistrées durant cette session')
  })

  it('affiche la répartition par sexe', () => {
    const container = makeContainer()
    createHistoriqueScreen(container, makeDeps()).show()

    const text = container.querySelector('.histo-bySexe').textContent
    expect(text).toContain('Féminin : 3')
    expect(text).toContain('Masculin : 1')
  })

  it('affiche la répartition par tranche d\'âge', () => {
    const container = makeContainer()
    createHistoriqueScreen(container, makeDeps()).show()

    expect(container.querySelector('.histo-byAge').textContent).toContain('6 - 10 ans : 4')
  })

  it('affiche la répartition par département', () => {
    const container = makeContainer()
    createHistoriqueScreen(container, makeDeps()).show()

    expect(container.querySelector('.histo-byDept').textContent).toContain('69 : 4')
  })

  it('désactive le bouton "Terminer la session" quand il n\'y a aucune fiche', () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.sessionStore.getSummary.mockReturnValue({ total: 0, bySexe: {}, byTrancheAge: {}, byDepartement: {} })

    createHistoriqueScreen(container, deps).show()

    expect(container.querySelector('#terminer-btn').disabled).toBe(true)
  })

  it('active le bouton "Terminer la session" quand il y a des fiches', () => {
    const container = makeContainer()
    createHistoriqueScreen(container, makeDeps()).show()

    expect(container.querySelector('#terminer-btn').disabled).toBe(false)
  })
})

describe('createHistoriqueScreen — terminer la session', () => {
  it('appelle buildRecapEmail puis sendRecap avec les bons arguments', async () => {
    const container = makeContainer()
    const deps = makeDeps()

    createHistoriqueScreen(container, deps).show()
    container.querySelector('#terminer-btn').click()

    await vi.waitFor(() => expect(deps.sendRecap).toHaveBeenCalled())

    expect(deps.buildRecapEmail).toHaveBeenCalledWith([], '8 juin 2026')
    expect(deps.sendRecap).toHaveBeenCalledWith({
      subject: 'Récapitulatif RAO 8 juin 2026',
      text: 'Total : 4',
      html: '<table></table>',
    })
  })

  it('appelle reset + onSessionTerminated en cas de succès', async () => {
    const container = makeContainer()
    const deps = makeDeps()

    createHistoriqueScreen(container, deps).show()
    container.querySelector('#terminer-btn').click()

    await vi.waitFor(() => expect(deps.onSessionTerminated).toHaveBeenCalled())

    expect(deps.sessionStore.reset).toHaveBeenCalled()
    expect(deps.onSessionTerminated).toHaveBeenCalled()
  })

  it('affiche une erreur et le bouton "Réessayer" en cas d\'échec', async () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.sendRecap = vi.fn().mockResolvedValue({ success: false })

    createHistoriqueScreen(container, deps).show()
    container.querySelector('#terminer-btn').click()

    await vi.waitFor(() => expect(container.querySelector('.recap-error')).not.toBeNull())

    expect(container.querySelector('.recap-error').textContent).toContain('échoué')
    expect(container.querySelector('#retry-recap-btn')).not.toBeNull()
    expect(deps.sessionStore.reset).not.toHaveBeenCalled()
    expect(deps.onSessionTerminated).not.toHaveBeenCalled()
  })

  it('relance l\'envoi depuis le bouton "Réessayer l\'envoi"', async () => {
    const container = makeContainer()
    const deps = makeDeps()
    deps.sendRecap = vi.fn()
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: true })

    createHistoriqueScreen(container, deps).show()
    container.querySelector('#terminer-btn').click()

    await vi.waitFor(() => expect(container.querySelector('#retry-recap-btn')).not.toBeNull())
    container.querySelector('#retry-recap-btn').click()

    await vi.waitFor(() => expect(deps.onSessionTerminated).toHaveBeenCalled())

    expect(deps.sendRecap).toHaveBeenCalledTimes(2)
    expect(deps.sessionStore.reset).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `pwa/`): `npx vitest run test/ui/historiqueScreen.test.js`
Expected: FAIL — `Cannot find module '../../src/ui/historiqueScreen.js'`

- [ ] **Step 3: Implement `createHistoriqueScreen`**

Create `pwa/src/ui/historiqueScreen.js`:

```javascript
export function createHistoriqueScreen(container, { sessionStore, buildRecapEmail, sendRecap, onSessionTerminated, getDate }) {
  function formatMap(obj) {
    const entries = Object.entries(obj)
    if (entries.length === 0) return '—'
    return entries.map(([k, v]) => `${k} : ${v}`).join(' · ')
  }

  function renderDefault() {
    const { total, bySexe, byTrancheAge, byDepartement } = sessionStore.getSummary()
    container.innerHTML = `
      <div class="histo-content">
        <p class="histo-total">${total} fiches enregistrées durant cette session</p>
        <p class="histo-bySexe">${formatMap(bySexe)}</p>
        <p class="histo-byAge">${formatMap(byTrancheAge)}</p>
        <p class="histo-byDept">${formatMap(byDepartement)}</p>
        <button id="terminer-btn" ${total === 0 ? 'disabled' : ''}>Terminer la session</button>
      </div>
    `
    if (total > 0) {
      container.querySelector('#terminer-btn').addEventListener('click', terminerSession)
    }
  }

  async function terminerSession() {
    container.innerHTML = `<div id="recap-sending">Envoi du récapitulatif en cours...</div>`

    const entries = sessionStore.getEntries()
    const date = getDate()
    const { subject, text, html } = buildRecapEmail(entries, date)
    const result = await sendRecap({ subject, text, html })

    if (result.success) {
      sessionStore.reset()
      onSessionTerminated()
    } else {
      container.innerHTML = `
        <div class="recap-error">L'envoi du récapitulatif a échoué.</div>
        <button id="retry-recap-btn">Réessayer l'envoi</button>
        <button id="back-histo-btn">Retour</button>
      `
      container.querySelector('#retry-recap-btn').addEventListener('click', terminerSession)
      container.querySelector('#back-histo-btn').addEventListener('click', renderDefault)
    }
  }

  return { show: renderDefault }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/ui/historiqueScreen.test.js`
Expected: PASS — 10/10 tests verts.

- [ ] **Step 5: Run the full PWA test suite**

Run: `npm test`
Expected: PASS — tous les fichiers verts.

- [ ] **Step 6: Commit**

```bash
git add pwa/src/ui/historiqueScreen.js pwa/test/ui/historiqueScreen.test.js
git commit -m "feat(pwa): ajouter l'écran Historique (résumé de session + terminer avec envoi récapitulatif)"
```

---

### Task 7: index.html + manifest.json + service-worker.js

**Files:**
- Create: `pwa/index.html`
- Create: `pwa/public/manifest.json`
- Create: `pwa/public/service-worker.js`

Note : ces fichiers ne sont pas unit-testés (assets statiques + service worker). La vérification est manuelle (ouvrir dans un navigateur). Le `public/` est le dossier servi à la racine `/`.

- [ ] **Step 1: Create `pwa/index.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#1f4e79" />
  <title>RAO — Saisie vocale</title>
  <link rel="manifest" href="public/manifest.json" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 16px; }
    nav { display: flex; gap: 8px; margin-bottom: 16px; }
    .tab { flex: 1; padding: 12px; border: none; background: #eee; border-radius: 4px; cursor: pointer; font-size: 1rem; }
    .tab.active { background: #1f4e79; color: #fff; }
    .session-counter { font-size: 1.1rem; margin-bottom: 16px; color: #555; }
    #mic-btn { width: 100%; padding: 24px; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; background: #e8f0fe; }
    button { padding: 12px 16px; border: none; border-radius: 4px; cursor: pointer; margin-top: 8px; }
    #validate-btn { background: #1f4e79; color: #fff; width: 100%; }
    #retry-btn, #back-btn, #back-histo-btn { background: #eee; width: 100%; }
    .error-msg { background: #fce4e4; padding: 12px; border-radius: 4px; margin-bottom: 12px; }
    .review-form label { display: block; margin-bottom: 8px; }
    .review-form input, .review-form select { width: 100%; padding: 8px; margin-top: 4px; border: 1px solid #ccc; border-radius: 4px; }
    .entry-row { padding: 8px 0; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 8px; }
    .retry-entry-btn { background: #fff3cd; flex-shrink: 0; }
    #back-btn { background: #1f4e79; color: #fff; width: 100%; margin-top: 16px; }
    .histo-total { font-size: 1.2rem; font-weight: bold; margin-bottom: 12px; }
    .histo-bySexe, .histo-byAge, .histo-byDept { margin-bottom: 8px; color: #444; }
    #terminer-btn { background: #1f4e79; color: #fff; width: 100%; margin-top: 16px; padding: 14px; font-size: 1rem; }
    #terminer-btn:disabled { background: #aaa; cursor: not-allowed; }
    .recap-error { background: #fce4e4; padding: 12px; border-radius: 4px; margin-bottom: 12px; }
    #retry-recap-btn { background: #1f4e79; color: #fff; width: 100%; }
    .notification-banner {
      position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
      background: #1f4e79; color: #fff; padding: 12px 24px; border-radius: 8px; z-index: 9999;
      font-family: Arial, sans-serif;
    }
    #processing-msg { padding: 24px; text-align: center; color: #555; }
  </style>
</head>
<body>
  <nav>
    <button id="tab-dictee" class="tab active">Dictée</button>
    <button id="tab-historique" class="tab">Historique</button>
  </nav>
  <div id="screen-dictee"></div>
  <div id="screen-historique" hidden></div>
  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `pwa/public/manifest.json`**

```json
{
  "name": "RAO — Saisie vocale",
  "short_name": "RAO",
  "description": "Application de saisie vocale pour les journées Prox de RAO",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1f4e79",
  "lang": "fr",
  "icons": [
    {
      "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎤</text></svg>",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 3: Create `pwa/public/service-worker.js`**

```javascript
const CACHE_NAME = 'rao-v1'
const SHELL = [
  '/',
  '/index.html',
  '/app.js',
  '/src/speechCapture.js',
  '/src/notify.js',
  '/src/recapEmail.js',
  '/src/phraseParser.js',
  '/src/numberWords.js',
  '/src/sessionStore.js',
  '/src/relayClient.js',
  '/src/ui/dicteeScreen.js',
  '/src/ui/historiqueScreen.js',
  '/public/manifest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  )
})
```

- [ ] **Step 4: Run tests to confirm no regression**

Run (from `pwa/`): `npm test`
Expected: PASS — tous les tests verts. Les nouveaux fichiers statiques ne touchent pas au code testé.

- [ ] **Step 5: Commit**

```bash
git add pwa/index.html pwa/public/manifest.json pwa/public/service-worker.js
git commit -m "feat(pwa): ajouter index.html, manifeste PWA et service worker de base"
```

---

### Task 8: app.js — câblage final

**Files:**
- Create: `pwa/app.js`

Note : `app.js` est le seul module qui touche `window`, `localStorage`, et les APIs navigateur réelles. Il n'est pas unit-testé — sa vérification passe par l'ouverture de `index.html` dans un navigateur. Cette tâche câble les modules purs entre eux.

- [ ] **Step 1: Create `pwa/app.js`**

```javascript
import { createSpeechCapture } from './src/speechCapture.js'
import { createSessionStore } from './src/sessionStore.js'
import { createNotifier, requestNotificationPermission } from './src/notify.js'
import { parsePhrase, buildEntries } from './src/phraseParser.js'
import { submitEntry, sendRecap } from './src/relayClient.js'
import { buildRecapEmail } from './src/recapEmail.js'
import { createDicteeScreen } from './src/ui/dicteeScreen.js'
import { createHistoriqueScreen } from './src/ui/historiqueScreen.js'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/public/service-worker.js')
}

const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition
const sessionStore = createSessionStore(localStorage)
const speechCapture = createSpeechCapture(SpeechRecognitionImpl)

const notifier = createNotifier(window.Notification, (message) => {
  const banner = document.createElement('div')
  banner.className = 'notification-banner'
  banner.textContent = message
  document.body.appendChild(banner)
  setTimeout(() => banner.remove(), 4000)
})

await requestNotificationPermission(window.Notification)

function getDate() {
  return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

const containerDictee = document.getElementById('screen-dictee')
const containerHistorique = document.getElementById('screen-historique')
const tabDictee = document.getElementById('tab-dictee')
const tabHistorique = document.getElementById('tab-historique')

const dicteeScreen = createDicteeScreen(containerDictee, {
  speechCapture,
  parsePhrase,
  buildEntries,
  submitEntry,
  sessionStore,
  notifier,
})

const historiqueScreen = createHistoriqueScreen(containerHistorique, {
  sessionStore,
  buildRecapEmail,
  sendRecap,
  getDate,
  onSessionTerminated: () => switchTab('dictee'),
})

function switchTab(name) {
  if (name === 'dictee') {
    containerDictee.hidden = false
    containerHistorique.hidden = true
    tabDictee.classList.add('active')
    tabHistorique.classList.remove('active')
    dicteeScreen.show()
  } else {
    containerDictee.hidden = true
    containerHistorique.hidden = false
    tabDictee.classList.remove('active')
    tabHistorique.classList.add('active')
    historiqueScreen.show()
  }
}

tabDictee.addEventListener('click', () => switchTab('dictee'))
tabHistorique.addEventListener('click', () => switchTab('historique'))

switchTab('dictee')
```

- [ ] **Step 2: Run the full test suite one last time**

Run (from `pwa/`): `npm test`
Expected: PASS — tous les tests verts. `app.js` n'est pas importé par les tests, donc son existence ne change rien.

- [ ] **Step 3: Commit**

```bash
git add pwa/app.js
git commit -m "feat(pwa): câbler app.js — sessionStore, speechCapture, notifier, écrans Dictée et Historique"
```

---

## Out of scope reminders

- Déploiement sur GitHub Pages (réglage du `start_url`, HTTPS, icônes définitives) — hors de ce plan
- Vérification finale limitée et concertée (1-3 soumissions réelles avec données identifiables, client prévenu) — décrite dans la spec générale section 7, à faire après déploiement
- Tests d'intégration de `app.js` dans un vrai navigateur (Playwright, etc.) — hors de ce plan
