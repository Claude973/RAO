export function createDicteeScreen(container, { speechCapture, parsePhrase, buildEntries, submitEntry, sessionStore, notifier }) {
  let state = 'idle'
  let bufferedTranscript = null

  speechCapture.onTranscript(handleTranscript)
  speechCapture.onLiveTranscript(handleLiveTranscript)
  speechCapture.onError(handleSpeechError)
  speechCapture.onEnd(handleSpeechEnd)

  function renderIdle() {
    state = 'idle'
    bufferedTranscript = null
    const count = sessionStore.getCount()
    container.innerHTML = `
      <div class="session-counter">${count} fiches enregistrées</div>
      <button id="mic-btn">🎤 Appuyer pour dicter</button>
    `
    container.querySelector('#mic-btn').addEventListener('click', startRecording)
  }

  function startRecording() {
    state = 'recording'
    bufferedTranscript = null
    const count = sessionStore.getCount()
    container.innerHTML = `
      <div class="session-counter">${count} fiches enregistrées</div>
      <button id="mic-btn">⏹ Appuyer pour arrêter</button>
      <div id="live-transcript" class="live-transcript">🎤 En écoute...</div>
    `
    container.querySelector('#mic-btn').addEventListener('click', stopRecording)
    speechCapture.start()
  }

  function handleLiveTranscript(text) {
    const el = container.querySelector('#live-transcript')
    if (el) el.textContent = text
  }

  function stopRecording() {
    state = 'processing'
    container.innerHTML = `<div id="processing-msg">Analyse en cours...</div>`
    speechCapture.stop()
    if (bufferedTranscript !== null) {
      const t = bufferedTranscript
      bufferedTranscript = null
      processTranscript(t)
    }
  }

  function handleSpeechError(error) {
    if (state !== 'recording') return
    renderError(`Erreur de reconnaissance vocale : ${error} — Peux-tu redicter ?`)
  }

  function handleSpeechEnd() {
    if (state === 'processing') {
      renderError("La reconnaissance vocale s'est arrêtée sans résultat — réessaie")
    }
  }

  function handleTranscript(transcript) {
    if (state === 'recording') {
      bufferedTranscript = transcript
      return
    }
    if (state !== 'processing') return
    processTranscript(transcript)
  }

  function processTranscript(transcript) {
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
