# PWA RAO — Logique métier (Plan 2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and fully unit-test the pure business logic of the RAO PWA: conversion of French number-words to digits, parsing of a dictated phrase into one or more form entries, session counter/persistence with notification triggers, and an HTTP client wrapping the relay's `/submit-entry` and `/send-recap` endpoints.

**Architecture:** A new `pwa/` directory mirrors the existing `relay/` project's conventions (ES modules, Vitest). Four independent, focused modules: `numberWords.js` (word→digit conversion), `phraseParser.js` (phrase analysis + entry generation, built on top of `numberWords.js`), `sessionStore.js` (counter, persistence via an injected storage, summary, notification trigger), and `relayClient.js` (thin `fetch` wrapper around the deployed relay). No UI, no Web Speech API, no network calls to raid-aventure.org — everything is testable in isolation, exactly as required by spec section 7.2 ("Tests automatisés sur la logique métier").

**Tech Stack:** JavaScript ES modules, Vitest (same versions/conventions as `relay/package.json`).

---

## Reference: spec requirements covered by this plan

This plan implements spec sections 4.1 (phrase analysis incl. number-word conversion), 4.3 (session counter + notification every multiple of 10), and 4.5 (local session persistence), plus the relay-calling glue needed for 4.1 (submission) and 4.4 (recap email). It does **not** cover voice capture, the confirmation UI (4.2), the "fin de session" voice command trigger, or PWA packaging — those belong to Plan 2b.

---

## File Structure

- Create: `pwa/package.json` — npm scripts and Vitest dependency, mirrors `relay/package.json`
- Create: `pwa/src/numberWords.js` — `wordToNumber(words)`: converts a French number-word phrase (0-99) to an integer
- Create: `pwa/src/phraseParser.js` — `extractDate`, `extractSexe`, `extractCount`, `extractTrancheAge`, `extractDepartement`, `parsePhrase`, `buildEntries`
- Create: `pwa/src/sessionStore.js` — `createSessionStore(storage)`: counter, persistence, summary, notification trigger
- Create: `pwa/src/relayClient.js` — `submitEntry(entry)`, `sendRecap({ subject, text })`
- Create: `pwa/test/numberWords.test.js`
- Create: `pwa/test/phraseParser.test.js`
- Create: `pwa/test/sessionStore.test.js`
- Create: `pwa/test/relayClient.test.js`

---

### Task 1: Project setup

**Files:**
- Create: `pwa/package.json`

- [ ] **Step 1: Create the package manifest**

```json
{
  "name": "rao-pwa",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^4.1.8"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run (from `pwa/`): `npm install`
Expected: `node_modules/` created, `package-lock.json` written, no errors.

- [ ] **Step 3: Commit**

```bash
git add pwa/package.json pwa/package-lock.json
git commit -m "chore(pwa): initialiser le projet PWA avec Vitest"
```

---

### Task 2: Number words — units, teens, simple tens

**Files:**
- Create: `pwa/src/numberWords.js`
- Test: `pwa/test/numberWords.test.js`

- [ ] **Step 1: Write the failing tests**

Create `pwa/test/numberWords.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { wordToNumber } from '../src/numberWords.js'

