const TRANCHES = ['6 - 10 ans', '11 - 15 ans', '16 - 18 ans', '19 - 25 ans', '+25 ans']

export function createDicteeScreen(container, { buildEntries, submitEntry, sessionStore, notifier }) {
  function renderForm() {
    const count = sessionStore.getCount()
    const today = new Date().toISOString().slice(0, 10)
    container.innerHTML = `
      <div class="session-counter">${count} fiches enregistrées</div>
      <form id="saisie-form">
        <div class="form-row">
          <label>Date
            <input id="f-date" type="date" value="${today}" required />
          </label>
          <label>Département
            <input id="f-dept" type="text" placeholder="Ex : 69" required />
          </label>
        </div>
        <fieldset>
          <legend>Filles</legend>
          <div class="count-grid">
            ${TRANCHES.map((t) => `
              <label>${t}
                <input type="number" class="count-input" data-sexe="Féminin" data-tranche="${t}" min="0" value="0" />
              </label>`).join('')}
          </div>
        </fieldset>
        <fieldset>
          <legend>Garçons</legend>
          <div class="count-grid">
            ${TRANCHES.map((t) => `
              <label>${t}
                <input type="number" class="count-input" data-sexe="Masculin" data-tranche="${t}" min="0" value="0" />
              </label>`).join('')}
          </div>
        </fieldset>
        <button type="submit" id="validate-btn">Valider</button>
      </form>
    `
    container.querySelector('#saisie-form').addEventListener('submit', (e) => {
      e.preventDefault()
      handleSubmit()
    })
  }

  function handleSubmit() {
    const date = container.querySelector('#f-date').value
    const departement = container.querySelector('#f-dept').value.trim()
    if (!date || !departement) return

    const groups = [...container.querySelectorAll('.count-input')]
      .map((el) => ({
        sexe: el.dataset.sexe,
        trancheAge: el.dataset.tranche,
        count: parseInt(el.value, 10) || 0,
      }))
      .filter((g) => g.count > 0)

    if (groups.length === 0) return

    const allEntries = groups.flatMap((g) =>
      buildEntries({ date, departement, sexe: g.sexe, trancheAge: g.trancheAge, count: g.count })
    )
    startSending(allEntries)
  }

  async function startSending(entries) {
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
          <button id="back-btn">${statuses.every((s) => s !== null) ? "Retour à l'accueil" : 'Annuler et retourner'}</button>
        </div>
      `
      statuses.forEach((s, i) => {
        if (s !== null && !s.success) {
          container.querySelector(`.retry-entry-btn[data-index="${i}"]`)?.addEventListener('click', () => retryEntry(i))
        }
      })
      container.querySelector('#back-btn')?.addEventListener('click', renderForm)
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

  return { show: renderForm }
}
