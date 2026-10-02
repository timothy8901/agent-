import { atom, read, update } from 'claude-code'
import type { AgentInfo, EngineInterface, Register, Timer } from 'claude-code'

import type { AgentPhase, AgentRecord, BarRow, BarsProps } from '../types'

const COMMAND = 'loading-agents-bar'
/** Where the on/off choice is kept across sessions. */
const STORE_KEY = 'isEnabled'

/** How often the band reconciles with `$.agent.list()` and ticks its clock. */
const POLL_MS = 1000
/** While no bar is up, only every third tick asks for the list. */
const IDLE_POLLS = 3
/** How long a finished bar stays up, full, before it leaves. */
const LINGER_MS = 4000
/** A working agent `$.agent.list()` never names is let go after this. */
const UNLISTED_MS = 15_000
/** Rows the band draws at most; the rest fold into a "+N more" row. */
const MAX_ROWS = 12
/** Agents remembered, so a finished one (an idle teammate) is not drawn again. */
const MAX_RECORDS = 64

const PALETTE = [
  '#4f8cff', // blue
  '#2ecc71', // green
  '#f5a623', // amber
  '#b06cff', // violet
  '#1fc8db', // cyan
  '#ff6fb5', // pink
  '#a3d94a', // lime
  '#ff8a4c', // orange
  '#7c83ff', // indigo
  '#2bd4a4', // teal
] as const
const FAILED_COLOR = '#e5484d'
const STOPPED_COLOR = '#8b8d98'

const AGENTS = { plugin: 'loading-agents-bar', key: 'agents' } as const
const NOW = { plugin: 'loading-agents-bar', key: 'now' } as const

const isEnabled = atom({ plugin: 'loading-agents-bar', key: 'isEnabled' } as const, true)
const agents = atom(AGENTS, [])
const now = atom(NOW, 0)

/** What the band learns of an agent before its run is counted. */
type Seed = Pick<AgentRecord, 'id' | 'type' | 'name' | 'description' | 'parentId'>

let poller: Timer | undefined
let isPolling = false
let idlePolls = 0
let wasShowing = false
let wantsPoll = false

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    poller?.cancel()
    poller = $.clock.every(POLL_MS, () => void poll($, false))
    await safely($, () =>
      $.command.register({
        name: COMMAND,
        description: 'Toggle stacked loading bars for working agents above the prompt',
        argumentHint: '[on|off]',
        // Agents work while a turn runs: the toggle should not wait for it.
        immediate: true,
      }),
    )
    await safely($, async () => {
      const stored = await $.store.get(STORE_KEY)
      if (typeof stored === 'boolean') {
        await update($, isEnabled, () => stored)
      }
    })

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await safely($, () => mutate($, () => []))
    }

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const wasOn = await read($, isEnabled)
    const isOn =
      arg === 'on' ? true : arg === 'off' ? false : arg === '' || arg === 'toggle' ? !wasOn : undefined

    if (isOn === undefined) {
      return { text: `Usage: /${COMMAND} [on|off] (no argument toggles)` }
    }

    await update($, isEnabled, () => isOn)
    await safely($, () => $.store.set(STORE_KEY, isOn))

    if (!isOn) {
      return { text: `Agent loading bars off. Run /${COMMAND} to show them again.` }
    }

    await poll($, true)
    const working = (await read($, agents)).filter(record => record.phase === 'working').length

    return {
      text:
        'Agent loading bars on: one colored bar per working agent, stacked above the prompt' +
        (working > 0 ? ` (${working} working now).` : '.'),
    }
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    const id = started.agentId

    if (id !== undefined) {
      const seed: Seed = {
        id,
        type: e.subagentType,
        name: e.name ?? '',
        description: e.description,
        parentId: e.parentAgentId ?? '',
      }
      await safely($, async () => {
        const t = await $.clock.now()
        await mutate($, records => spawned(records, seed, t))
      })
    }

    return started
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId

    if (id === undefined) {
      return next(e)
    }
    const tool = shortTool(String(e.tool))
    // The tool starts at once; the count lands beside it, never ahead of it.
    const [ran] = await Promise.all([
      next(e),
      safely($, async () => {
        if (!(await read($, agents)).some(record => record.id === id)) {
          // Not one the band knows yet (a teammate): the next tick lists it.
          wantsPoll = true

          return
        }
        const t = await $.clock.now()
        await mutate($, records => toolCalled(records, id, tool, t))
      }),
    ])

    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId

    if (id === undefined) {
      return next(e)
    }
    const phase: AgentPhase = e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'stopped' : 'failed'
    const [completed] = await Promise.all([
      next(e),
      safely($, async () => {
        const t = await $.clock.now()
        await mutate($, records => finished(records, record => record.id === id, phase, t))
      }),
    ])

    return completed
  })

  on('classic.TeammateIdle', async ($, e, next) => {
    const name = e.teammate_name
    const [answered] = await Promise.all([
      next(e),
      safely($, async () => {
        const t = await $.clock.now()
        await mutate($, records => finished(records, record => record.name !== '' && record.name === name, 'done', t))
      }),
    ])

    return answered
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') {
      return next(e)
    }
    if (e.props.hasSurvey || !(await read($, isEnabled))) {
      return next(e)
    }

    // Read so the poller's tick draws the band again; the time drawn is now.
    await read($, now)
    const records = await read($, agents)
    const t = await $.clock.now()
    const ordered = treeOrder(records.filter(record => isShown(record, t)))

    if (ordered.length === 0) {
      return next(e)
    }

    const room = Math.max(1, Math.min(MAX_ROWS, e.props.maxRows))
    const drawn = ordered.length > room ? ordered.slice(0, Math.max(1, room - 1)) : ordered
    const props: BarsProps = {
      rows: drawn.map(({ record, depth }) => toRow(record, depth, t, e.props.view.agentId)),
      more: ordered.length - drawn.length,
      columns: e.props.bodyColumns,
    }
    const { Box, Client } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Client
          key="bars"
          module="./bars.tsx"
          props={props}
          width={e.props.bodyColumns}
          height={props.rows.length + (props.more > 0 ? 1 : 0)}
        />
      </Box>
    )
  })
}

