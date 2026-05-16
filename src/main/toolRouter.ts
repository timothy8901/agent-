// Single dispatcher invoked from the renderer via `invoke-tool` IPC.

import { listEvents, createEvent } from './tools/calendar'
import { setReminder, listReminders, cancelReminder } from './tools/alarms'
import { findFiles } from './tools/fileFinder'
import type { ToolCallPayload, ToolResultPayload } from '../shared/tools'

export type { ToolCallPayload, ToolResultPayload }

export async function dispatchTool(call: ToolCallPayload): Promise<ToolResultPayload> {
  try {
    const a = call.args ?? {}
    switch (call.name) {
      case 'list_calendar_events':
        return { ok: true, data: await listEvents(Number(a.days) || 7) }

      case 'create_calendar_event':
        return { ok: true, data: await createEvent({
          title:           String(a.title ?? ''),
          start:           String(a.start ?? ''),
          durationMinutes: typeof a.durationMinutes === 'number' ? a.durationMinutes : undefined,
          notes:           typeof a.notes === 'string' ? a.notes : undefined,
        })}

      case 'set_reminder':
        return { ok: true, data: setReminder({
          message:     String(a.message ?? ''),
          whenMinutes: Number(a.whenMinutes) || 0,
        })}

      case 'list_reminders':
        return { ok: true, data: listReminders() }

      case 'cancel_reminder':
        return { ok: true, data: cancelReminder(String(a.id ?? '')) }

      case 'find_files':
        return { ok: true, data: await findFiles({
          query: String(a.query ?? ''),
          limit: typeof a.limit === 'number' ? a.limit : undefined,
        })}

      default:
        return { ok: false, error: `Unknown tool: ${call.name}` }
    }
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? String(err) }
  }
}
