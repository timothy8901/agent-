// Tool catalog shared between main + renderer.
// Renderer hands TOOL_DEFS to Ollama's /api/chat as the `tools` array.
// Main process executes calls dispatched through `invoke-tool` IPC.

export interface ToolParameter {
  type: string
  description?: string
  default?: unknown
  enum?: string[]
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name:        string
    description: string
    parameters: {
      type:       'object'
      properties: Record<string, ToolParameter>
      required?:  string[]
    }
  }
}

export const TOOL_DEFS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'list_calendar_events',
      description: 'Read upcoming calendar events from the user\'s macOS Calendar. Use this when the user asks about their schedule.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'How many days ahead to look. Defaults to 7.', default: 7 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_calendar_event',
      description: 'Create a new event in the user\'s default macOS Calendar.',
      parameters: {
        type: 'object',
        required: ['title', 'start'],
        properties: {
          title:           { type: 'string', description: 'Event title.' },
          start:           { type: 'string', description: 'ISO 8601 start time, e.g. 2026-05-20T14:00:00.' },
          durationMinutes: { type: 'number', description: 'Event duration in minutes. Defaults to 60.', default: 60 },
          notes:           { type: 'string', description: 'Optional notes for the event.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_reminder',
      description: 'Schedule a macOS notification to fire after a number of minutes from now.',
      parameters: {
        type: 'object',
        required: ['message', 'whenMinutes'],
        properties: {
          message:     { type: 'string', description: 'The reminder message to show.' },
          whenMinutes: { type: 'number', description: 'Minutes from now until the notification fires.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_reminders',
      description: 'List all pending reminders the user has scheduled with Patti.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_reminder',
      description: 'Cancel a previously scheduled reminder by its id.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'The reminder id to cancel.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_files',
      description: 'Search the user\'s home folder for files matching a query, using macOS Spotlight.',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'Search terms — file name keywords, content keywords, or both.' },
          limit: { type: 'number', description: 'Maximum number of results. Defaults to 10.', default: 10 },
        },
      },
    },
  },
]

export type ToolName =
  | 'list_calendar_events'
  | 'create_calendar_event'
  | 'set_reminder'
  | 'list_reminders'
  | 'cancel_reminder'
  | 'find_files'

export interface ToolCallPayload {
  name: ToolName | string
  args: Record<string, unknown>
}

export interface ToolResultPayload {
  ok:     boolean
  data?:  unknown
  error?: string
}

// Friendly labels for inline "🛠 using …" status while a tool runs.
export const TOOL_LABELS: Record<string, string> = {
  list_calendar_events:  'reading your calendar',
  create_calendar_event: 'creating a calendar event',
  set_reminder:          'setting a reminder',
  list_reminders:        'checking your reminders',
  cancel_reminder:       'canceling a reminder',
  find_files:            'searching your files',
}
