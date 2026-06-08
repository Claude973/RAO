# RAO — Application de saisie vocale assistée pour le questionnaire "Jeunes PROX'"

Date : 2026-06-08
Statut : en cours de validation

## 1. Contexte

Raid Aventure Organisation (RAO) est une association créée en 1992 par Bruno Pomart, dont
l'objectif est de renforcer les liens entre la jeunesse, la population et les forces de
sécurité, à travers les "Journées Prox" (activités sportives, éducatives et citoyennes).

À la fin de chaque journée, RAO fait remplir aux jeunes participants un questionnaire de
satisfaction en ligne (formulaire "Questionnaire jeunes PROX'" sur raid-aventure.org). Le
volume est d'environ 200 personnes par session, et le formulaire est conçu pour une saisie
individuelle — ce qui rend la collecte fastidieuse pour l'équipe RAO sur le terrain.

## 2. Objectif du projet

Fournir à RAO une application mobile gratuite ("RAO") qui permet à un membre de l'équipe de
**dicter à voix haute** les informations d'un ou plusieurs participants, et de voir ces
informations **automatiquement saisies et soumises** sur le formulaire officiel du site
raid-aventure.org — sans ressaisie manuelle.

**Contrainte majeure : le projet doit être développé et exploité à coût nul.** Seuls des
outils et services disposant d'un palier gratuit suffisant seront utilisés (ex : GitHub,
Gmail, hébergement serverless gratuit).

## 3. Le formulaire cible

