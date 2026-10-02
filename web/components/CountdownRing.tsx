'use client'

import { useEffect, useState } from 'react'

const TOTAL_MS = 45_000

export default function CountdownRing({ endsAt }: { endsAt: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, endsAt - Date.now()))

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, endsAt - Date.now()))
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [endsAt])

  const fraction = Math.max(0, remaining / TOTAL_MS)
  const seconds = Math.ceil(remaining / 1000)
  const isUrgent = remaining <= 3000

  // SVG circle geometry
  const R = 54
  const CIRC = 2 * Math.PI * R

  return (
    <div className="relative inline-flex items-center justify-center">
      {isUrgent && (
        <span className="absolute inline-flex h-full w-full rounded-full bg-rose-500/30 animate-pulse-ring" />
      )}
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke={isUrgent ? '#f43f5e' : '#22c55e'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - fraction)}
          className="transition-[stroke-dashoffset] duration-100 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`text-3xl font-extrabold tabular-nums ${
            isUrgent ? 'text-rose-400' : 'text-slate-100'
          }`}
        >
          {seconds}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          seconds
        </span>
      </div>
    </div>
  )
}
