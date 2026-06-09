import { describe, it, expect, vi } from 'vitest'
import { createSpeechCapture } from '../src/speechCapture.js'

function createFakeSpeechRecognitionClass() {
  const instances = []

  class FakeSpeechRecognition {
    constructor() {
      this.lang = null
      this.continuous = null
      this.interimResults = null
      this.onresult = null
      this.onerror = null
      this.onend = null
      this.startCalls = 0
      this.stopCalls = 0
      instances.push(this)
    }

    start() {
      this.startCalls += 1
    }

    stop() {
      this.stopCalls += 1
    }
  }

  return { FakeSpeechRecognition, instances }
}

function makeFinalResult(transcript) {
  return { transcript, isFinal: true }
}

function makeInterimResult(transcript) {
  return { transcript, isFinal: false }
}

describe('createSpeechCapture', () => {
  it('configure la reconnaissance en français, en écoute continue avec résultats intermédiaires', () => {
    const { FakeSpeechRecognition, instances } = createFakeSpeechRecognitionClass()
    const capture = createSpeechCapture(FakeSpeechRecognition)

    capture.start()

    expect(instances[0].lang).toBe('fr-FR')
    expect(instances[0].continuous).toBe(true)
    expect(instances[0].interimResults).toBe(true)
    expect(instances[0].startCalls).toBe(1)
  })

  it('réinitialise le transcript accumulé à chaque appel de start()', () => {
    const { FakeSpeechRecognition, instances } = createFakeSpeechRecognitionClass()
    const capture = createSpeechCapture(FakeSpeechRecognition)
    const handler = vi.fn()

    capture.onTranscript(handler)
    capture.start()
    instances[0].onresult({
      resultIndex: 0,
      results: [{ 0: makeFinalResult('premier'), isFinal: true }],
    })

    capture.start()
    instances[0].onresult({
      resultIndex: 0,
      results: [{ 0: makeFinalResult('second'), isFinal: true }],
    })

    expect(handler).toHaveBeenLastCalledWith('second')
  })

  it('arrête la reconnaissance en cours', () => {
    const { FakeSpeechRecognition, instances } = createFakeSpeechRecognitionClass()
    const capture = createSpeechCapture(FakeSpeechRecognition)

    capture.start()
    capture.stop()

    expect(instances[0].stopCalls).toBe(1)
  })

  it('appelle onTranscript uniquement pour les résultats finaux, accumulés', () => {
    const { FakeSpeechRecognition, instances } = createFakeSpeechRecognitionClass()
    const capture = createSpeechCapture(FakeSpeechRecognition)
    const handler = vi.fn()

    capture.onTranscript(handler)
    capture.start()

    // Premier chunk final
    instances[0].onresult({
      resultIndex: 0,
      results: [{ 0: makeFinalResult('Le 8 juin'), isFinal: true }],
    })
    expect(handler).toHaveBeenCalledWith('Le 8 juin')

    // Deuxième chunk final — accumulé
    instances[0].onresult({
      resultIndex: 1,
      results: [
        { 0: makeFinalResult('Le 8 juin'), isFinal: true },
        { 0: makeFinalResult('quatre filles'), isFinal: true },
      ],
    })
    expect(handler).toHaveBeenLastCalledWith('Le 8 juin quatre filles')
  })

  it('appelle onLiveTranscript avec le texte final + interim en temps réel', () => {
    const { FakeSpeechRecognition, instances } = createFakeSpeechRecognitionClass()
    const capture = createSpeechCapture(FakeSpeechRecognition)
    const liveHandler = vi.fn()

    capture.onLiveTranscript(liveHandler)
    capture.start()

    // Résultat interim (pas encore finalisé)
    instances[0].onresult({
      resultIndex: 0,
      results: [{ 0: makeInterimResult('Le 8 juin'), isFinal: false }],
    })
    expect(liveHandler).toHaveBeenCalledWith('Le 8 juin')
  })

  it('transmet les erreurs au gestionnaire enregistré via onError', () => {
    const { FakeSpeechRecognition, instances } = createFakeSpeechRecognitionClass()
    const capture = createSpeechCapture(FakeSpeechRecognition)
    const handler = vi.fn()

    capture.onError(handler)
    capture.start()
    instances[0].onerror({ error: 'no-speech' })

    expect(handler).toHaveBeenCalledWith('no-speech')
  })

  it('appelle le gestionnaire onEnd quand la reconnaissance se termine', () => {
    const { FakeSpeechRecognition, instances } = createFakeSpeechRecognitionClass()
    const capture = createSpeechCapture(FakeSpeechRecognition)
    const handler = vi.fn()

    capture.onEnd(handler)
    capture.start()
    instances[0].onend()

    expect(handler).toHaveBeenCalled()
  })
})
