import { describe, it, expect } from 'vitest'
import { FIXED_ANSWERS } from '../src/fixedAnswers.js'

describe('FIXED_ANSWERS', () => {
  it('contient les six réponses fixes attendues du questionnaire', () => {
    expect(FIXED_ANSWERS).toEqual({
      quform_9_3: 'Oui',
      quform_9_4: 'Les deux',
      quform_9_5: 'Non',
      quform_9_6: 'Oui',
      quform_9_7: 'Bon',
      quform_9_8: 'Oui',
    })
  })
})
