# PWA — Déploiement GitHub Pages (Plan 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Déployer la PWA RAO sur GitHub Pages (`https://claude973.github.io/RAO/`) en configurant les chemins correctement et en créant un workflow GitHub Actions qui déploie automatiquement le dossier `pwa/` à chaque push sur `master`.

**Architecture:** GitHub Pages sert depuis une URL sous-dossier (`/RAO/`), ce qui exige que tous les chemins absolus (service worker, manifest `start_url`, enregistrement SW) soient rendus relatifs ou dynamiques. Un seul workflow GitHub Actions (`deploy.yml`) copie le dossier `pwa/` vers GitHub Pages via `actions/upload-pages-artifact`.

**Tech Stack:** GitHub Pages + GitHub Actions (`actions/checkout@v4`, `actions/configure-pages@v4`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`), service worker vanilla JS.

---

### Problème des chemins absolus sur GitHub Pages

La PWA est hébergée à `https://claude973.github.io/RAO/` (pas à la racine). Trois fichiers contiennent des chemins qui ne fonctionneront pas tels quels :

| Fichier | Problème | Fix |
|---|---|---|
| `pwa/app.js` | `register('/public/service-worker.js')` → résout vers `/public/...` sans `/RAO/` | Remplacer par `'./public/service-worker.js'` (relatif) |
| `pwa/public/manifest.json` | `"start_url": "/"` → pointe vers la racine du domaine | Remplacer par `"."` (relatif) |
| `pwa/public/service-worker.js` | `SHELL = ['/index.html', '/app.js', ...]` → chemins sans `/RAO/` | Dériver le préfixe depuis `self.registration.scope` |

---

### Task 1: Corriger l'enregistrement du service worker dans app.js

**Files:**
- Modify: `pwa/app.js`

- [ ] **Step 1: Lire app.js**

Vérifier la ligne `navigator.serviceWorker.register(...)`.

- [ ] **Step 2: Corriger le chemin d'enregistrement**

Dans `pwa/app.js`, remplacer :

```javascript
navigator.serviceWorker.register('/public/service-worker.js')
```

par :

```javascript
navigator.serviceWorker.register('./public/service-worker.js')
```

Le chemin relatif `./` se résout par rapport à l'URL de la page, donc il fonctionnera sur `https://claude973.github.io/RAO/` → enregistre depuis `/RAO/public/service-worker.js`.

- [ ] **Step 3: Lancer les tests**

Depuis `pwa/` : `npm test`
Attendu : 94 tests verts (app.js n'est pas importé dans les tests).

- [ ] **Step 4: Commit**

```bash
git add pwa/app.js
git commit -m "fix(pwa): utiliser un chemin relatif pour l'enregistrement du service worker"
```

---

### Task 2: Corriger start_url dans le manifest

**Files:**
- Modify: `pwa/public/manifest.json`

- [ ] **Step 1: Corriger start_url**

Dans `pwa/public/manifest.json`, remplacer :

```json
"start_url": "/"
```

par :

```json
"start_url": "."
```

Le `.` est une URL relative qui se résout vers l'emplacement du manifest lui-même, donc vers `https://claude973.github.io/RAO/` quel que soit le préfixe.

- [ ] **Step 2: Vérifier le JSON**

S'assurer que le fichier est du JSON valide (pas de virgule en trop, etc.).

- [ ] **Step 3: Commit**

```bash
git add pwa/public/manifest.json
git commit -m "fix(pwa): utiliser start_url relatif pour compatibilité GitHub Pages"
```

---

### Task 3: Rendre les chemins du service worker dynamiques

**Files:**
- Modify: `pwa/public/service-worker.js`

- [ ] **Step 1: Lire le fichier actuel**

`pwa/public/service-worker.js` contient un tableau `SHELL` avec des chemins absolus comme `'/index.html'`, `'/app.js'`, etc. Sur GitHub Pages, ces chemins doivent être `/RAO/index.html`, `/RAO/app.js`, etc.

- [ ] **Step 2: Remplacer le service worker**

Remplacer le contenu de `pwa/public/service-worker.js` par :

```javascript
const CACHE_NAME = 'rao-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    self.registration.scope
      ? (async () => {
          const base = new URL(self.registration.scope).pathname
          const SHELL = [
            base,
            `${base}index.html`,
            `${base}app.js`,
            `${base}src/speechCapture.js`,
            `${base}src/notify.js`,
            `${base}src/recapEmail.js`,
            `${base}src/phraseParser.js`,
            `${base}src/numberWords.js`,
            `${base}src/sessionStore.js`,
            `${base}src/relayClient.js`,
            `${base}src/ui/dicteeScreen.js`,
            `${base}src/ui/historiqueScreen.js`,
            `${base}public/manifest.json`,
          ]
          const cache = await caches.open(CACHE_NAME)
          await cache.addAll(SHELL)
          await self.skipWaiting()
        })()
      : Promise.resolve()
  )
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

Explication :
- `self.registration.scope` est disponible dès le début du handler `install` car il est synchrone
- `new URL(self.registration.scope).pathname` → `/RAO/` sur GitHub Pages, `/` en local
- Le tableau SHELL est donc correct dans les deux environnements

- [ ] **Step 3: Lancer les tests**

Depuis `pwa/` : `npm test`
Attendu : 94 tests verts.

- [ ] **Step 4: Commit**

```bash
git add pwa/public/service-worker.js
git commit -m "fix(pwa): rendre les chemins du service worker dynamiques pour GitHub Pages"
```

---

### Task 4: Créer le workflow GitHub Actions de déploiement

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Créer le dossier `.github/workflows/`**

Créer `.github/workflows/deploy.yml` avec ce contenu EXACT :

```yaml
name: Déployer la PWA sur GitHub Pages

on:
  push:
    branches:
      - master

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configurer GitHub Pages
        uses: actions/configure-pages@v4

      - name: Uploader les fichiers PWA
        uses: actions/upload-pages-artifact@v3
        with:
          path: pwa

      - name: Déployer sur GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

Explication :
- Le workflow se déclenche à chaque push sur `master`
- `path: pwa` spécifie que c'est le contenu du dossier `pwa/` qui est déployé (pas le repo entier)
- GitHub Pages sert ce dossier depuis `https://claude973.github.io/RAO/`
- L'URL de déploiement est exposée dans les logs GitHub Actions

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: ajouter le workflow de déploiement GitHub Actions sur Pages"
```

---

### Task 5: Activer GitHub Pages et pousser

**Files:** aucun (configuration GitHub + push)

- [ ] **Step 1: Activer GitHub Pages via l'API GitHub**

```bash
gh api --method POST repos/Claude973/RAO/pages \
  -f build_type=workflow \
  -H "Accept: application/vnd.github+json"
```

Si Pages est déjà activé et retourne une erreur "already enabled", c'est normal — passer à l'étape suivante.

Si l'API renvoie une erreur `build_type` non supporté, essayer :
```bash
gh api --method PUT repos/Claude973/RAO/pages \
  -f build_type=workflow \
  -H "Accept: application/vnd.github+json"
```

- [ ] **Step 2: Vérifier que la branche `feature/github-pages-deployment` est prête**

```bash
git log --oneline feature/github-pages-deployment ^master
```
Attendu : 4 commits (tasks 1 à 4).

- [ ] **Step 3: Pousser la branche et créer la PR**

```bash
git push -u origin feature/github-pages-deployment
gh pr create --title "deploy: déploiement GitHub Pages + fix chemins relatifs" \
  --body "$(cat <<'EOF'
## Summary

- Fix chemin SW registration dans `app.js` (absolu → relatif)
- Fix `start_url` dans `manifest.json` (\"\/\" → \".\")
- Service worker : chemins SHELL dynamiques basés sur `self.registration.scope` (compatible local + GitHub Pages)
- Workflow GitHub Actions `deploy.yml` : déploie `pwa/` sur GitHub Pages à chaque push sur master

## Test plan

- [ ] Tests unitaires passants (94/94)
- [ ] Après merge et déploiement : ouvrir `https://claude973.github.io/RAO/` dans Chrome
- [ ] Vérifier l'icône d'installation PWA dans la barre d'adresse
- [ ] Tester la reconnaissance vocale (HTTPS requis — GitHub Pages l'assure)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

## Out of scope

- Icône PWA réelle (fichier PNG) — l'icône `data:` URI reste pour l'instant
- Configuration d'un domaine custom
- Vérification finale limitée avec vraies soumissions (section 7 du spec général) — à faire après déploiement, en concertation avec le client
