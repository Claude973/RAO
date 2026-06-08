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
