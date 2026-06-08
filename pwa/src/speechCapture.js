export function createSpeechCapture(SpeechRecognitionImpl) {
  const recognition = new SpeechRecognitionImpl()
  recognition.lang = 'fr-FR'
  recognition.continuous = true
  recognition.interimResults = false

  let transcriptHandler = null
  let errorHandler = null

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0].transcript)
      .join(' ')
    transcriptHandler?.(transcript)
  }

  recognition.onerror = (event) => {
    errorHandler?.(event.error)
  }

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    onTranscript: (handler) => {
      transcriptHandler = handler
    },
    onError: (handler) => {
      errorHandler = handler
    },
  }
}
