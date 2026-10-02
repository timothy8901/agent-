import { describe, expect, mock, test } from 'claude-code/testing'
import type { AgentInfo, AgentSpawnInput, CommandRunInput, On, RenderPropsOf, TurnCompleteInput } from 'claude-code'

import { fillOf, formatElapsed, reconcile, toolCalled, treeOrder } from '../hooks/register'
import type { AgentRecord } from '../types'

const PLUGIN = 'loading-agents-bar'
const T0 = 1_000_000
const SURFACES = ['terminal', 'desktop'] as const

const BAND: RenderPropsOf['AbovePrompt'] = {
  hasSurvey: false,
  isWorking: true,
  maxRows: 10,
  bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
}

/** The engine beneath the plugin: a clock, a store, and agents as listed. */
function engine(on: On, listed: () => AgentInfo[], stored: Record<string, unknown> = {}) {
  const clock = mock.clock(on, { now: T0 })
  mock.store(on, stored)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('agent.list', () => ({ value: listed() }))
  on('agent.spawn', ($, e) => ({ model: 'test-model', agentId: idOf(e.description) }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('classic.TeammateIdle', () => ({}))
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box' }))
  on('ui.log', () => ({ value: undefined }))

  return clock
}

function idOf(description: string): string {
  return `agent-${description.toLowerCase().replace(/\W+/g, '-')}`
}

function spawn(description: string, subagentType: string): AgentSpawnInput {
  return {
    tool_use_id: `toolu-${idOf(description)}`,
    prompt: `Please: ${description}`,
    description,
    subagentType,
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'test-model',
    background: true,
    fork: false,
  }
}

function listing(description: string, type: string, status: string): AgentInfo {
  return { id: idOf(description), description, type, status }
}

function completed(agentId: string, reason: 'answer' | 'aborted' | 'error' = 'answer'): TurnCompleteInput {
  return { answer: 'ok', durationMs: 1000, isAborted: reason === 'aborted', turnId: `turn-${agentId}`, agentId, reason }
}

function command(args: string): CommandRunInput {
  return { command: PLUGIN, args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } }
}

function record(id: string, fields: Partial<AgentRecord> = {}): AgentRecord {
  return {
    id,
    type: 'Explore',
    name: '',
    description: id,
    parentId: '',
    color: 0,
    startedAt: T0,
    seenAt: T0,
    tools: 0,
    activity: '',
    phase: 'working',
    endedAt: 0,
    ...fields,
  }
}

type Drawing = { findAll: (query: { type?: string; in?: string }) => Promise<Array<{ text: string; props: Record<string, unknown> }>> }

/** The rows' marks, by glyph: ● working, ✓ done, ✗ failed, ■ stopped. */
async function marks(ui: Drawing, glyph: string) {
  return (await ui.findAll({ type: 'Text', in: 'bars' })).filter(found => found.text === glyph)
}

describe('the band', () => {
  test('draws one colored bar per working agent, stacked, on the terminal and the desktop', async ($, on) => {
    let listed: AgentInfo[] = []
    engine(on, () => listed)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.agent.spawn(spawn('Find auth handlers', 'Explore'))
    await $.agent.spawn(spawn('Write the tests', 'general-purpose'))
    listed = [listing('Find auth handlers', 'Explore', 'running'), listing('Write the tests', 'general-purpose', 'running')]

    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: BAND, viewport: { columns: 120, rows: 40 } })
      expect(await ui.find({ type: 'Client', key: 'bars' })).toBeDefined()
      const working = await marks(ui, '●')
      expect(working).toHaveLength(2)
      expect(working[0]?.props.color).not.toBe(working[1]?.props.color)
      expect(await ui.find({ type: 'Text', text: /Explore · Find auth handlers/, in: 'bars' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /agent · Write the tests/, in: 'bars' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /starting · 0 tools · 0s/, in: 'bars' })).toBeDefined()
      await ui.unmount()
    }
  })

  test('animates the shimmer on the frame clock, and counts time between ticks', async ($, on) => {
    const listed = [listing('Refactor the parser', 'general-purpose', 'running')]
    const clock = engine(on, () => listed)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.agent.spawn(spawn('Refactor the parser', 'general-purpose'))
    await clock.advance(90_000)

    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: BAND, viewport: { columns: 120, rows: 40 } })
      expect(await ui.find({ type: 'Text', text: /1m30s/, in: 'bars' })).toBeDefined()
      const before = JSON.stringify(await ui.drawn({ in: 'bars' }))
      await ui.advance(300)
      expect(JSON.stringify(await ui.drawn({ in: 'bars' }))).not.toBe(before)
      await ui.unmount()
    }
  })

  test('fills a finished bar, marks it, then lets it go', async ($, on) => {
    let listed: AgentInfo[] = []
    const clock = engine(on, () => listed)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.agent.spawn(spawn('Find auth handlers', 'Explore'))
    await $.agent.spawn(spawn('Write the tests', 'general-purpose'))
    await $.agent.spawn(spawn('Lint everything', 'general-purpose'))
    listed = [
      listing('Find auth handlers', 'Explore', 'completed'),
      listing('Write the tests', 'general-purpose', 'running'),
      listing('Lint everything', 'general-purpose', 'running'),
    ]
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND, viewport: { columns: 120, rows: 40 } })

    await $.turn.complete(completed(idOf('Find auth handlers')))
    await $.turn.complete(completed(idOf('Lint everything'), 'error'))
    expect(await marks(ui, '✓')).toHaveLength(1)
    expect(await marks(ui, '✗')).toHaveLength(1)
    expect(await marks(ui, '●')).toHaveLength(1)
    expect(await ui.find({ type: 'Text', text: /done · 0 tools/, in: 'bars' })).toBeDefined()

    await clock.advance(5000)
    expect(await marks(ui, '✓')).toHaveLength(0)
    expect(await marks(ui, '✗')).toHaveLength(0)
    expect(await marks(ui, '●')).toHaveLength(1)
    expect(await ui.find({ type: 'Text', text: /Write the tests/, in: 'bars' })).toBeDefined()
  })

  test('draws nothing once no agent works', async ($, on) => {
    const clock = engine(on, () => [listing('Find auth handlers', 'Explore', 'completed')])
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.agent.spawn(spawn('Find auth handlers', 'Explore'))
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: BAND, viewport: { columns: 120, rows: 40 } })
    expect(await ui.find({ type: 'Client' })).toBeDefined()

    await clock.advance(6000)
    expect(await ui.find({ type: 'Client' })).toBeUndefined()
  })

  test('yields the band to a survey', async ($, on) => {
    engine(on, () => [])
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.agent.spawn(spawn('Find auth handlers', 'Explore'))
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, hasSurvey: true } })
    expect(await ui.find({ type: 'Client' })).toBeUndefined()
  })

  test('shows a teammate while it works and not after it goes idle', async ($, on) => {
    const listed = [{ id: 'mate-1', description: 'Review the API', type: 'teammate', status: 'running', name: 'alice' }]
    const clock = engine(on, () => listed)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await clock.advance(3000)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND, viewport: { columns: 120, rows: 40 } })
    expect(await ui.find({ type: 'Text', text: /alice · Review the API/, in: 'bars' })).toBeDefined()

    await $.classic.TeammateIdle({ teammate_name: 'alice', team_name: 'team' })
    expect(await marks(ui, '✓')).toHaveLength(1)
    await clock.advance(10_000)
    // Still listed as running while idle: the band does not draw it again.
    expect(await ui.find({ type: 'Client' })).toBeUndefined()
  })
})

