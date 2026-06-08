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
