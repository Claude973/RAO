export function createSpeechCapture(SpeechRecognitionImpl) {
  const recognition = new SpeechRecognitionImpl()
  recognition.lang = 'fr-FR'
  recognition.continuous = true
  recognition.interimResults = true

  let transcriptHandler = null
  let liveHandler = null
  let errorHandler = null
  let endHandler = null
  let accumulatedFinal = ''

  recognition.onresult = (event) => {
    let newFinal = ''
    let interim = ''

    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        newFinal += event.results[i][0].transcript
      } else {
        interim += event.results[i][0].transcript
      }
    }

    if (newFinal) {
      accumulatedFinal = (accumulatedFinal + ' ' + newFinal).trim()
      transcriptHandler?.(accumulatedFinal)
    }

    liveHandler?.((accumulatedFinal + ' ' + interim).trim())
  }

  recognition.onerror = (event) => {
    errorHandler?.(event.error)
  }

  recognition.onend = () => {
    endHandler?.()
  }

  return {
    start: () => {
      accumulatedFinal = ''
      recognition.start()
    },
    stop: () => recognition.stop(),
    onTranscript: (handler) => { transcriptHandler = handler },
    onLiveTranscript: (handler) => { liveHandler = handler },
    onError: (handler) => { errorHandler = handler },
    onEnd: (handler) => { endHandler = handler },
  }
}
