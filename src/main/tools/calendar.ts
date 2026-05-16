// macOS Calendar via osascript. Native bindings rot across Electron upgrades;
// AppleScript is the durable choice.

import { execFile } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execFile)

const TCC_DENIED_HINT =
  'Calendar access is not granted. Open System Settings → Privacy & Security → Calendars and enable Desktop Pet Patti.'

function escapeAS(s: string): string {
  // Escape quotes and backslashes for inclusion in an AppleScript string literal.
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

interface CalendarEvent {
  title:    string
  start:    string  // ISO 8601
  end:      string  // ISO 8601
  calendar: string
}

const LIST_SCRIPT = (days: number) => `
set output to ""
set startDate to (current date)
set endDate to startDate + (${days} * days)
tell application "Calendar"
  repeat with c in calendars
    set calName to name of c
    try
      set evs to (every event of c whose start date ≥ startDate and start date ≤ endDate)
      repeat with e in evs
        set t to summary of e
        set s to (start date of e) as «class isot» as string
        set f to (end date of e) as «class isot» as string
        set output to output & calName & "\\t" & t & "\\t" & s & "\\t" & f & linefeed
      end repeat
    end try
  end repeat
end tell
return output
`

export async function listEvents(days = 7): Promise<CalendarEvent[]> {
  try {
    const { stdout } = await exec('osascript', ['-e', LIST_SCRIPT(days)], { maxBuffer: 4 * 1024 * 1024 })
    const events: CalendarEvent[] = []
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue
      const [calendar, title, start, end] = line.split('\t')
      if (title && start) events.push({ title, start, end: end ?? start, calendar: calendar ?? '' })
    }
    events.sort((a, b) => a.start.localeCompare(b.start))
    return events
  } catch (err) {
    throw asTccAwareError(err)
  }
}

interface CreateEventArgs {
  title:           string
  start:           string         // ISO 8601
  durationMinutes?: number
  notes?:          string
}

function isoToAppleScriptDate(iso: string): string {
  // AppleScript wants "mm/dd/yyyy hh:mm:ss AM/PM" style. Easiest reliable path:
  // build a date from components in the script itself.
  const d = new Date(iso)
  if (isNaN(d.getTime())) throw new Error(`Invalid ISO date: ${iso}`)
  return [
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
  ].join(',')
}

const CREATE_SCRIPT = (args: CreateEventArgs) => {
  const dur = args.durationMinutes ?? 60
  const startBits = isoToAppleScriptDate(args.start)
  const title = escapeAS(args.title)
  const notes = escapeAS(args.notes ?? '')
  return `
set [y, mo, d, h, mi, s] to {${startBits}}
set startDate to current date
set year of startDate to y
set month of startDate to mo
set day of startDate to d
set hours of startDate to h
set minutes of startDate to mi
set seconds of startDate to s
set endDate to startDate + (${dur} * minutes)

tell application "Calendar"
  set defCal to first calendar whose writable is true
  set newEv to make new event at end of events of defCal with properties {summary:"${title}", start date:startDate, end date:endDate, description:"${notes}"}
  return uid of newEv
end tell
`
}

export async function createEvent(args: CreateEventArgs): Promise<{ id: string }> {
  try {
    const { stdout } = await exec('osascript', ['-e', CREATE_SCRIPT(args)])
    return { id: stdout.trim() }
  } catch (err) {
    throw asTccAwareError(err)
  }
}

function asTccAwareError(err: unknown): Error {
  const msg = (err as Error).message ?? String(err)
  // osascript returns "execution error: ... (-1743)" when TCC denies AppleEvents,
  // and "Not authorized to send Apple events to Calendar." when Calendar TCC is denied.
  if (/-1743|not authorized|access not allowed/i.test(msg)) {
    return new Error(TCC_DENIED_HINT)
  }
  return new Error(`Calendar error: ${msg}`)
}
