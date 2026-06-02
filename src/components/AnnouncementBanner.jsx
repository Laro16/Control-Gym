import { useState, useEffect } from 'react'
import { X, Pin } from 'lucide-react'
import { getAnnouncements } from '../supabase'
import { formatDate } from '../utils/helpers'

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState([])
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_ann') || '[]') }
    catch { return [] }
  })

  useEffect(() => {
    getAnnouncements().then(({ data }) => setAnnouncements(data || []))
  }, [])

  const visible = announcements.filter(a => !dismissed.includes(a.id))
  if (!visible.length) return null

  const dismiss = (id) => {
    const next = [...dismissed, id]
    setDismissed(next)
    localStorage.setItem('dismissed_ann', JSON.stringify(next))
  }

  return (
    <div className="space-y-2 mb-4 animate-fade-in">
      {visible.map(a => (
        <div
          key={a.id}
          className={`relative rounded-2xl px-4 py-3 border flex items-start gap-3
            ${a.pinned
              ? 'bg-brand-500/8 border-brand-500/25'
              : 'bg-gray-800/40 border-gray-700/60'}`}
        >
          <span className="text-xl flex-shrink-0 mt-0.5">{a.emoji}</span>
          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-semibold text-white">{a.title}</p>
              {a.pinned && <Pin className="w-3 h-3 text-brand-400" />}
            </div>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{a.body}</p>
            {a.expires_at && (
              <p className="text-[10px] text-gray-600 mt-1">Válido hasta {formatDate(a.expires_at)}</p>
            )}
          </div>
          <button
            onClick={() => dismiss(a.id)}
            className="absolute top-2.5 right-2.5 text-gray-600 hover:text-gray-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
