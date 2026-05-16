// Minimal Web Speech API declarations (not in lib.dom).

interface SpeechRecognition extends EventTarget {
  lang:           string
  continuous:     boolean
  interimResults: boolean
  start():        void
  stop():         void
  onstart:        ((this: SpeechRecognition, ev: Event) => unknown) | null
  onend:          ((this: SpeechRecognition, ev: Event) => unknown) | null
  onerror:        ((this: SpeechRecognition, ev: Event) => unknown) | null
  onresult:       ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => unknown) | null
}

interface SpeechRecognitionResult {
  readonly length: number
  [index: number]: { transcript: string }
}

interface SpeechRecognitionResultList {
  readonly length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition
  new (): SpeechRecognition
}