Formulaire "Questionnaire jeunes PROX'" (https://raid-aventure.org/questionnaire-jeunes-prox/),
construit avec le plugin WordPress **Quform** (formulaire n°9). Analyse technique :

| Champ | Nom technique | Type | Origine de la valeur |
|---|---|---|---|
| Date | `quform_9_17` | texte (YYYY-MM-DD) | **dictée** |
| Sexe | `quform_9_15` | radio (Féminin / Masculin) | **dictée** |
| Tranche d'âge | `quform_9_19` | radio (6-10, 11-15, 16-18, 19-25, +25 ans) | **dictée** |
| Département | `quform_9_14` | texte libre, en chiffres | **dictée** |
| "As-tu aimé le programme de la journée ?" | `quform_9_3` | radio (Oui/Non) | fixe = **Oui** |
| "Qu'as-tu le plus préféré ?" | `quform_9_4` | radio (3 choix) | fixe = **Les deux** |
| "Savais-tu que la journée était proposée par des bénévoles ?" | `quform_9_5` | radio (Oui/Non) | fixe = **Non** |
| "Reviendrais-tu à une journée organisée par des bénévoles ?" | `quform_9_6` | radio (Oui/Non) | fixe = **Oui** |
| "Avant cette journée, quel était ton regard sur la police ?" | `quform_9_7` | radio (Bon/Mauvais) | fixe = **Bon** |
| "Après cette journée, ton regard a-t-il changé ?" | `quform_9_8` | radio (Oui/Non), **conditionnel** (n'apparaît que si la réponse précédente est "Mauvais") | ne se déclenche jamais, car la réponse fixe à la question précédente est "Bon" |
| Champ piège anti-spam | `quform_9_398351` | champ caché (textarea) | **doit rester vide** |

Contraintes techniques identifiées :
- Le formulaire repose sur un **jeton CSRF à usage unique** régénéré à chaque chargement de
  page, plus une session WordPress (cookie `quform_session_*`, httpOnly, sécurisé).
- **Aucun en-tête CORS** n'autorise les requêtes cross-origin : une soumission directe depuis
  une application web hébergée ailleurs sera bloquée par le navigateur.
- ➜ Une soumission automatisée nécessite donc un relais côté serveur (voir section 5).

## 4. Fonctionnalités attendues

### 4.1. Saisie vocale assistée (multi-personnes)
Le membre de l'équipe RAO dicte une phrase libre, par exemple :
> "Le 8 juin 2026, quatre filles, entre 6 et 10 ans, département soixante-neuf"

L'application :
1. Transcrit la voix en texte (reconnaissance vocale en direct, via le micro du téléphone)
2. Analyse la phrase pour en extraire : la date, le nombre de personnes, le sexe, la tranche
   d'âge, le département (avec conversion des nombres énoncés en toutes lettres vers leur
   forme chiffrée — ex. "soixante-neuf" → "69")
3. Affiche un résumé de ce qu'elle a compris pour confirmation (voir 4.2)
4. Soumet automatiquement **une fiche par personne** au formulaire officiel (donc 4 fois dans
   l'exemple ci-dessus), chaque fiche reprenant les valeurs dictées + les réponses fixes du
   tableau de la section 3

### 4.2. Confirmation visuelle avant envoi
Avant chaque envoi au site officiel, l'application affiche un récapitulatif de ce qu'elle a
compris (ex. *"J'ai compris : 4 filles, 6-10 ans, département 69, le 8 juin 2026"*) avec deux
actions possibles : **Valider** (déclenche l'envoi) ou **Corriger** (permet de redicter ou
d'ajuster). Cette étape évite qu'une erreur de reconnaissance vocale ne soit transmise telle
quelle au site officiel — où elle ne serait pas facilement annulable.

### 4.3. Comptage de session et notification intermédiaire
L'application tient un compteur du nombre de fiches soumises avec succès durant la session en
cours (stocké localement sur le téléphone). **Dès que ce compteur atteint un multiple de 10**,
une notification / pop-up locale s'affiche sur le téléphone avec un récapitulatif intermédiaire
(nombre de saisies effectuées jusque-là).

### 4.4. Récapitulatif final par e-mail
Lorsque le membre de l'équipe RAO prononce une commande vocale de fin de session (ex. "fin de
session"), l'application déclenche l'envoi d'un e-mail récapitulatif à l'adresse du client,
avec :
- **Objet** : "Récapitulatif RAO [date dictée par le client lors de sa transmission vocale]"
- **Corps (texte simple)** : le nombre total de personnes saisies durant la session, et une
  répartition détaillée (par sexe, par tranche d'âge, par département)

### 4.5. Persistance de session
Le compteur et l'historique des entrées de la session en cours sont conservés localement sur
le téléphone, pour permettre de reprendre une session interrompue (fermeture de l'application,
extinction du téléphone, etc.) sans perdre les données déjà saisies.

## 5. Architecture proposée

```
┌─────────────────────────┐
│   PWA (téléphone client)│
│  - Reconnaissance vocale│
│  - Analyse de la phrase │
│  - Confirmation visuelle│
│  - Compteur de session  │
│  - Pop-up récap (x10)   │
└───────────┬─────────────┘
            │ appels HTTP (même API : pas de souci CORS)
            ▼
┌─────────────────────────┐
│  Fonction relais         │
│  (hébergement serverless │
│   gratuit)               │
│  - Récupère un jeton     │
│    frais et soumet au    │
│    formulaire RAO        │
│  - Envoie l'e-mail récap │
│    (Gmail SMTP/API)      │
└───────────┬─────────────┘
            │
   ┌────────┴────────┐
   ▼                 ▼
raid-aventure.org    boîte mail du client
(formulaire Quform)  (récapitulatif final)
```

### 5.1. La PWA (Progressive Web App)
Application web installable sur smartphone (icône, plein écran), choisie pour rester
**100 % gratuite** : pas de compte développeur payant (Play Store / App Store), déploiement
possible gratuitement via GitHub Pages. Utilise la reconnaissance vocale native du navigateur
(Web Speech API, gratuite). Contient toute la logique d'interface, d'analyse de phrase et de
gestion de session.

### 5.2. La fonction relais
Petit service hébergé sur une plateforme serverless à palier gratuit (ex. Cloudflare Workers).
Rôle : isoler toute la logique "fragile" et externe dans un point unique, facilement
réparable :
- Récupérer un jeton anti-spam frais et soumettre les données au formulaire officiel RAO, en
  respectant son fonctionnement (jeton CSRF, session, champ piège laissé vide)
- Envoyer l'e-mail récapitulatif final via un service gratuit d'envoi d'e-mails (SMTP Gmail
  avec mot de passe d'application, ou API gratuite équivalente)

### 5.3. Stockage
Aucune base de données externe : le compteur et l'historique de session vivent localement sur
le téléphone du client (stockage du navigateur). Solution simple, gratuite, et suffisante pour
un usage par session.

## 6. Gestion des erreurs et cas particuliers

| Cas | Comportement attendu |
|---|---|
| La reconnaissance vocale ne permet pas d'extraire un élément requis (ex. pas de tranche d'âge détectée) | L'application le signale clairement et invite à redicter, plutôt que de soumettre une fiche incomplète |
| Échec de soumission au site officiel (réseau, site indisponible, jeton expiré...) | L'entrée n'est **pas** comptabilisée comme réussie ; l'application affiche l'échec et propose de relancer uniquement cette entrée |
| Échec d'envoi de l'e-mail récapitulatif final | Le récapitulatif reste en mémoire ; l'application permet de relancer l'envoi sans perdre les données de la session |
| Le client juge que la phrase a été mal comprise | Possibilité de dire/choisir "Corriger" lors de l'étape de confirmation (4.2), avant tout envoi |
| Session interrompue (appli fermée, téléphone éteint...) | Le compteur et l'historique restent stockés localement ; la session peut reprendre là où elle s'est arrêtée |

## 7. Stratégie de test (sans polluer les données réelles de RAO)

Soumettre des données de test directement au formulaire officiel créerait de **vraies entrées**
dans la base de données de RAO, faussant leurs statistiques. Stratégie retenue :

1. **Doublure locale du formulaire** — une copie du formulaire officiel (mêmes champs, même
   comportement) sert d'environnement de test pendant tout le développement. La fonction
   relais et la PWA sont testées contre cette doublure, jamais contre le vrai site.
2. **Tests automatisés sur la logique métier** — reconnaissance vocale, analyse de phrase,
   comptage, génération de l'e-mail récapitulatif, etc. sont testés indépendamment, sans
   jamais appeler le site raid-aventure.org.
3. **Vérification finale minimale et concertée** — juste avant la mise en service, un nombre
   très limité de soumissions réelles (1 à 3), avec des données clairement identifiables comme
   test (ex. département "00", date très éloignée). **Le client est prévenu à l'avance** afin
   qu'il puisse repérer et supprimer ces entrées depuis l'administration de son site WordPress.

## 8. Hors périmètre (pour cette première version)

- Pas d'envoi de message vocal sur Telegram (abandonné au profit de l'e-mail texte)
- Pas de tableau de bord web pour consulter l'historique des sessions passées
- Pas de gestion multi-utilisateurs / multi-comptes
- Pas de version "navigateur automatisé" (Playwright) — solution de repli à envisager
  uniquement si le relais léger s'avère insuffisant face aux protections anti-bot du site RAO
