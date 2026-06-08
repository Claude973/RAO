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

describe('createSpeechCapture', () => {
  it('configure la reconnaissance en français, en écoute continue, et la démarre', () => {
    const { FakeSpeechRecognition, instances } = createFakeSpeechRecognitionClass()
    const capture = createSpeechCapture(FakeSpeechRecognition)

    capture.start()

    expect(instances[0].lang).toBe('fr-FR')
    expect(instances[0].continuous).toBe(true)
    expect(instances[0].interimResults).toBe(false)
    expect(instances[0].startCalls).toBe(1)
  })

  it('arrête la reconnaissance en cours', () => {
    const { FakeSpeechRecognition, instances } = createFakeSpeechRecognitionClass()
    const capture = createSpeechCapture(FakeSpeechRecognition)

    capture.start()
    capture.stop()

    expect(instances[0].stopCalls).toBe(1)
  })

  it('transmet le texte transcrit au gestionnaire enregistré via onTranscript', () => {
    const { FakeSpeechRecognition, instances } = createFakeSpeechRecognitionClass()
    const capture = createSpeechCapture(FakeSpeechRecognition)
    const handler = vi.fn()

    capture.onTranscript(handler)
    capture.start()
    instances[0].onresult({
      results: [[{ transcript: 'Le 8 juin 2026' }], [{ transcript: 'quatre filles' }]],
    })

    expect(handler).toHaveBeenCalledWith('Le 8 juin 2026 quatre filles')
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
})