describe('wordToNumber — unités, dizaines simples et nombres de 11 à 19', () => {
  it('convertit les unités', () => {
    expect(wordToNumber('zéro')).toBe(0)
    expect(wordToNumber('un')).toBe(1)
    expect(wordToNumber('une')).toBe(1)
    expect(wordToNumber('quatre')).toBe(4)
    expect(wordToNumber('neuf')).toBe(9)
  })

  it('convertit les nombres de 11 à 19', () => {
    expect(wordToNumber('onze')).toBe(11)
    expect(wordToNumber('seize')).toBe(16)
    expect(wordToNumber('dix-sept')).toBe(17)
    expect(wordToNumber('dix-neuf')).toBe(19)
  })

  it('convertit les dizaines rondes', () => {
    expect(wordToNumber('vingt')).toBe(20)
    expect(wordToNumber('trente')).toBe(30)
    expect(wordToNumber('soixante')).toBe(60)
  })

  it('est insensible à la casse, aux espaces et accepte espaces ou tirets', () => {
    expect(wordToNumber('QUATRE')).toBe(4)
    expect(wordToNumber('  dix-sept  ')).toBe(17)
    expect(wordToNumber('dix sept')).toBe(17)
  })

  it('renvoie null pour un mot qui n\'est pas un nombre', () => {
    expect(wordToNumber('bonjour')).toBeNull()
    expect(wordToNumber('')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `pwa/`): `npx vitest run test/numberWords.test.js`
Expected: FAIL — `Cannot find module '../src/numberWords.js'` (or similar resolution error)

- [ ] **Step 3: Implement units, teens and round tens**

Create `pwa/src/numberWords.js`:

```javascript
const UNITS = {
  zéro: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
}

const TEENS = {
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  'dix-sept': 17,
  'dix-huit': 18,
  'dix-neuf': 19,
}

const TENS = {
  vingt: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
}

export function wordToNumber(words) {
  const normalized = words.trim().toLowerCase().replace(/\s+/g, '-')
  if (normalized === '') return null

  if (normalized in UNITS) return UNITS[normalized]
  if (normalized in TEENS) return TEENS[normalized]
  if (normalized in TENS) return TENS[normalized]

  return null
}
```

- [ ] **Step 4: Run tests — first four groups should pass, last group already passes**

Run: `npx vitest run test/numberWords.test.js`
Expected: 4 tests pass (unités, 11-19, dizaines rondes, casse/espaces/tirets, mot inconnu) — all 5 `it` blocks listed above PASS, since none of them yet exercise compound numbers.

- [ ] **Step 5: Commit**

```bash
git add pwa/src/numberWords.js pwa/test/numberWords.test.js
git commit -m "feat(pwa): convertir les nombres français simples (unités, 11-19, dizaines)"
```

---

### Task 3: Number words — compound numbers (21-99)

**Files:**
- Modify: `pwa/src/numberWords.js`
- Modify: `pwa/test/numberWords.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `pwa/test/numberWords.test.js` (inside the existing `describe` block, as new `it`s, or as a new `describe` — add this new `describe` after the existing one):

```javascript
describe('wordToNumber — nombres composés (21 à 99)', () => {
  it('convertit les dizaines + unité avec tiret', () => {
    expect(wordToNumber('vingt-deux')).toBe(22)
    expect(wordToNumber('trente-cinq')).toBe(35)
  })

  it('convertit les dizaines + unité avec "et"', () => {
    expect(wordToNumber('vingt-et-un')).toBe(21)
    expect(wordToNumber('vingt et un')).toBe(21)
  })

  it('convertit soixante-dix à soixante-dix-neuf (60 + nombre de 10 à 19)', () => {
    expect(wordToNumber('soixante-dix')).toBe(70)
    expect(wordToNumber('soixante-et-onze')).toBe(71)
    expect(wordToNumber('soixante-quinze')).toBe(75)
    expect(wordToNumber('soixante-dix-neuf')).toBe(79)
  })

  it('convertit soixante + unité (61 à 69)', () => {
    expect(wordToNumber('soixante-neuf')).toBe(69)
  })

  it('convertit quatre-vingts et ses dérivés (80 à 99)', () => {
    expect(wordToNumber('quatre-vingts')).toBe(80)
    expect(wordToNumber('quatre-vingt')).toBe(80)
    expect(wordToNumber('quatre-vingt-trois')).toBe(83)
    expect(wordToNumber('quatre-vingt-dix')).toBe(90)
    expect(wordToNumber('quatre-vingt-dix-sept')).toBe(97)
  })
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run test/numberWords.test.js`
Expected: FAIL — the 5 new `it` blocks fail because `wordToNumber` returns `null` for compound forms (e.g. `expect(wordToNumber('vingt-deux')).toBe(22)` receives `null`).

- [ ] **Step 3: Implement compound number handling**

In `pwa/src/numberWords.js`, replace the `return null` at the end of `wordToNumber` with the compound-number logic:

```javascript
export function wordToNumber(words) {
  const normalized = words.trim().toLowerCase().replace(/\s+/g, '-')
  if (normalized === '') return null

  if (normalized in UNITS) return UNITS[normalized]
  if (normalized in TEENS) return TEENS[normalized]
  if (normalized in TENS) return TENS[normalized]

  if (normalized === 'quatre-vingts' || normalized === 'quatre-vingt') return 80
  if (normalized === 'soixante-dix') return 70
  if (normalized === 'quatre-vingt-dix') return 90

  const sixtyEightyMatch = normalized.match(/^(soixante|quatre-vingt)-(?:et-)?(.+)$/)
  if (sixtyEightyMatch) {
    const base = sixtyEightyMatch[1] === 'soixante' ? 60 : 80
    const rest = wordToNumber(sixtyEightyMatch[2])
    if (rest !== null && rest >= 1 && rest <= 19) return base + rest
  }

  const tensMatch = normalized.match(/^(vingt|trente|quarante|cinquante)-(?:et-)?(.+)$/)
  if (tensMatch) {
    const base = TENS[tensMatch[1]]
    const rest = wordToNumber(tensMatch[2])
    if (rest !== null && rest >= 1 && rest <= 9) return base + rest
  }

  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/numberWords.test.js`
Expected: PASS — all tests in `pwa/test/numberWords.test.js` green.

- [ ] **Step 5: Commit**

```bash
git add pwa/src/numberWords.js pwa/test/numberWords.test.js
git commit -m "feat(pwa): convertir les nombres français composés (21-99, soixante-dix, quatre-vingts...)"
```

---

### Task 4: Phrase parser — date extraction

**Files:**
- Create: `pwa/src/phraseParser.js`
- Test: `pwa/test/phraseParser.test.js`

- [ ] **Step 1: Write the failing tests**

Create `pwa/test/phraseParser.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { extractDate } from '../src/phraseParser.js'

describe('extractDate', () => {
  it('extrait une date au format "le 8 juin 2026"', () => {
    expect(extractDate('Le 8 juin 2026, quatre filles, entre 6 et 10 ans, département 69')).toBe('2026-06-08')
  })

  it('complète les jours et mois sur un chiffre avec un zéro', () => {
    expect(extractDate('Le 3 mars 2025, deux garçons')).toBe('2025-03-03')
  })

  it('fonctionne sans l\'article "le"', () => {
    expect(extractDate('8 juin 2026, quatre filles')).toBe('2026-06-08')
  })

  it('renvoie null si aucune date n\'est trouvée', () => {
    expect(extractDate('quatre filles, entre 6 et 10 ans, département 69')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `pwa/`): `npx vitest run test/phraseParser.test.js`
Expected: FAIL — `Cannot find module '../src/phraseParser.js'`

- [ ] **Step 3: Implement `extractDate`**

Create `pwa/src/phraseParser.js`:

```javascript
const MONTHS = {
  janvier: 1,
  février: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  août: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  décembre: 12,
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

export function extractDate(phrase) {
  const lower = phrase.toLowerCase()
  const monthNames = Object.keys(MONTHS).join('|')
  const match = lower.match(new RegExp(`(\\d{1,2})\\s+(${monthNames})\\s+(\\d{4})`))
  if (!match) return null

  const day = parseInt(match[1], 10)
  const month = MONTHS[match[2]]
  const year = match[3]

  return `${year}-${pad2(month)}-${pad2(day)}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/phraseParser.test.js`
Expected: PASS — all 4 tests in the `extractDate` describe block green.

- [ ] **Step 5: Commit**

```bash
git add pwa/src/phraseParser.js pwa/test/phraseParser.test.js
git commit -m "feat(pwa): extraire la date dictée d'une phrase (jj mois aaaa -> aaaa-mm-jj)"
```

---

### Task 5: Phrase parser — sexe extraction

**Files:**
- Modify: `pwa/src/phraseParser.js`
- Modify: `pwa/test/phraseParser.test.js`

- [ ] **Step 1: Write the failing tests**

In `pwa/test/phraseParser.test.js`, add `extractSexe` to the import line and append a new `describe` block:

```javascript
import { extractDate, extractSexe } from '../src/phraseParser.js'
```

```javascript
describe('extractSexe', () => {
  it('détecte "filles" comme Féminin', () => {
    expect(extractSexe('quatre filles, entre 6 et 10 ans')).toBe('Féminin')
  })

  it('détecte "garçons" comme Masculin', () => {
    expect(extractSexe('deux garçons, entre 11 et 15 ans')).toBe('Masculin')
  })

  it('détecte "féminin" et "masculin" dictés directement', () => {
    expect(extractSexe('une personne, féminin, 19-25 ans')).toBe('Féminin')
    expect(extractSexe('une personne, masculin, 19-25 ans')).toBe('Masculin')
  })

  it('renvoie null si le sexe n\'est pas détecté', () => {
    expect(extractSexe('quatre personnes, entre 6 et 10 ans')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/phraseParser.test.js`
Expected: FAIL — `extractSexe is not a function` (or `undefined`) for the new tests.

- [ ] **Step 3: Implement `extractSexe`**

Append to `pwa/src/phraseParser.js`:

```javascript
export function extractSexe(phrase) {
  const lower = phrase.toLowerCase()

  if (/\b(filles?|féminin)\b/.test(lower)) return 'Féminin'
  if (/\b(garçons?|masculin)\b/.test(lower)) return 'Masculin'

  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/phraseParser.test.js`
Expected: PASS — all tests green, including the new `extractSexe` block.

- [ ] **Step 5: Commit**

```bash
git add pwa/src/phraseParser.js pwa/test/phraseParser.test.js
git commit -m "feat(pwa): extraire le sexe dicté d'une phrase (filles/garçons/féminin/masculin)"
```

---

### Task 6: Phrase parser — count extraction

**Files:**
- Modify: `pwa/src/phraseParser.js`
- Modify: `pwa/test/phraseParser.test.js`

- [ ] **Step 1: Write the failing tests**

Update the import line:

```javascript
import { extractDate, extractSexe, extractCount } from '../src/phraseParser.js'
```

Append:

```javascript
describe('extractCount', () => {
  it('extrait un nombre énoncé en toutes lettres avant "filles"', () => {
    expect(extractCount('Le 8 juin 2026, quatre filles, entre 6 et 10 ans')).toBe(4)
  })

  it('extrait un nombre énoncé en toutes lettres avant "garçons"', () => {
    expect(extractCount('deux garçons, entre 11 et 15 ans')).toBe(2)
  })

  it('extrait un nombre composé avant "personnes"', () => {
    expect(extractCount('vingt-deux personnes, masculin, 19-25 ans')).toBe(22)
  })

  it('extrait un nombre dicté en chiffres', () => {
    expect(extractCount('3 filles, entre 6 et 10 ans')).toBe(3)
  })

  it('renvoie null si aucun nombre n\'est trouvé avant le mot clé', () => {
    expect(extractCount('des filles, entre 6 et 10 ans')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/phraseParser.test.js`
Expected: FAIL — `extractCount is not a function` for the new tests.

- [ ] **Step 3: Implement `extractCount`**

Append to `pwa/src/phraseParser.js` (it needs `wordToNumber`, so add the import at the top of the file too):

```javascript
import { wordToNumber } from './numberWords.js'
```

```javascript
export function extractCount(phrase) {
  const lower = phrase.toLowerCase()
  const match = lower.match(/([a-zà-öø-ÿ0-9]+(?:-[a-zà-öø-ÿ]+)*)\s+(?:filles?|garçons?|personnes?)/)
  if (!match) return null

  const raw = match[1]
  if (/^\d+$/.test(raw)) return parseInt(raw, 10)

  return wordToNumber(raw)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/phraseParser.test.js`
Expected: PASS — all tests green, including the new `extractCount` block.

- [ ] **Step 5: Commit**

```bash
git add pwa/src/phraseParser.js pwa/test/phraseParser.test.js
git commit -m "feat(pwa): extraire le nombre de personnes dicté d'une phrase"
```

---

### Task 7: Phrase parser — tranche d'âge extraction

**Files:**
- Modify: `pwa/src/phraseParser.js`
- Modify: `pwa/test/phraseParser.test.js`

- [ ] **Step 1: Write the failing tests**

Update the import line:

```javascript
import { extractDate, extractSexe, extractCount, extractTrancheAge } from '../src/phraseParser.js'
```

Append:

```javascript
describe('extractTrancheAge', () => {
  it('reconnaît "entre 6 et 10 ans"', () => {
    expect(extractTrancheAge('quatre filles, entre 6 et 10 ans, département 69')).toBe('6 - 10 ans')
  })

  it('reconnaît "entre 11 et 15 ans"', () => {
    expect(extractTrancheAge('deux garçons, entre 11 et 15 ans')).toBe('11 - 15 ans')
  })

  it('reconnaît "entre 16 et 18 ans"', () => {
    expect(extractTrancheAge('une personne, entre 16 et 18 ans')).toBe('16 - 18 ans')
  })

  it('reconnaît "entre 19 et 25 ans"', () => {
    expect(extractTrancheAge('trois personnes, entre 19 et 25 ans')).toBe('19 - 25 ans')
  })

  it('reconnaît les formulations de "plus de 25 ans"', () => {
    expect(extractTrancheAge('une personne, plus de 25 ans')).toBe('+25 ans')
    expect(extractTrancheAge('une personne, +25 ans')).toBe('+25 ans')
    expect(extractTrancheAge('une personne, 25 ans et plus')).toBe('+25 ans')
  })

  it('renvoie null si aucune tranche d\'âge connue n\'est trouvée', () => {
    expect(extractTrancheAge('quatre filles, département 69')).toBeNull()
    expect(extractTrancheAge('quatre filles, entre 30 et 40 ans')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/phraseParser.test.js`
Expected: FAIL — `extractTrancheAge is not a function` for the new tests.

- [ ] **Step 3: Implement `extractTrancheAge`**

Append to `pwa/src/phraseParser.js`:

```javascript
const TRANCHE_RANGES = [
  { min: 6, max: 10, label: '6 - 10 ans' },
  { min: 11, max: 15, label: '11 - 15 ans' },
  { min: 16, max: 18, label: '16 - 18 ans' },
  { min: 19, max: 25, label: '19 - 25 ans' },
]

export function extractTrancheAge(phrase) {
  const lower = phrase.toLowerCase()

  if (/plus de 25 ans|\+\s*25 ans|25 ans et plus/.test(lower)) {
    return '+25 ans'
  }

  const rangeMatch = lower.match(/entre\s+(\d+)\s+et\s+(\d+)\s+ans/)
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10)
    const max = parseInt(rangeMatch[2], 10)
    const found = TRANCHE_RANGES.find((range) => range.min === min && range.max === max)
    if (found) return found.label
  }

  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/phraseParser.test.js`
Expected: PASS — all tests green, including the new `extractTrancheAge` block.

- [ ] **Step 5: Commit**

```bash
git add pwa/src/phraseParser.js pwa/test/phraseParser.test.js
git commit -m "feat(pwa): extraire la tranche d'âge dictée d'une phrase"
```

---

### Task 8: Phrase parser — département extraction

**Files:**
- Modify: `pwa/src/phraseParser.js`
- Modify: `pwa/test/phraseParser.test.js`

- [ ] **Step 1: Write the failing tests**

Update the import line:

```javascript
import { extractDate, extractSexe, extractCount, extractTrancheAge, extractDepartement } from '../src/phraseParser.js'
```

Append:

```javascript
describe('extractDepartement', () => {
  it('convertit un département énoncé en toutes lettres ("soixante-neuf" -> "69")', () => {
    expect(extractDepartement('département soixante-neuf')).toBe('69')
  })

  it('convertit un département énoncé en toutes lettres à un chiffre, avec zéro initial ("neuf" -> "09")', () => {
    expect(extractDepartement('département neuf')).toBe('09')
  })

  it('accepte un département dicté en chiffres, avec zéro initial si besoin', () => {
    expect(extractDepartement('département 69')).toBe('69')
    expect(extractDepartement('département 8')).toBe('08')
  })

  it('convertit un département composé ("quatre-vingt-treize" -> "93")', () => {
    expect(extractDepartement('département quatre-vingt-treize')).toBe('93')
  })

  it('renvoie null si aucun département n\'est trouvé', () => {
    expect(extractDepartement('quatre filles, entre 6 et 10 ans')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/phraseParser.test.js`
Expected: FAIL — `extractDepartement is not a function` for the new tests.

- [ ] **Step 3: Implement `extractDepartement`**

Append to `pwa/src/phraseParser.js`:

```javascript
export function extractDepartement(phrase) {
  const lower = phrase.toLowerCase()

  const digitsMatch = lower.match(/département\s+(\d{1,3})/)
  if (digitsMatch) return digitsMatch[1].padStart(2, '0')

  const wordsMatch = lower.match(/département\s+([a-zà-öø-ÿ]+(?:[\s-][a-zà-öø-ÿ]+){0,3})/)
  if (wordsMatch) {
    const value = wordToNumber(wordsMatch[1])
    if (value !== null) return String(value).padStart(2, '0')
  }

  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/phraseParser.test.js`
Expected: PASS — all tests green, including the new `extractDepartement` block.

- [ ] **Step 5: Commit**

```bash
git add pwa/src/phraseParser.js pwa/test/phraseParser.test.js
git commit -m "feat(pwa): extraire le département dicté d'une phrase, avec conversion lettres -> chiffres"
```

---

### Task 9: Phrase parser — `parsePhrase` (combine extractions, report missing fields)

**Files:**
- Modify: `pwa/src/phraseParser.js`
- Modify: `pwa/test/phraseParser.test.js`

- [ ] **Step 1: Write the failing tests**

Update the import line:

```javascript
import {
  extractDate,
  extractSexe,
  extractCount,
  extractTrancheAge,
  extractDepartement,
  parsePhrase,
} from '../src/phraseParser.js'
```

Append:

```javascript
describe('parsePhrase', () => {
  it('renvoie ok:true et les champs extraits quand la phrase est complète', () => {
    const result = parsePhrase('Le 8 juin 2026, quatre filles, entre 6 et 10 ans, département soixante-neuf')

    expect(result).toEqual({
      ok: true,
      date: '2026-06-08',
      count: 4,
      sexe: 'Féminin',
      trancheAge: '6 - 10 ans',
      departement: '69',
    })
  })

  it('renvoie ok:false et la liste des champs manquants quand la phrase est incomplète', () => {
    const result = parsePhrase('quatre personnes, département 69')

    expect(result).toEqual({
      ok: false,
      missingFields: ['date', 'sexe', 'trancheAge'],
    })
  })

  it('renvoie tous les champs comme manquants pour une phrase vide', () => {
    const result = parsePhrase('')

    expect(result).toEqual({
      ok: false,
      missingFields: ['date', 'count', 'sexe', 'trancheAge', 'departement'],
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/phraseParser.test.js`
Expected: FAIL — `parsePhrase is not a function` for the new tests.

- [ ] **Step 3: Implement `parsePhrase`**

Append to `pwa/src/phraseParser.js`:

```javascript
export function parsePhrase(phrase) {
  const date = extractDate(phrase)
  const count = extractCount(phrase)
  const sexe = extractSexe(phrase)
  const trancheAge = extractTrancheAge(phrase)
  const departement = extractDepartement(phrase)

  const missingFields = []
  if (!date) missingFields.push('date')
  if (!count) missingFields.push('count')
  if (!sexe) missingFields.push('sexe')
  if (!trancheAge) missingFields.push('trancheAge')
  if (!departement) missingFields.push('departement')

  if (missingFields.length > 0) {
    return { ok: false, missingFields }
  }

  return { ok: true, date, count, sexe, trancheAge, departement }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/phraseParser.test.js`
Expected: PASS — all tests green, including the new `parsePhrase` block.

- [ ] **Step 5: Commit**

```bash
git add pwa/src/phraseParser.js pwa/test/phraseParser.test.js
git commit -m "feat(pwa): assembler l'analyse complète d'une phrase (parsePhrase) et signaler les champs manquants"
```

---

### Task 10: Phrase parser — `buildEntries` (one form entry per person)

**Files:**
- Modify: `pwa/src/phraseParser.js`
- Modify: `pwa/test/phraseParser.test.js`

- [ ] **Step 1: Write the failing tests**

Update the import line:

```javascript
import {
  extractDate,
  extractSexe,
  extractCount,
  extractTrancheAge,
  extractDepartement,
  parsePhrase,
  buildEntries,
} from '../src/phraseParser.js'
```

Append:

```javascript
describe('buildEntries', () => {
  it('génère une fiche par personne à partir d\'une analyse réussie', () => {
    const parsed = {
      ok: true,
      date: '2026-06-08',
      count: 4,
      sexe: 'Féminin',
      trancheAge: '6 - 10 ans',
      departement: '69',
    }

    expect(buildEntries(parsed)).toEqual([
      { date: '2026-06-08', sexe: 'Féminin', trancheAge: '6 - 10 ans', departement: '69' },
      { date: '2026-06-08', sexe: 'Féminin', trancheAge: '6 - 10 ans', departement: '69' },
      { date: '2026-06-08', sexe: 'Féminin', trancheAge: '6 - 10 ans', departement: '69' },
      { date: '2026-06-08', sexe: 'Féminin', trancheAge: '6 - 10 ans', departement: '69' },
    ])
  })

  it('génère une seule fiche quand count vaut 1', () => {
    const parsed = {
      ok: true,
      date: '2026-06-08',
      count: 1,
      sexe: 'Masculin',
      trancheAge: '19 - 25 ans',
      departement: '08',
    }

    expect(buildEntries(parsed)).toEqual([
      { date: '2026-06-08', sexe: 'Masculin', trancheAge: '19 - 25 ans', departement: '08' },
    ])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/phraseParser.test.js`
Expected: FAIL — `buildEntries is not a function` for the new tests.

- [ ] **Step 3: Implement `buildEntries`**

Append to `pwa/src/phraseParser.js`:

```javascript
export function buildEntries(parsed) {
  const { date, count, sexe, trancheAge, departement } = parsed
  return Array.from({ length: count }, () => ({ date, sexe, trancheAge, departement }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/phraseParser.test.js`
Expected: PASS — entire `pwa/test/phraseParser.test.js` suite green.

- [ ] **Step 5: Commit**

```bash
git add pwa/src/phraseParser.js pwa/test/phraseParser.test.js
git commit -m "feat(pwa): générer une fiche de formulaire par personne à partir d'une phrase analysée"
```

---

### Task 11: Session store — counter, persistence and notification trigger

**Files:**
- Create: `pwa/src/sessionStore.js`
- Test: `pwa/test/sessionStore.test.js`

- [ ] **Step 1: Write the failing tests**

Create `pwa/test/sessionStore.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest'
import { createSessionStore } from '../src/sessionStore.js'

function createFakeStorage() {
  const store = new Map()
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  }
}

const ENTRY = { date: '2026-06-08', sexe: 'Féminin', trancheAge: '6 - 10 ans', departement: '69' }

describe('createSessionStore — compteur et notification', () => {
  it('démarre à zéro quand le stockage est vide', () => {
    const store = createSessionStore(createFakeStorage())

    expect(store.getCount()).toBe(0)
    expect(store.getEntries()).toEqual([])
  })

  it('incrémente le compteur à chaque fiche ajoutée', () => {
    const store = createSessionStore(createFakeStorage())

    store.addEntry(ENTRY)
    const result = store.addEntry(ENTRY)

    expect(store.getCount()).toBe(2)
    expect(result.count).toBe(2)
  })

  it('signale shouldNotify uniquement quand le compteur atteint un multiple de 10', () => {
    const store = createSessionStore(createFakeStorage())

    let lastResult
    for (let i = 1; i <= 10; i += 1) {
      lastResult = store.addEntry(ENTRY)
      if (i < 10) {
        expect(lastResult.shouldNotify).toBe(false)
      }
    }

    expect(lastResult.shouldNotify).toBe(true)
    expect(lastResult.count).toBe(10)
  })
})

describe('createSessionStore — persistance locale', () => {
  let storage

  beforeEach(() => {
    storage = createFakeStorage()
  })

  it('persiste les fiches ajoutées dans le stockage fourni', () => {
    const store = createSessionStore(storage)
    store.addEntry(ENTRY)

    expect(JSON.parse(storage.getItem('rao-session'))).toEqual([ENTRY])
  })

  it('recharge les fiches existantes depuis le stockage à la création', () => {
    storage.setItem('rao-session', JSON.stringify([ENTRY, ENTRY]))

    const store = createSessionStore(storage)

    expect(store.getCount()).toBe(2)
    expect(store.getEntries()).toEqual([ENTRY, ENTRY])
  })

  it('ignore un contenu de stockage corrompu et repart de zéro', () => {
    storage.setItem('rao-session', 'ceci n\'est pas du JSON')

    const store = createSessionStore(storage)

    expect(store.getCount()).toBe(0)
  })

  it('réinitialise le compteur et le stockage avec reset', () => {
    const store = createSessionStore(storage)
    store.addEntry(ENTRY)

    store.reset()

    expect(store.getCount()).toBe(0)
    expect(JSON.parse(storage.getItem('rao-session'))).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `pwa/`): `npx vitest run test/sessionStore.test.js`
Expected: FAIL — `Cannot find module '../src/sessionStore.js'`

- [ ] **Step 3: Implement `createSessionStore`**

Create `pwa/src/sessionStore.js`:

```javascript
const STORAGE_KEY = 'rao-session'

function loadEntries(storage) {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function createSessionStore(storage) {
  let entries = loadEntries(storage)

  function persist() {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }

  function addEntry(entry) {
    entries.push(entry)
    persist()
    return {
      count: entries.length,
      shouldNotify: entries.length > 0 && entries.length % 10 === 0,
    }
  }

  function getCount() {
    return entries.length
  }

  function getEntries() {
    return [...entries]
  }

  function reset() {
    entries = []
    persist()
  }

  return { addEntry, getCount, getEntries, reset }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/sessionStore.test.js`
Expected: PASS — all tests in both `describe` blocks green.

- [ ] **Step 5: Commit**

```bash
git add pwa/src/sessionStore.js pwa/test/sessionStore.test.js
git commit -m "feat(pwa): ajouter le compteur de session persistant avec notification tous les 10"
```

---

### Task 12: Session store — répartition (résumé) pour le récapitulatif final

**Files:**
- Modify: `pwa/src/sessionStore.js`
- Modify: `pwa/test/sessionStore.test.js`

- [ ] **Step 1: Write the failing test**

Append to `pwa/test/sessionStore.test.js`:

```javascript
describe('createSessionStore — résumé par sexe / tranche d\'âge / département', () => {
  it('calcule la répartition des fiches enregistrées', () => {
    const store = createSessionStore(createFakeStorage())

    store.addEntry({ date: '2026-06-08', sexe: 'Féminin', trancheAge: '6 - 10 ans', departement: '69' })
    store.addEntry({ date: '2026-06-08', sexe: 'Féminin', trancheAge: '11 - 15 ans', departement: '69' })
    store.addEntry({ date: '2026-06-08', sexe: 'Masculin', trancheAge: '6 - 10 ans', departement: '08' })

    expect(store.getSummary()).toEqual({
      total: 3,
      bySexe: { Féminin: 2, Masculin: 1 },
      byTrancheAge: { '6 - 10 ans': 2, '11 - 15 ans': 1 },
      byDepartement: { '69': 2, '08': 1 },
    })
  })

  it('renvoie un résumé vide quand aucune fiche n\'a été enregistrée', () => {
    const store = createSessionStore(createFakeStorage())

    expect(store.getSummary()).toEqual({
      total: 0,
      bySexe: {},
      byTrancheAge: {},
      byDepartement: {},
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `pwa/`): `npx vitest run test/sessionStore.test.js`
Expected: FAIL — `store.getSummary is not a function`

- [ ] **Step 3: Implement `getSummary`**

In `pwa/src/sessionStore.js`, add the `getSummary` function inside `createSessionStore` and include it in the returned object:

```javascript
  function getSummary() {
    const summary = { total: entries.length, bySexe: {}, byTrancheAge: {}, byDepartement: {} }

    for (const entry of entries) {
      summary.bySexe[entry.sexe] = (summary.bySexe[entry.sexe] ?? 0) + 1
      summary.byTrancheAge[entry.trancheAge] = (summary.byTrancheAge[entry.trancheAge] ?? 0) + 1
      summary.byDepartement[entry.departement] = (summary.byDepartement[entry.departement] ?? 0) + 1
    }

    return summary
  }

  return { addEntry, getCount, getEntries, getSummary, reset }
```

(Replace the existing `return { addEntry, getCount, getEntries, reset }` line with the one above, and add the `getSummary` function definition just before it.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/sessionStore.test.js`
Expected: PASS — entire `pwa/test/sessionStore.test.js` suite green.

- [ ] **Step 5: Commit**

```bash
git add pwa/src/sessionStore.js pwa/test/sessionStore.test.js
git commit -m "feat(pwa): calculer la répartition des fiches par sexe, tranche d'âge et département"
```

---

### Task 13: Relay client — `submitEntry`

**Files:**
- Create: `pwa/src/relayClient.js`
- Test: `pwa/test/relayClient.test.js`

- [ ] **Step 1: Write the failing tests**

Create `pwa/test/relayClient.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { submitEntry } from '../src/relayClient.js'

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `pwa/`): `npx vitest run test/relayClient.test.js`
Expected: FAIL — `Cannot find module '../src/relayClient.js'`

- [ ] **Step 3: Implement `submitEntry`**

Create `pwa/src/relayClient.js`:

```javascript
const RELAY_URL = 'https://rao-relay.claudegermain1.workers.dev'

async function postJson(path, payload) {
  const response = await fetch(`${RELAY_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  try {
    return await response.json()
  } catch {
    return { success: false, error: 'invalid_response' }
  }
}

export async function submitEntry(entry) {
  return postJson('/submit-entry', entry)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/relayClient.test.js`
Expected: PASS — all 3 tests in the `submitEntry` describe block green.

- [ ] **Step 5: Commit**

```bash
git add pwa/src/relayClient.js pwa/test/relayClient.test.js
git commit -m "feat(pwa): ajouter le client relais pour la soumission d'une fiche (submitEntry)"
```

---

### Task 14: Relay client — `sendRecap`

**Files:**
- Modify: `pwa/src/relayClient.js`
- Modify: `pwa/test/relayClient.test.js`

- [ ] **Step 1: Write the failing tests**

Update the import line in `pwa/test/relayClient.test.js`:

```javascript
import { submitEntry, sendRecap } from '../src/relayClient.js'
```

Append:

```javascript
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
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `pwa/`): `npx vitest run test/relayClient.test.js`
Expected: FAIL — `sendRecap is not a function` for the new tests.

- [ ] **Step 3: Implement `sendRecap`**

Append to `pwa/src/relayClient.js`:

```javascript
export async function sendRecap({ subject, text }) {
  return postJson('/send-recap', { subject, text })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/relayClient.test.js`
Expected: PASS — entire `pwa/test/relayClient.test.js` suite green.

- [ ] **Step 5: Run the whole PWA test suite**

Run (from `pwa/`): `npm test`
Expected: PASS — all four test files (`numberWords`, `phraseParser`, `sessionStore`, `relayClient`) green, no failures.

- [ ] **Step 6: Commit**

```bash
git add pwa/src/relayClient.js pwa/test/relayClient.test.js
git commit -m "feat(pwa): ajouter le client relais pour l'envoi du récapitulatif (sendRecap)"
```

---

## Out of scope reminders (for Plan 2b)

- Voice capture via the Web Speech API, the visual confirmation screen (Valider/Corriger), the "fin de session" voice command, the local-storage `localStorage`/`window` wiring (this plan injects a storage object so the logic stays UI-agnostic), PWA manifest/service worker, and GitHub Pages deployment are **not** part of this plan — they belong to Plan 2b, which consumes the modules built here (`parsePhrase`, `buildEntries`, `createSessionStore`, `submitEntry`, `sendRecap`).