/**
 * One tick: reconcile with the agents the engine lists, and move the band's
 * clock on while a bar is up (so elapsed times count and lingering bars go).
 */
async function poll($: EngineInterface, isForced: boolean): Promise<void> {
  if (isPolling) {
    return
  }
  isPolling = true
  try {
    if (!(await read($, isEnabled))) {
      return
    }
    const t = await $.clock.now()
    const isShowing = (await read($, agents)).some(record => isShown(record, t))
    idlePolls = isShowing ? 0 : idlePolls + 1
    if (isForced || isShowing || wasShowing || wantsPoll || idlePolls % IDLE_POLLS === 0) {
      wantsPoll = false
      const infos = await $.agent.list()
      await mutate($, records => reconcile(records, infos, t))
    }
    const isStillShowing = (await read($, agents)).some(record => isShown(record, t))
    if (isShowing || isStillShowing || wasShowing) {
      await $.state.set(NOW, t)
    }
    wasShowing = isStillShowing
  } catch (error) {
    $.ui.log(`${COMMAND}: poll failed: ${describe(error)}`, { to: 'debug' })
  } finally {
    isPolling = false
  }
}

/**
 * Applies `change` to the agents and writes the result unless it changed
 * nothing, again on a version miss, so idle ticks never redraw the band.
 */
async function mutate(
  $: EngineInterface,
  change: (records: readonly AgentRecord[]) => AgentRecord[],
): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const held = await $.state.get(AGENTS)
    const before = held.value ?? []
    const after = change(before)
    if (JSON.stringify(after) === JSON.stringify(before)) {
      return
    }
    const { isSet } = await $.state.set(AGENTS, after, { ifVersion: held.version })
    if (isSet) {
      return
    }
  }
}

