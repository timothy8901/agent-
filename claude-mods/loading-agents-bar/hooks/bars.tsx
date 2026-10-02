import type { ClientElements, ClientModule, RenderElement } from 'claude-code'

import type { AgentPhase, BarRow, BarsProps } from '../types'

/** One frame of the shimmer. */
const FRAME_MS = 100
/** Cells the shimmer moves each frame. */
const SPEED = 2
/** Cells of rest between two passes of the shimmer. */
const REST = 14

const FILL = '━'
const HALF = '╸'
const TRACK = '─'
const MARKS: Record<AgentPhase, string> = { working: '●', done: '✓', failed: '✗', stopped: '■' }

type Frame = { frame: number }
type Tier = 'wide' | 'medium' | 'narrow' | 'none'
type Layout = { label: number; bar: number; stats: number; tier: Tier }

/** Instances whose frame clock runs, and the props each last drew. */
const ticking = new WeakSet<object>()
const latest = new WeakMap<object, BarsProps>()

/**
 * The band's bars, one row per agent: its mark and label, a bar in its color
 * with a shimmer running along the filled part while it works, and its stats.
 * Animated here on the surface's frame clock, so no frame crosses to `$`.
 */
const LoadingBars: ClientModule<BarsProps, Frame> = (props, surface) => {
  latest.set(surface, props)
  if (surface.state === undefined && !ticking.has(surface)) {
    ticking.add(surface)
    let frame = 0
    surface.every(FRAME_MS, () => {
      // Finished bars hold still; the next props with a working one wake it.
      if (latest.get(surface)?.rows.some(row => row.phase === 'working') ?? true) {
        frame += 1
        surface.setState({ frame })
      }
    })
    surface.setState({ frame })
  }

  const { Box, Text } = surface.elements
  const frame = surface.state?.frame ?? 0
  const width = Math.max(12, (surface.columns > 0 ? surface.columns : props.columns) - 1)
  const layout = layoutFor(width)

  return (
    <Box flexDirection="column">
      {props.rows.map((row, index) => drawRow(row, index, frame, layout, surface.elements))}
      {props.more > 0 ? (
        <Text dimColor>{fit(`  +${props.more} more agent${props.more === 1 ? '' : 's'}`, width)}</Text>
      ) : null}
    </Box>
  )
}

export default LoadingBars

function drawRow(row: BarRow, index: number, frame: number, layout: Layout, elements: ClientElements): RenderElement {
  const { Box, Text } = elements
  const indent = '  '.repeat(Math.min(row.depth, 3))
  const room = Math.max(1, layout.label - indent.length - 2)

  return (
    <Box flexDirection="row">
      <Box width={layout.label} flexShrink={0}>
        <Text bold={row.isInView}>
          {indent}
          <Text color={row.color}>{MARKS[row.phase]}</Text> {fit(row.label, room)}
        </Text>
      </Box>
      <Box width={layout.bar + 1} flexShrink={0} paddingLeft={1}>
        <Text>{segments(row, index, frame, layout.bar, elements)}</Text>
      </Box>
      {layout.stats > 0 ? (
        <Box width={layout.stats + 1} flexShrink={0} paddingLeft={1}>
          <Text dimColor>{statsOf(row, layout)}</Text>
        </Box>
      ) : null}
    </Box>
  )
}

/**
 * The bar's cells as runs of one color each: the filled part (a lighter
 * shimmer passing along it while the agent works), a half cell at its edge,
 * then the dim track.
 */
