import { describe, it, expect } from 'vitest'
import { buildRecapEmail } from '../src/recapEmail.js'

const ENTRIES = [
  { date: '2026-06-08', sexe: 'Féminin', trancheAge: '6 - 10 ans', departement: '69' },
  { date: '2026-06-08', sexe: 'Féminin', trancheAge: '6 - 10 ans', departement: '69' },
  { date: '2026-06-08', sexe: 'Féminin', trancheAge: '11 - 15 ans', departement: '08' },
  { date: '2026-06-08', sexe: 'Masculin', trancheAge: '6 - 10 ans', departement: '69' },
]

describe('buildRecapEmail', () => {
  it('construit l\'objet avec la date fournie', () => {
    const result = buildRecapEmail(ENTRIES, '8 juin 2026')

    expect(result.subject).toBe('Récapitulatif RAO 8 juin 2026')
  })

  it('construit le corps texte avec le total et la répartition croisée sexe x tranche d\'âge', () => {
    const result = buildRecapEmail(ENTRIES, '8 juin 2026')

    expect(result.text).toBe(
      [
        'Récapitulatif de la session RAO',
        '',
        'Total : 4 personnes saisies',
        '',
        "Répartition par sexe et tranche d'âge :",
        '- Féminin, 6 - 10 ans : 2',
        '- Féminin, 11 - 15 ans : 1',
        '- Masculin, 6 - 10 ans : 1',
      ].join('\n')
    )
  })

  it('construit un tableau HTML avec une ligne par combinaison et le total', () => {
    const result = buildRecapEmail(ENTRIES, '8 juin 2026')

    expect(result.html).toContain('<table')
    expect(result.html).toContain('<th style="padding: 8px; border: 1px solid #cccccc; text-align: left;">Sexe</th>')
    expect(result.html).toContain('<th style="padding: 8px; border: 1px solid #cccccc; text-align: left;">Tranche d\'âge</th>')
    expect(result.html).toContain('<td style="padding: 8px; border: 1px solid #cccccc;">Féminin</td>')
    expect(result.html).toContain('<td style="padding: 8px; border: 1px solid #cccccc;">6 - 10 ans</td>')
    expect(result.html).toContain('<td style="padding: 8px; border: 1px solid #cccccc;">11 - 15 ans</td>')
    expect(result.html).toContain('<td style="padding: 8px; border: 1px solid #cccccc;">Masculin</td>')
    expect(result.html).toContain('<td style="padding: 8px; border: 1px solid #cccccc; text-align: right;">2</td>')
    expect(result.html).toContain('<td style="padding: 8px; border: 1px solid #cccccc; text-align: right;">1</td>')
    expect(result.html).toContain('Total : <strong>4 personnes saisies</strong>')
  })

  it('renvoie un récapitulatif vide quand il n\'y a aucune entrée', () => {
    const result = buildRecapEmail([], '8 juin 2026')

    expect(result.text).toBe(
      [
        'Récapitulatif de la session RAO',
        '',
        'Total : 0 personnes saisies',
        '',
        "Répartition par sexe et tranche d'âge :",
      ].join('\n')
    )
    expect(result.html).toContain('Total : <strong>0 personnes saisies</strong>')
  })
})
