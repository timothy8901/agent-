import { useState, useCallback } from 'react'
import type { PetAppearance } from '../components/PetCanvas'

const STORAGE_KEY = 'pet-appearance'
const STORAGE_NAME = 'pet-name'

const DEFAULT_APPEARANCE: PetAppearance = {
  colorIndex: 0,
  faceIndex:  0,
  earIndex:   0,
}

function load(): PetAppearance {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return DEFAULT_APPEARANCE
}

function loadName(): string {
  return localStorage.getItem(STORAGE_NAME) ?? 'Patti'
}

export const COLOR_NAMES = ['Ember', 'Ocean', 'Forest', 'Cosmic', 'Cherry']
export const FACE_NAMES  = ['Classic', 'Happy', 'Cool', 'Starry', 'Dot']
export const EAR_NAMES   = ['Teardrop', 'Cat', 'Bunny', 'Round', 'Horns']

// Preview colours for swatches
export const COLOR_SWATCHES = ['#FF7043', '#42A5F5', '#66BB6A', '#AB47BC', '#EC407A']

export function usePetAppearance() {
  const [appearance, setAppearance] = useState<PetAppearance>(load)
  const [petName,    setPetNameState] = useState<string>(loadName)

  const setColor = useCallback((colorIndex: number) => {
    setAppearance(prev => {
      const next = { ...prev, colorIndex }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const setFace = useCallback((faceIndex: number) => {
    setAppearance(prev => {
      const next = { ...prev, faceIndex }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const setEar = useCallback((earIndex: number) => {
    setAppearance(prev => {
      const next = { ...prev, earIndex }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const setPetName = useCallback((name: string) => {
    const trimmed = name.trim().slice(0, 20) || 'Patti'
    localStorage.setItem(STORAGE_NAME, trimmed)
    setPetNameState(trimmed)
  }, [])

  return { appearance, petName, setColor, setFace, setEar, setPetName }
}
