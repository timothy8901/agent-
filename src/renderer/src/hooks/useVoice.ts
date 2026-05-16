import { useState, useRef, useCallback, useEffect } from 'react'

export interface VoiceState {
  listening:  boolean
  speaking:   boolean
  supported:  boolean
  ttsEnabled: boolean
}

const SpeechRec =
  (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition })
    .SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition })
    .webkitSpeechRecognition ??
  null

export function useVoice(onTranscript: (text: string) => void) {
  const recRef = useRef<SpeechRecognition | null>(null)

  const [state, setState] = useState<VoiceState>({
    listening:  false,
    speaking:   false,
    supported:  SpeechRec !== null,
    ttsEnabled: false,
  })

  const startListening = useCallback(() => {
    if (!SpeechRec || state.listening) return
    const rec = new SpeechRec()
    rec.lang = 'en-US'
    rec.continuous = false
    rec.interimResults = false

    rec.onstart  = () => setState(prev => ({ ...prev, listening: true }))
    rec.onend    = () => setState(prev => ({ ...prev, listening: false }))
    rec.onerror  = () => setState(prev => ({ ...prev, listening: false }))
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[e.results.length - 1][0].transcript.trim()
      if (text) onTranscript(text)
    }

    recRef.current = rec
    rec.start()
  }, [state.listening, onTranscript])

  const stopListening = useCallback(() => {
    recRef.current?.stop()
    recRef.current = null
    setState(prev => ({ ...prev, listening: false }))
  }, [])

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return
    // Strip markdown symbols before speaking
    const clean = text
      .replace(/```[\s\S]*?```/g, 'code block')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,3} /g, '')
      .replace(/<[^>]+>/g, '')
      .trim()

    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(clean)
    utt.rate = 0.95
    utt.pitch = 1.1
    utt.onstart = () => setState(prev => ({ ...prev, speaking: true }))
    utt.onend   = () => setState(prev => ({ ...prev, speaking: false }))
    utt.onerror = () => setState(prev => ({ ...prev, speaking: false }))
    window.speechSynthesis.speak(utt)
    setState(prev => ({ ...prev, speaking: true }))
  }, [])

  const cancelSpeech = useCallback(() => {
    window.speechSynthesis?.cancel()
    setState(prev => ({ ...prev, speaking: false }))
  }, [])

  const toggleTts = useCallback(() => {
    setState(prev => {
      if (prev.ttsEnabled) window.speechSynthesis?.cancel()
      return { ...prev, ttsEnabled: !prev.ttsEnabled }
    })
  }, [])

  // Cleanup on unmount
  useEffect(() => () => {
    recRef.current?.stop()
    window.speechSynthesis?.cancel()
  }, [])

  return { state, startListening, stopListening, speak, cancelSpeech, toggleTts }
}
