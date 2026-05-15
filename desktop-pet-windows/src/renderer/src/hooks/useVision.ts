import { useState, useRef, useCallback, useEffect } from 'react'

export interface VisionState {
  active:       boolean
  motionLevel:  number   // 0-100
  lastReaction: string
  isAnalyzing:  boolean
  error:        string | null
}

const MOTION_THRESHOLD = 18  // pixel diff per channel to count as motion
const MOTION_COOLDOWN  = 4000 // ms between motion reactions

export function useVision(ollamaBaseUrl: string, onMotion?: () => void) {
  const videoRef         = useRef<HTMLVideoElement | null>(null)
  const hiddenCanvas     = useRef<HTMLCanvasElement | null>(null)
  const prevFrameData    = useRef<Uint8ClampedArray | null>(null)
  const motionCooldown   = useRef(false)
  const rafId            = useRef<number>(0)
  const streamRef        = useRef<MediaStream | null>(null)

  const [state, setState] = useState<VisionState>({
    active:       false,
    motionLevel:  0,
    lastReaction: '',
    isAnalyzing:  false,
    error:        null,
  })

  // ── Motion detection loop ────────────────────────────────────────────
  const detectMotion = useCallback(() => {
    const video  = videoRef.current
    const canvas = hiddenCanvas.current
    if (!video || !canvas || video.readyState < 2) {
      rafId.current = requestAnimationFrame(detectMotion)
      return
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    canvas.width  = 64   // small for performance
    canvas.height = 48
    ctx.drawImage(video, 0, 0, 64, 48)
    const frame = ctx.getImageData(0, 0, 64, 48).data

    if (prevFrameData.current) {
      let diff = 0
      for (let i = 0; i < frame.length; i += 4) {
        diff += Math.abs(frame[i]   - prevFrameData.current[i])
               + Math.abs(frame[i+1] - prevFrameData.current[i+1])
               + Math.abs(frame[i+2] - prevFrameData.current[i+2])
      }
      const avgDiff = diff / (frame.length / 4 * 3)
      const motionLevel = Math.min(100, Math.round(avgDiff / MOTION_THRESHOLD * 100))

      setState(prev => ({ ...prev, motionLevel }))

      if (motionLevel > 30 && !motionCooldown.current) {
        motionCooldown.current = true
        onMotion?.()
        setTimeout(() => { motionCooldown.current = false }, MOTION_COOLDOWN)
      }
    }

    prevFrameData.current = new Uint8ClampedArray(frame)
    rafId.current = requestAnimationFrame(detectMotion)
  }, [onMotion])

  // ── Start camera ─────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      if (!hiddenCanvas.current) {
        hiddenCanvas.current = document.createElement('canvas')
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' }
      })
      streamRef.current = stream

      const video = document.createElement('video')
      video.srcObject = stream
      video.playsInline = true
      video.muted = true
      await video.play()
      videoRef.current = video

      setState(prev => ({ ...prev, active: true, error: null }))
      rafId.current = requestAnimationFrame(detectMotion)
    } catch (err) {
      setState(prev => ({ ...prev, error: (err as Error).message }))
    }
  }, [detectMotion])

  // ── Stop camera ──────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafId.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    videoRef.current  = null
    prevFrameData.current = null
    setState(prev => ({ ...prev, active: false, motionLevel: 0 }))
  }, [])

  // ── Capture frame → base64 ───────────────────────────────────────────
  const captureFrame = useCallback((): string | null => {
    const video  = videoRef.current
    const canvas = hiddenCanvas.current
    if (!video || !canvas) return null
    canvas.width  = 320
    canvas.height = 240
    canvas.getContext('2d')!.drawImage(video, 0, 0, 320, 240)
    return canvas.toDataURL('image/jpeg', 0.7).split(',')[1] // base64 only
  }, [])

  // ── Ask Ollama vision model what it sees ─────────────────────────────
  const analyzeFrame = useCallback(async (petName: string) => {
    const b64 = captureFrame()
    if (!b64) return

    setState(prev => ({ ...prev, isAnalyzing: true, lastReaction: '' }))

    // Try to find an available vision model
    let visionModel: string | null = null
    try {
      const tagsRes = await fetch(`${ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
      if (tagsRes.ok) {
        const tags = await tagsRes.json() as { models: { name: string }[] }
        const models = tags.models?.map(m => m.name) ?? []
        visionModel =
          models.find(m => m.startsWith('moondream')) ??
          models.find(m => m.startsWith('llava')) ??
          models.find(m => /vl|vision/i.test(m)) ??
          null
      }
    } catch { /* offline */ }

    if (!visionModel) {
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        lastReaction: "I wish I could see you! Install a vision model: ollama pull moondream"
      }))
      return
    }

    try {
      const res = await fetch(`${ollamaBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          model:  visionModel,
          prompt: `You are ${petName}, a cute desktop pet. Look at this image and react naturally in 1-2 short sentences. Be expressive and playful!`,
          images: [b64],
          stream: false
        })
      })
      if (res.ok) {
        const data = await res.json() as { response: string }
        setState(prev => ({ ...prev, isAnalyzing: false, lastReaction: data.response?.trim() ?? '' }))
      } else {
        throw new Error(`HTTP ${res.status}`)
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        lastReaction: `Couldn't analyze: ${(err as Error).message}`
      }))
    }
  }, [captureFrame, ollamaBaseUrl])

  // Cleanup on unmount
  useEffect(() => () => { stopCamera() }, [stopCamera])

  return { state, videoRef, startCamera, stopCamera, analyzeFrame }
}
