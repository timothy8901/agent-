// Spotlight-backed file finder. Sandboxed to $HOME so Patti can't list system paths.

import { execFile } from 'child_process'
import { promisify } from 'util'
import { stat } from 'fs/promises'
import { homedir } from 'os'
import { basename } from 'path'

const exec = promisify(execFile)

export interface FoundFile {
  path:       string
  name:       string
  size:       number
  modifiedAt: string  // ISO 8601
}

export async function findFiles(args: { query: string; limit?: number }): Promise<FoundFile[]> {
  const limit = Math.max(1, Math.min(50, args.limit ?? 10))
  const home = homedir()
  if (!args.query?.trim()) return []

  let stdout = ''
  try {
    const out = await exec('mdfind', [args.query, '-onlyin', home], { maxBuffer: 8 * 1024 * 1024 })
    stdout = out.stdout
  } catch {
    return []
  }

  const paths = stdout
    .split('\n')
    .map(p => p.trim())
    .filter(p => p && !basename(p).startsWith('.'))   // skip dotfiles
    .filter(p => !/\/Library\/(Caches|Saved Application State)\//.test(p))
    .slice(0, limit * 2) // over-fetch so we can drop unstatable entries

  const results: FoundFile[] = []
  for (const path of paths) {
    try {
      const s = await stat(path)
      if (!s.isFile()) continue
      results.push({
        path,
        name: basename(path),
        size: s.size,
        modifiedAt: s.mtime.toISOString(),
      })
      if (results.length >= limit) break
    } catch { /* skip */ }
  }

  // Sort newest first
  results.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
  return results
}
