/**
 * Where an agent's run stands: still going, finished with an answer, ended on
 * an error or refusal, or stopped (interrupted, killed).
 */
export type AgentPhase = 'working' | 'done' | 'failed' | 'stopped'

/**
 * One agent the band tracks: a subagent or a teammate of this session.
 */
export type AgentRecord = {
  /** The agent's id, as `$.agent.list()` and its `tool.call`s carry it. */
  id: string
  /** Its agent type (`Explore`, `general-purpose`, `teammate`); '' until known. */
  type: string
  /** What SendMessage addresses it by; '' when it has no name. */
  name: string
  /** The task's short description; '' until known. */
  description: string
  /** The agent whose loop spawned it; '' when the main loop did. */
  parentId: string
  /** Its slot in the palette, held for as long as its bar is up. */
  color: number
  /** When this run began, in ms since the epoch. */
  startedAt: number
  /** When it last showed it was alive (spawned, listed running, a tool call). */
  seenAt: number
  /** Tool calls this run has made. */
  tools: number
  /** The tool it called last; '' before the first. */
  activity: string
  phase: AgentPhase
  /** When it stopped working, in ms since the epoch; 0 while working. */
  endedAt: number
}

/**
 * One bar as the surface module draws it: every field resolved for drawing.
 */
export type BarRow = {
  id: string
  label: string
  /** Nesting under the agent that spawned it, 0 for the main loop's. */
  depth: number
  /** The bar's color, and the two lighter tints its shimmer runs in. */
  color: string
  mid: string
  glow: string
  /** How full the bar is drawn, 0 to 1. */
  fill: number
  phase: AgentPhase
  activity: string
  tools: number
  elapsed: string
  /** True while the person has this agent's transcript on screen. */
  isInView: boolean
}

/**
 * The props the band hands its `Client`.
 */
export type BarsProps = {
  rows: BarRow[]
  /** Working agents past the band's last row. */
  more: number
  /** Cells across the band. */
  columns: number
}

declare module 'claude-code' {
  interface PluginState {
    'loading-agents-bar': {
      isEnabled: boolean
      agents: AgentRecord[]
      now: number
    }
  }
}
