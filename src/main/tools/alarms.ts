// Persisted reminders: file-backed store + Electron notifications.

import { app, Notification } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface Alarm {
  id:      string
  message: string
  fireAt:  number  // epoch ms
}

const timers = new Map<string, NodeJS.Timeout>()
let cache: Alarm[] = []

function storePath(): string {
  return join(app.getPath('userData'), 'alarms.json')
}

function load(): Alarm[] {
  try {
    if (existsSync(storePath())) return JSON.parse(readFileSync(storePath(), 'utf-8'))
  } catch { /* ignore */ }
  return []
}

function persist(alarms: Alarm[]): void {
  try {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(storePath(), JSON.stringify(alarms, null, 2))
  } catch { /* ignore */ }
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function fire(a: Alarm): void {
  try {
    new Notification({ title: 'Patti', body: a.message }).show()
  } catch { /* notifications may not be permitted yet */ }
  cache = cache.filter(x => x.id !== a.id)
  persist(cache)
  timers.delete(a.id)
}

function arm(a: Alarm): void {
  const ms = Math.max(0, a.fireAt - Date.now())
  const t = setTimeout(() => fire(a), ms)
  timers.set(a.id, t)
}

export function initAlarms(): void {
  cache = load()
  const now = Date.now()
  const survivors = cache.filter(a => a.fireAt > now)
  if (survivors.length !== cache.length) {
    cache = survivors
    persist(cache)
  }
  for (const a of cache) arm(a)
}

export function setReminder(args: { message: string; whenMinutes: number }): Alarm {
  const a: Alarm = {
    id:      newId(),
    message: args.message,
    fireAt:  Date.now() + Math.max(0, args.whenMinutes) * 60_000,
  }
  cache.push(a)
  persist(cache)
  arm(a)
  return a
}

export function listReminders(): Alarm[] {
  return cache
    .filter(a => a.fireAt > Date.now())
    .map(a => ({ ...a }))
    .sort((a, b) => a.fireAt - b.fireAt)
}

export function cancelReminder(id: string): { ok: boolean } {
  const t = timers.get(id)
  if (t) clearTimeout(t)
  timers.delete(id)
  const before = cache.length
  cache = cache.filter(a => a.id !== id)
  persist(cache)
  return { ok: cache.length < before }
}