function segments(row: BarRow, index: number, frame: number, cells: number, elements: ClientElements): RenderElement[] {
  const { Text } = elements
  const exact = Math.max(0, Math.min(1, row.fill)) * cells
  const full = row.phase === 'done' ? cells : Math.min(cells, Math.floor(exact))
  const hasHalf = full < cells && exact - full >= 0.5
  const track = cells - full - (hasHalf ? 1 : 0)
  // Each row's shimmer starts at its own offset, so the stack does not march.
  const at = row.phase === 'working' && full >= 3 ? ((frame * SPEED + index * 11) % (full + REST)) - 2 : -99
  const runs: Array<{ color: string; text: string }> = []
  for (let cell = 0; cell < full; cell += 1) {
    const distance = Math.abs(cell - at)
    const color = distance === 0 ? row.glow : distance === 1 ? row.mid : row.color
    const last = runs[runs.length - 1]
    if (last !== undefined && last.color === color) {
      last.text += FILL
    } else {
      runs.push({ color, text: FILL })
    }
  }
  if (hasHalf) {
    runs.push({ color: row.color, text: HALF })
  }
  const drawn = runs.map(run => <Text color={run.color}>{run.text}</Text>)
  if (track > 0) {
    drawn.push(<Text dimColor>{TRACK.repeat(track)}</Text>)
  }

  return drawn
}

function statsOf(row: BarRow, layout: Layout): string {
  const count = `${row.tools} tool${row.tools === 1 ? '' : 's'}`
  switch (layout.tier) {
    case 'wide': {
      const tail = ` · ${count} · ${row.elapsed}`
      const state = row.phase === 'working' ? row.activity || 'starting' : row.phase

      return fit(state, layout.stats - tail.length) + tail
    }
    case 'medium':
      return fit(`${count} · ${row.elapsed}`, layout.stats)
    case 'narrow':
      return fit(row.elapsed, layout.stats)
    default:
      return ''
  }
}

/** Columns for the label, the bar and the stats in `width` cells. */
function layoutFor(width: number): Layout {
  const tier: Tier = width >= 96 ? 'wide' : width >= 64 ? 'medium' : width >= 40 ? 'narrow' : 'none'
  const stats = tier === 'wide' ? 28 : tier === 'medium' ? 18 : tier === 'narrow' ? 6 : 0
  const label = Math.max(10, Math.min(40, Math.floor(width * 0.3)))
  const bar = width - label - 1 - (stats > 0 ? stats + 1 : 0)
  if (bar >= 6) {
    return { label, bar, stats, tier }
  }
  const narrow = Math.max(4, width - 7)

  return { label: narrow, bar: Math.max(1, width - narrow - 1), stats: 0, tier: 'none' }
}

/** `text` cut to `width` cells, an ellipsis marking the cut. */
function fit(text: string, width: number): string {
  if (width <= 0) {
    return ''
  }
  const chars = Array.from(text.replace(/[\u0000-\u001f\u007f]/g, ' '))
  const total = chars.reduce((sum, char) => sum + cellsOf(char), 0)
  if (total <= width) {
    return chars.join('')
  }
  let kept = ''
  let used = 0
  for (const char of chars) {
    const cells = cellsOf(char)
    if (used + cells > width - 1) {
      break
    }
    kept += char
    used += cells
  }

  return `${kept}…`
}

/** Cells a character takes on a terminal: 0, 1, or 2 for wide scripts and emoji. */
function cellsOf(char: string): number {
  const point = char.codePointAt(0) ?? 0
  if ((point >= 0x300 && point <= 0x36f) || (point >= 0x200b && point <= 0x200f) || (point >= 0xfe00 && point <= 0xfe0f)) {
    return 0
  }
  const isWide =
    (point >= 0x1100 && point <= 0x115f) ||
    (point >= 0x2e80 && point <= 0xa4cf) ||
    (point >= 0xac00 && point <= 0xd7a3) ||
    (point >= 0xf900 && point <= 0xfaff) ||
    (point >= 0xfe30 && point <= 0xfe4f) ||
    (point >= 0xff00 && point <= 0xff60) ||
    (point >= 0xffe0 && point <= 0xffe6) ||
    (point >= 0x1f300 && point <= 0x1faff) ||
    (point >= 0x20000 && point <= 0x3fffd)

  return isWide ? 2 : 1
}
