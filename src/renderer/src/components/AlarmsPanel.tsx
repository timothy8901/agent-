import { useCallback, useEffect, useState } from 'react'

interface Alarm {
  id:      string
  message: string
  fireAt:  number
}

interface Props {
  petName: string
  onClose: () => void
}

function formatWhen(fireAt: number): string {
  const ms = fireAt - Date.now()
  if (ms < 0) return 'firing now'
  const min = Math.round(ms / 60_000)
  if (min < 1)   return 'in <1 min'
  if (min < 60)  return `in ${min} min`
  const hr = Math.floor(min / 60)
  const rem = min % 60
  if (hr < 24)   return rem ? `in ${hr}h ${rem}m` : `in ${hr}h`
  const day = Math.floor(hr / 24)
  return `in ${day}d`
}

export default function AlarmsPanel({ petName, onClose }: Props) {
  const [alarms,  setAlarms]  = useState<Alarm[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const res = await window.electronAPI.invokeTool({ name: 'list_reminders', args: {} })
    setLoading(false)
    if (res.ok && Array.isArray(res.data)) setAlarms(res.data as Alarm[])
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 30_000)
    return () => clearInterval(t)
  }, [refresh])

  async function cancel(id: string) {
    await window.electronAPI.invokeTool({ name: 'cancel_reminder', args: { id } })
    refresh()
  }

  return (
    <div className="alarms-panel">
      <div className="chat-header">
        <span className="panel-title">⏰ Reminders</span>
        <button className="icon-btn close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="alarms-body">
        {loading && (
          <p className="alarms-hint">Loading…</p>
        )}

        {!loading && alarms.length === 0 && (
          <div className="alarms-empty">
            <p className="alarms-empty-icon">🌱</p>
            <p>No reminders set.</p>
            <p className="alarms-hint">
              Ask {petName} in chat: "remind me to take a break in 25 minutes"
            </p>
          </div>
        )}

        {!loading && alarms.length > 0 && (
          <ul className="alarms-list">
            {alarms.map(a => (
              <li key={a.id} className="alarm-row">
                <div className="alarm-content">
                  <p className="alarm-message">{a.message}</p>
                  <p className="alarm-when">{formatWhen(a.fireAt)}</p>
                </div>
                <button className="alarm-cancel" onClick={() => cancel(a.id)} title="Cancel">✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
