'use client'

import type { NotificationType } from '@/lib/types'

export interface Toast {
  id: string
  type: NotificationType
  message: string
}

const STYLES: Record<NotificationType, string> = {
  bid: 'border-sky-500/40 bg-sky-500/15 text-sky-200',
  sold: 'border-turf-500/40 bg-turf-500/15 text-turf-200',
  unsold: 'border-slate-500/40 bg-slate-500/15 text-slate-300',
  info: 'border-slate-500/40 bg-slate-500/15 text-slate-200',
  error: 'border-rose-500/40 bg-rose-500/15 text-rose-200',
  countdown: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  complete: 'border-violet-500/40 bg-violet-500/15 text-violet-200',
}

const ICONS: Record<NotificationType, string> = {
  bid: '🔔',
  sold: '🔨',
  unsold: '✗',
  info: 'ℹ️',
  error: '⚠️',
  countdown: '⏱',
  complete: '🏆',
}

export default function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur-sm animate-slide-up ${STYLES[t.type]}`}
        >
          <span>{ICONS[t.type]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