describe('the hooks it rides on', () => {
  test('pass tool calls and turn ends through as the engine answers them', async ($, on) => {
    engine(on, () => [])
    on('tool.call', () => ({ result: { stdout: 'hi', stderr: '' }, text: 'hi' }))
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    expect(await $.tool.call({ tool: 'Bash', command: 'echo hi' })).toMatchObject({ text: 'hi' })
    expect(await $.turn.complete(completed('agent-nobody'))).toMatchObject({ text: 'ok' })
    expect(await $.turn.complete({ ...completed('main'), agentId: undefined })).toMatchObject({ text: 'ok' })
  })
})

describe('/loading-agents-bar', () => {
  test('toggles the band off and on, and takes on and off', async ($, on) => {
    engine(on, () => [listing('Find auth handlers', 'Explore', 'running')])
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.agent.spawn(spawn('Find auth handlers', 'Explore'))
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND, viewport: { columns: 120, rows: 40 } })
    expect(await ui.find({ type: 'Client' })).toBeDefined()

    const off = await $.command.run(command(''))
    expect(off.text).toMatch(/bars off/)
    expect(await ui.find({ type: 'Client' })).toBeUndefined()

    const back = await $.command.run(command(''))
    expect(back.text).toMatch(/bars on.*1 working now/)
    expect(await ui.find({ type: 'Client' })).toBeDefined()

    expect((await $.command.run(command('on'))).text).toMatch(/bars on/)
    expect((await $.command.run(command('OFF'))).text).toMatch(/bars off/)
    expect((await $.command.run(command('sideways'))).text).toMatch(/Usage/)
  })

  test('keeps the choice across sessions', async ($, on) => {
    engine(on, () => [listing('Find auth handlers', 'Explore', 'running')], { isEnabled: false })
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.agent.spawn(spawn('Find auth handlers', 'Explore'))
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND, viewport: { columns: 120, rows: 40 } })
    expect(await ui.find({ type: 'Client' })).toBeUndefined()
  })
})

