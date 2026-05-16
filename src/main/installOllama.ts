// First-run Ollama installer. Downloads Ollama-darwin.dmg, mounts it,
// copies Ollama.app into /Applications (or ~/Applications on EPERM), launches it,
// then waits for the daemon to be reachable on port 11434.
//
// We never invoke `ollama` from PATH — that triggers the admin-password prompt
// for the /usr/local/bin/ollama symlink. The HTTP API at 11434 is enough.

import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync, statSync, unlinkSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { join } from 'path'
import { app } from 'electron'

const exec = promisify(execFile)

const DMG_URL = 'https://ollama.com/download/Ollama-darwin.dmg'
const DMG_PATH = join(tmpdir(), 'Patti-Ollama.dmg')
const MOUNT_HINT = '/Volumes/Ollama'

import type { InstallProgress } from '../shared/installTypes'
export type { InstallPhase, InstallProgress } from '../shared/installTypes'

export type ProgressCb = (p: InstallProgress) => void

export async function isDaemonReachable(timeoutMs = 2500): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(timeoutMs) })
    return res.ok
  } catch { return false }
}

export function isOllamaInstalled(): boolean {
  return existsSync('/Applications/Ollama.app') || existsSync(join(homedir(), 'Applications', 'Ollama.app'))
}

async function downloadDmg(onProgress: ProgressCb): Promise<void> {
  onProgress({ phase: 'downloading', label: 'Downloading Ollama (~200 MB)…' })
  // -L follows redirects, -f fails on HTTP errors, -s silent
  await exec('curl', ['-L', '-f', '-s', '-o', DMG_PATH, DMG_URL], { maxBuffer: 1024 })
  if (!existsSync(DMG_PATH) || statSync(DMG_PATH).size < 10 * 1024 * 1024) {
    throw new Error('Download failed or file looks too small.')
  }
}

interface MountInfo { mountPoint: string }

async function mountDmg(onProgress: ProgressCb): Promise<MountInfo> {
  onProgress({ phase: 'mounting', label: 'Mounting installer…' })
  const { stdout } = await exec('hdiutil', ['attach', DMG_PATH, '-nobrowse', '-quiet', '-readonly'])
  // hdiutil emits lines like "/dev/disk4s1   Apple_HFS   /Volumes/Ollama"
  for (const line of stdout.split('\n')) {
    const m = line.match(/(\/Volumes\/[^\t]+)/)
    if (m) return { mountPoint: m[1].trim() }
  }
  if (existsSync(MOUNT_HINT)) return { mountPoint: MOUNT_HINT }
  throw new Error('Could not locate mounted Ollama volume.')
}

async function detach(mountPoint: string): Promise<void> {
  try { await exec('hdiutil', ['detach', mountPoint, '-quiet']) } catch { /* ignore */ }
}

async function copyApp(mountPoint: string, onProgress: ProgressCb): Promise<string> {
  onProgress({ phase: 'copying', label: 'Copying Ollama to Applications…' })
  const src = join(mountPoint, 'Ollama.app')
  if (!existsSync(src)) throw new Error('Ollama.app not found inside DMG.')

  // Try /Applications first; fall back to ~/Applications on EPERM
  const dests = ['/Applications', join(homedir(), 'Applications')]
  for (const dest of dests) {
    try {
      await exec('cp', ['-R', src, dest])
      const installed = join(dest, 'Ollama.app')
      // Strip the quarantine attribute so Gatekeeper doesn't re-block
      try { await exec('xattr', ['-dr', 'com.apple.quarantine', installed]) } catch { /* fine if already clean */ }
      return installed
    } catch { /* try next dest */ }
  }
  throw new Error('Could not copy Ollama.app to a writable Applications folder.')
}

async function launch(appPath: string, onProgress: ProgressCb): Promise<void> {
  onProgress({ phase: 'launching', label: 'Launching Ollama…' })
  await exec('open', ['-a', appPath])
}

async function waitForDaemon(onProgress: ProgressCb, timeoutMs = 45_000): Promise<void> {
  onProgress({ phase: 'waiting', label: 'Waiting for Ollama to start…' })
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isDaemonReachable(1500)) return
    await new Promise(r => setTimeout(r, 1000))
  }
  throw new Error('Ollama installed but the daemon did not start within 45s.')
}

export async function installOllama(onProgress: ProgressCb): Promise<void> {
  try {
    if (await isDaemonReachable()) {
      onProgress({ phase: 'done', label: 'Ollama already running.' })
      return
    }

    // If already installed (e.g. user installed it earlier), just launch.
    if (!isOllamaInstalled()) {
      await downloadDmg(onProgress)
      const mount = await mountDmg(onProgress)
      try {
        const installed = await copyApp(mount.mountPoint, onProgress)
        await launch(installed, onProgress)
      } finally {
        await detach(mount.mountPoint)
        try { unlinkSync(DMG_PATH) } catch { /* ignore */ }
      }
    } else {
      const installed = existsSync('/Applications/Ollama.app')
        ? '/Applications/Ollama.app'
        : join(homedir(), 'Applications', 'Ollama.app')
      await launch(installed, onProgress)
    }

    await waitForDaemon(onProgress)
    onProgress({ phase: 'done', label: 'Ollama is ready.' })
    void app  // silence unused import in case of future tree-shaking
  } catch (err) {
    onProgress({ phase: 'error', label: 'Install failed', error: (err as Error).message })
    throw err
  }
}
