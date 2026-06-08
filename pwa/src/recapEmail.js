const CELL_STYLE = 'padding: 8px; border: 1px solid #cccccc;'
const CELL_STYLE_RIGHT = 'padding: 8px; border: 1px solid #cccccc; text-align: right;'
const HEADER_STYLE = 'padding: 8px; border: 1px solid #cccccc; text-align: left;'
const HEADER_STYLE_RIGHT = 'padding: 8px; border: 1px solid #cccccc; text-align: right;'

export function buildRecapEmail(entries, date) {
  const subject = `Récapitulatif RAO ${date}`
  const total = entries.length
  const rows = buildCrosstabRows(entries)

  return {
    subject,
    text: buildTextBody(total, rows),
    html: buildHtmlBody(total, rows),
  }
}

function buildCrosstabRows(entries) {
  const counts = new Map()
  const order = []

  for (const entry of entries) {
    const key = `${entry.sexe}|${entry.trancheAge}`
    if (!counts.has(key)) {
      counts.set(key, 0)
      order.push(key)
    }
    counts.set(key, counts.get(key) + 1)
  }

  return order.map((key) => {
    const [sexe, trancheAge] = key.split('|')
    return { sexe, trancheAge, count: counts.get(key) }
  })
}

function buildTextBody(total, rows) {
  return [
    'Récapitulatif de la session RAO',
    '',
    `Total : ${total} personnes saisies`,
    '',
    "Répartition par sexe et tranche d'âge :",
    ...rows.map(({ sexe, trancheAge, count }) => `- ${sexe}, ${trancheAge} : ${count}`),
  ].join('\n')
}

function buildHtmlBody(total, rows) {
  const bodyRows = rows
    .map(
      ({ sexe, trancheAge, count }, index) => `
      <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f2f2f2'};">
        <td style="${CELL_STYLE}">${sexe}</td>
        <td style="${CELL_STYLE}">${trancheAge}</td>
        <td style="${CELL_STYLE_RIGHT}">${count}</td>
      </tr>`
    )
    .join('')

  return `
    <h2 style="font-family: Arial, sans-serif; color: #1f4e79;">Récapitulatif de la session RAO</h2>
    <p style="font-family: Arial, sans-serif;">Total : <strong>${total} personnes saisies</strong></p>
    <table style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">
      <thead>
        <tr style="background-color: #1f4e79; color: #ffffff;">
          <th style="${HEADER_STYLE}">Sexe</th>
          <th style="${HEADER_STYLE}">Tranche d'âge</th>
          <th style="${HEADER_STYLE_RIGHT}">Nombre</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
      <tfoot>
        <tr style="font-weight: bold;">
          <td style="${CELL_STYLE}" colspan="2">Total</td>
          <td style="${CELL_STYLE_RIGHT}">${total}</td>
        </tr>
      </tfoot>
    </table>`
}