describe('the bookkeeping', () => {
  test('reconcile adds listed working agents and settles finished ones', async () => {
    const records = [record('a'), record('b'), record('c'), record('d', { phase: 'done', endedAt: T0 })]
    const infos: AgentInfo[] = [
      { id: 'a', description: 'a', type: 'Explore', status: 'completed' },
      { id: 'b', description: 'b', type: 'Explore', status: 'failed' },
      { id: 'c', description: 'c', type: 'Explore', status: 'killed' },
      { id: 'd', description: 'd', type: 'Explore', status: 'running' },
      { id: 'e', description: 'new one', type: 'Plan', status: 'running', parentId: 'a' },
    ]
    const next = reconcile(records, infos, T0 + 500)
    expect(next.map(one => [one.id, one.phase])).toEqual([
      ['a', 'done'],
      ['b', 'failed'],
      ['c', 'stopped'],
      ['d', 'done'],
      ['e', 'working'],
    ])
    expect(next[4]).toMatchObject({ type: 'Plan', description: 'new one', parentId: 'a', startedAt: T0 + 500 })
  })

  test('reconcile lets go of a working agent no listing names', async () => {
    expect(reconcile([record('ghost')], [], T0 + 5000)[0]?.phase).toBe('working')
    expect(reconcile([record('ghost')], [], T0 + 20_000)[0]?.phase).toBe('done')
  })

  test('a tool call counts, and brings a finished agent back as a new run', async () => {
    const counted = toolCalled([record('a', { tools: 2 })], 'a', 'Bash', T0 + 10)
    expect(counted[0]).toMatchObject({ tools: 3, activity: 'Bash', phase: 'working' })

    const back = toolCalled([record('a', { phase: 'done', endedAt: T0, tools: 9 })], 'a', 'Read', T0 + 60_000)
    expect(back[0]).toMatchObject({ tools: 1, activity: 'Read', phase: 'working', startedAt: T0 + 60_000, endedAt: 0 })
  })

  test('the fill trickles toward 95% and fills on done', async () => {
    const early = fillOf(record('a'), T0 + 5000)
    const later = fillOf(record('a', { tools: 20 }), T0 + 120_000)
    const latest = fillOf(record('a', { tools: 200 }), T0 + 3_600_000)
    expect(early).toBeGreaterThan(0)
    expect(later).toBeGreaterThan(early)
    expect(latest).toBeGreaterThan(later)
    expect(latest).toBeLessThanOrEqual(0.95)
    expect(fillOf(record('a', { phase: 'done', endedAt: T0 + 1 }), T0 + 2)).toBe(1)
  })

  test('elapsed times read short', async () => {
    expect(formatElapsed(4_200)).toBe('4s')
    expect(formatElapsed(64_000)).toBe('1m04s')
    expect(formatElapsed(3_720_000)).toBe('1h02m')
    expect(formatElapsed(-5)).toBe('0s')
  })

  test('children stack under the agent that spawned them', async () => {
    const ordered = treeOrder([
      record('child', { parentId: 'root', startedAt: T0 + 2 }),
      record('root', { startedAt: T0 }),
      record('other', { startedAt: T0 + 1 }),
    ])
    expect(ordered.map(({ record: one, depth }) => [one.id, depth])).toEqual([
      ['root', 0],
      ['child', 1],
      ['other', 0],
    ])
  })
})
