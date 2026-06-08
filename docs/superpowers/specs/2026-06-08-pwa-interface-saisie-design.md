# RAO — Interface PWA de saisie vocale (Plan 2b)

Date : 2026-06-08
Statut : validé, en attente de plan d'implémentation

## 1. Contexte

Ce document complète la spec générale du projet
(`docs/superpowers/specs/2026-06-08-saisie-vocale-prox-design.md`) en détaillant
**l'interface et le câblage de la PWA** : capture vocale, écrans, confirmation,
notifications, et envoi du récapitulatif final.

La **logique métier pure** (conversion des nombres, analyse de phrase, gestion de
session, client HTTP vers le relais) a déjà été conçue, implémentée et fusionnée
sur `master` (Plan 2a — voir `docs/superpowers/plans/2026-06-08-pwa-logique-metier.md`).
Ce plan consomme directement les modules déjà construits et testés :
`parsePhrase`, `buildEntries`, `createSessionStore`, `submitEntry`, `sendRecap`.

Le relais (Cloudflare Worker, branche `feature/relais-soumission-formulaire`) est
également concerné par une évolution mineure (voir section 6).

## 2. Évolutions par rapport à la spec d'origine

Au cours du brainstorming, certains choix ont fait évoluer des points de la spec
générale (section 4 du document d'origine). Ils sont actés ici :

1. **Fin de session sans commande vocale** — la spec d'origine (4.4) prévoyait une
   commande vocale "fin de session". Choix retenu : un **bouton dédié** "Terminer
   la session" sur l'écran Historique, sans reconnaissance vocale pour cette
   action. Raison : plus fiable (pas d'ambiguïté avec une vraie fiche dictée), pas
   de risque de déclenchement accidentel.
2. **Date de l'objet du récapitulatif** — la spec d'origine (4.4) mentionnait *"la
   date dictée par le client lors de sa transmission vocale"*. Comme il n'y a plus
   de transmission vocale pour terminer la session, l'objet utilise désormais la
   **date système du jour** au moment où l'utilisateur clique sur "Terminer la
   session" : `"Récapitulatif RAO <date du jour>"`.
3. **Corps de l'e-mail récapitulatif en HTML** — la spec d'origine (4.4) précisait
   un *"corps en texte simple"*. Choix retenu : un **tableau HTML soigné** présentant
   une analyse croisée détaillée (sexe × tranche d'âge), accompagné d'une version
   texte simple en secours pour la compatibilité. Cela nécessite une évolution du
   relais (voir section 6).

## 3. Architecture

**Stack** : PWA en JavaScript vanilla (ES modules), cohérente avec le code de
logique métier déjà fusionné — pas de framework, pour rester simple et à coût nul.
Reconnaissance vocale via la **Web Speech API** native du navigateur (`lang: 'fr-FR'`).

**Structure de fichiers** (sous `pwa/`) :

```
pwa/
├── src/
│   ├── numberWords.js, phraseParser.js,          ← déjà fusionnés (Plan 2a)
│   │   sessionStore.js, relayClient.js
│   ├── speechCapture.js        ← wrapper autour de Web Speech API (start/stop, callbacks)
│   ├── recapEmail.js           ← construit { subject, text, html } du récapitulatif
│   ├── ui/
│   │   ├── dicteeScreen.js     ← écran "Dictée"
│   │   ├── historiqueScreen.js ← écran "Historique"
│   │   └── notify.js           ← notifications (système + repli interne)
│   └── app.js                  ← bascule entre écrans, câblage storage réel (localStorage)
├── public/
│   ├── manifest.json           ← manifeste PWA (nom, icônes, plein écran)
│   └── service-worker.js       ← mise en cache pour installation/usage basique
└── index.html
```

**Principe de câblage** : `app.js` est le seul module qui touche `window`,
`localStorage` et les notifications natives — il instancie
`createSessionStore(localStorage)` et connecte les écrans aux modules métier déjà
testés. Les écrans (`ui/*.js`) restent des fonctions de rendu/événements,
testables indépendamment de l'environnement navigateur réel (DOM simulé via
`jsdom`, dépendances injectées).

## 4. Écran "Dictée"

Écran principal, pensé pour un usage rapide et debout sur le terrain.

**États et flux :**

1. **Repos** — gros bouton micro "🎤 Appuyer pour dicter", compteur de session
   visible en permanence en haut ("23 fiches enregistrées").
2. **Enregistrement** — un premier appui démarre `speechCapture` (écoute continue
   jusqu'au second appui — bouton **bascule**, pas de détection automatique du
   silence ni de "maintenir appuyé"). Le bouton change visuellement
   ("⏹ Appuyer pour arrêter").
3. **Analyse** — le second appui arrête la capture ; le texte transcrit est passé
   à `parsePhrase`. Deux cas :
   - **Échec d'extraction** (champ manquant) — message clair ("Je n'ai pas
     compris la tranche d'âge — peux-tu redicter ?") avec bouton "Rediter"
   - **Succès** — passage à l'écran de confirmation/édition
4. **Confirmation/édition** — affichage des champs compris (date, sexe, tranche
   d'âge, département, nombre de personnes) sous forme de **champs modifiables**
   (menus déroulants pour sexe et tranche d'âge, champs texte pour date,
   département, nombre), avec un résumé en clair ("4 filles, 6-10 ans, dépt 69,
   le 8 juin 2026") et deux actions : **Valider** / **Rediter depuis le début**.
   Pas de redictée champ par champ — uniquement édition manuelle ou redictée
   complète.
5. **Envoi** — au clic sur "Valider", `buildEntries` génère N fiches ; chacune
   est envoyée via `submitEntry` avec une **progression détaillée par fiche**
   ("Fiche 1/4 ✓", "Fiche 2/4 ✗ — [Relancer cette fiche]"). Chaque succès
   incrémente `sessionStore` (et déclenche la notification tous les 10 — voir
   section 7).
6. **Retour au repos** une fois toutes les fiches traitées (succès, ou abandon
   des relances par l'utilisateur).

## 5. Écran "Historique"

Affiche l'état de la session en cours et permet de la clôturer.

**Contenu :**

- **Compteur global** — "23 fiches enregistrées durant cette session"
- **Répartitions simples** (via `sessionStore.getSummary()`) — trois listes
  séparées : par sexe, par tranche d'âge, par département (ex. "Féminin : 14 ·
  Masculin : 9", "6-10 ans : 12 · 11-15 ans : 8 · ...", "69 : 18 · 08 : 5")
- **Bouton "Terminer la session"** :
  1. Au clic, construit le récapitulatif via `buildRecapEmail` puis appelle
     `sendRecap({ subject, text, html })`
  2. **Succès** — message de confirmation ("Récapitulatif envoyé ✓"), puis
     `sessionStore.reset()` ; retour à l'écran "Dictée", prêt pour une nouvelle
     session
  3. **Échec** — message d'erreur clair ("L'envoi du récapitulatif a échoué") +
     bouton "Réessayer l'envoi" ; **les données restent intactes**, aucune
     réinitialisation tant que l'envoi n'a pas réussi

## 6. E-mail récapitulatif (HTML)

**Nouveau module** : `pwa/src/recapEmail.js`, qui expose
`buildRecapEmail(entries, date)` → `{ subject, text, html }`, construit à partir
des entrées brutes de la session (`sessionStore.getEntries()`). Ce module est
indépendant de `sessionStore.getSummary()` (qui reste dédié à l'affichage simple
de l'écran Historique) — il calcule sa propre analyse croisée.

- **`subject`** — `"Récapitulatif RAO <date du jour>"` (date système, voir section 2)
- **`text`** — version texte simple de secours : total + répartitions simples
  (compatibilité, lisibilité minimale, et alignement avec l'esprit de la spec
  d'origine)
- **`html`** — tableau HTML soigné présentant une **analyse croisée sexe × tranche
  d'âge** : une ligne par combinaison rencontrée (ex. "Féminin · 6-10 ans · 15",
  "Féminin · 11-15 ans · 3", "Masculin · 6-10 ans · 9", "Masculin · 11-15 ans · 9"),
  plus une ligne de total. Mise en forme avec en-têtes, bordures et alternance de
  couleurs pour une présentation professionnelle.

**Modifications du relais** (`relay/`, branche `feature/relais-soumission-formulaire`) :

- `relay/src/mailer.js` — `sendRecapEmail` accepte un paramètre `html` optionnel
  et le transmet à `mailer.send({ ..., text, html })` (le client `worker-mailer`
  supporte nativement l'envoi de `text` et `html` conjoints — `text` sert de
  repli pour les clients mail qui n'affichent pas le HTML)
- `relay/src/index.js` — l'endpoint `/send-recap` lit `html` (optionnel) dans le
  corps de la requête JSON et le transmet à `sendRecapEmail`
- `pwa/src/relayClient.js` — `sendRecap({ subject, text, html })` envoie les
  trois champs au relais

## 7. Notifications de session (tous les 10)

Conformément à la section 4.3 de la spec d'origine :

- **Si la permission de notification système est accordée** — notification
  système locale (Notifications API du navigateur), visible même app en
  arrière-plan ou écran verrouillé
- **Sinon** — repli silencieux sur un bandeau interne à l'app (visible uniquement
  si l'app est au premier plan)
- La demande de permission se fait une fois, au premier lancement ou à la première
  occasion pertinente ; un refus n'empêche pas l'usage de l'app (repli automatique)

## 8. Gestion des erreurs et cas particuliers

| Cas | Comportement |
|---|---|
| Reconnaissance vocale infructueuse / champ manquant | Message clair + bouton "Rediter" (pas de soumission de fiche incomplète) |
| Échec de soumission d'une fiche (`submitEntry`) | Affichage par fiche avec bouton "Relancer cette fiche" ; la fiche en échec n'incrémente pas le compteur |
| Échec d'envoi du récapitulatif (`sendRecap`) | Message d'erreur + bouton "Réessayer l'envoi" ; aucune réinitialisation de session tant que l'envoi n'a pas réussi |
| Permission de notification refusée | Repli silencieux sur le bandeau interne, pas de blocage |
| Session interrompue (app fermée, téléphone éteint) | `sessionStore` recharge l'historique depuis `localStorage` au démarrage — reprise transparente |

## 9. Stratégie de tests

- **`speechCapture.js`** — wrapper testable en injectant une fausse
  `SpeechRecognition` (même principe que l'injection de `storage` dans
  `sessionStore`) ; aucun appel réel à l'API navigateur dans les tests
- **`recapEmail.js`** — tests purs sur `buildRecapEmail(entries, date)` :
  vérifie `subject`, `text`, et structure du `html` généré (table, lignes,
  totaux) à partir de fixtures d'entrées
- **Écrans (`ui/*.js`)** — tests sur la logique de rendu/événements avec un DOM
  simulé (`jsdom`, déjà disponible via Vitest), modules métier injectés/mockés
  (`submitEntry`, `sendRecap`, `sessionStore`)
- **Relais (`mailer.js`, `index.js`)** — étendre les tests existants pour
  couvrir le passage du champ `html` optionnel
- **Pas de test contre `raid-aventure.org`** ni contre de vrais services Gmail —
  conformément à la stratégie de test de la spec d'origine (doublure locale +
  vérification finale limitée et concertée, section 7 du document d'origine)

## 10. Hors périmètre

- Pas de redictée champ par champ lors de la correction (uniquement édition
  manuelle des champs ou redictée complète de la phrase)
- Pas de mode mains-libres / écoute continue automatique (le bouton bascule reste
  le seul déclencheur de capture)
- Le déploiement final sur GitHub Pages et la configuration complète du manifeste
  PWA (icônes définitives, nom d'affichage) seront affinés lors de
  l'implémentation, sans impact sur l'architecture décrite ici