async function safely($: EngineInterface, work: () => Promise<unknown>): Promise<void> {
  try {
    await work()
  } catch (error) {
    $.ui.log(`${COMMAND}: ${describe(error)}`, { to: 'debug' })
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function reconcile(
  records: readonly AgentRecord[],
  infos: readonly AgentInfo[],
  t: number,
): AgentRecord[] {
  const listed = new Map(infos.map(info => [info.id, info]))
  const next = records.map(record => {
    const info = listed.get(record.id)
    if (info === undefined) {
      return record.phase === 'working' && t - record.seenAt > UNLISTED_MS
        ? finish(record, 'done', t)
        : record
    }
    const known: AgentRecord = {
      ...record,
      type: record.type || info.type,
      name: record.name || (info.name ?? ''),
      description: record.description || info.description,
      parentId: record.parentId || (info.parentId ?? ''),
    }
    // A finished agent comes back on its next tool call or spawn, never on
    // a listing alone: an idle teammate can stay listed as running.
    if (known.phase !== 'working' || isRunning(info.status)) {
      return known
    }

    return finish(known, phaseOfStatus(info.status), t)
  })
  const known = new Set(records.map(record => record.id))
  for (const info of infos) {
    if (!known.has(info.id) && isRunning(info.status)) {
      const seed: Seed = {
        id: info.id,
        type: info.type,
        name: info.name ?? '',
        description: info.description,
        parentId: info.parentId ?? '',
      }
      next.push(begin(seed, next, t))
    }
  }

  return prune(next)
}

export function spawned(records: readonly AgentRecord[], seed: Seed, t: number): AgentRecord[] {
  const existing = records.find(record => record.id === seed.id)
  if (existing === undefined) {
    return prune([...records, begin(seed, records, t)])
  }

  return records.map(record =>
    record.id === seed.id ? revive({ ...record, ...filled(seed) }, records, t) : record,
  )
}

export function toolCalled(
  records: readonly AgentRecord[],
  id: string,
  tool: string,
  t: number,
): AgentRecord[] {
  return records.map(record => {
    if (record.id !== id) {
      return record
    }
    const live = revive(record, records, t)

    return { ...live, tools: live.tools + 1, activity: tool, seenAt: t }
  })
}

export function finished(
  records: readonly AgentRecord[],
  isIt: (record: AgentRecord) => boolean,
  phase: AgentPhase,
  t: number,
): AgentRecord[] {
  return records.map(record => (record.phase === 'working' && isIt(record) ? finish(record, phase, t) : record))
}

function begin(seed: Seed, records: readonly AgentRecord[], t: number): AgentRecord {
  return {
    ...seed,
    color: freeColor(records, t, -1),
    startedAt: t,
    seenAt: t,
    tools: 0,
    activity: '',
    phase: 'working',
    endedAt: 0,
  }
}

/** A finished agent working again: a new run, its old color if still free. */
function revive(record: AgentRecord, records: readonly AgentRecord[], t: number): AgentRecord {
  if (record.phase === 'working') {
    return { ...record, seenAt: t }
  }
  const others = records.filter(other => other.id !== record.id)

  return {
    ...record,
    color: freeColor(others, t, record.color),
    startedAt: t,
    seenAt: t,
    tools: 0,
    activity: '',
    phase: 'working',
    endedAt: 0,
  }
}

function finish(record: AgentRecord, phase: AgentPhase, t: number): AgentRecord {
  return { ...record, phase, endedAt: t }
}

/** The seed's fields that say something, to lay over what is known. */
function filled(seed: Seed): Partial<Seed> {
  return Object.fromEntries(Object.entries(seed).filter(([, value]) => value !== '')) as Partial<Seed>
}

/** The lowest palette slot no bar on screen holds, `preferred` when free. */
function freeColor(records: readonly AgentRecord[], t: number, preferred: number): number {
  const taken = new Set(records.filter(record => isShown(record, t)).map(record => record.color))
  if (preferred >= 0 && !taken.has(preferred)) {
    return preferred
  }
  for (let slot = 0; slot < PALETTE.length; slot += 1) {
    if (!taken.has(slot)) {
      return slot
    }
  }

  return taken.size % PALETTE.length
}

/** Forgets the longest-finished agents past MAX_RECORDS. */
function prune(records: AgentRecord[]): AgentRecord[] {
  const extra = records.length - MAX_RECORDS
  if (extra <= 0) {
    return records
  }
  const gone = new Set(
    records
      .filter(record => record.phase !== 'working')
      .sort((a, b) => a.endedAt - b.endedAt)
      .slice(0, extra)
      .map(record => record.id),
  )

  return records.filter(record => !gone.has(record.id))
}

export function isShown(record: AgentRecord, t: number): boolean {
  return record.phase === 'working' || t - record.endedAt < LINGER_MS
}

function isRunning(status: string): boolean {
  return status === 'running' || status === 'pending'
}

function phaseOfStatus(status: string): AgentPhase {
  if (/fail|error/i.test(status)) {
    return 'failed'
  }
  if (/kill|stop|cancel|abort/i.test(status)) {
    return 'stopped'
  }

  return 'done'
}

/** Oldest first, each agent's children right under it. */
export function treeOrder(shown: readonly AgentRecord[]): Array<{ record: AgentRecord; depth: number }> {
  const ids = new Set(shown.map(record => record.id))
  const children = new Map<string, AgentRecord[]>()
  const roots: AgentRecord[] = []
  for (const record of [...shown].sort((a, b) => a.startedAt - b.startedAt)) {
    if (record.parentId !== '' && record.parentId !== record.id && ids.has(record.parentId)) {
      children.set(record.parentId, [...(children.get(record.parentId) ?? []), record])
    } else {
      roots.push(record)
    }
  }
  const ordered: Array<{ record: AgentRecord; depth: number }> = []
  const visited = new Set<string>()
  const walk = (record: AgentRecord, depth: number): void => {
    if (visited.has(record.id)) {
      return
    }
    visited.add(record.id)
    ordered.push({ record, depth })
    for (const child of children.get(record.id) ?? []) {
      walk(child, depth + 1)
    }
  }
  roots.forEach(root => walk(root, 0))
  // A parent cycle has no root; draw what the walk missed at the top level.
  shown.forEach(record => walk(record, 0))

  return ordered
}

export function toRow(
  record: AgentRecord,
  depth: number,
  t: number,
  viewAgentId: string | undefined,
): BarRow {
  const color =
    record.phase === 'failed'
      ? FAILED_COLOR
      : record.phase === 'stopped'
        ? STOPPED_COLOR
        : (PALETTE[record.color % PALETTE.length] ?? PALETTE[0])
  const end = record.phase === 'working' ? t : record.endedAt

  return {
    id: record.id,
    label: labelOf(record),
    depth,
    color,
    mid: mix(color, '#ffffff', 0.35),
    glow: mix(color, '#ffffff', 0.7),
    fill: fillOf(record, t),
    phase: record.phase,
    activity: record.activity,
    tools: record.tools,
    elapsed: formatElapsed(end - record.startedAt),
    isInView: viewAgentId === record.id,
  }
}

/**
 * How full a bar is: no agent knows its own total, so a working bar trickles
 * toward 95% as time passes and tool calls land, the way a page-load bar
 * does, and fills the rest the moment the agent is done.
 */
export function fillOf(record: AgentRecord, t: number): number {
  if (record.phase === 'done') {
    return 1
  }
  const end = record.phase === 'working' ? t : record.endedAt
  const work = Math.max(0, end - record.startedAt) / 45_000 + record.tools / 8

  return Math.min(0.95, 0.04 + 0.91 * (1 - Math.exp(-work / 2.5)))
}

export function labelOf(record: AgentRecord): string {
  const who =
    record.name !== ''
      ? record.name
      : record.type === '' || record.type === 'general-purpose'
        ? 'agent'
        : record.type
  const what = record.description.replace(/\s+/g, ' ').trim()

  return what === '' || what === who ? who : `${who} · ${what}`
}

export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m${String(seconds % 60).padStart(2, '0')}s`
  }

  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`
}

/** `mcp__github__get_me` reads as `get_me`; built-in names stay. */
function shortTool(tool: string): string {
  if (!tool.startsWith('mcp__')) {
    return tool
  }

  return tool.split('__').slice(2).join('__') || tool
}

function mix(hex: string, toward: string, amount: number): string {
  const from = channels(hex)
  const to = channels(toward)

  return `#${from
    .map((value, index) => Math.round(value + ((to[index] ?? value) - value) * amount))
    .map(value => value.toString(16).padStart(2, '0'))
    .join('')}`
}

function channels(hex: string): number[] {
  const value = Number.parseInt(hex.slice(1), 16)

  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}
