'use client'

import type { PublicBid } from '@/lib/types'
import { formatCr } from '@/lib/format'

export default function BidHistory({ bids }: { bids: PublicBid[] }) {
  if (bids.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-500">
        No bids yet — be the first!
      </p>
    )
  }

  return (
    <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
      {bids.map((b, i) => (
        <li
          key={b.id}
          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
            i === 0
              ? 'border border-turf-500/30 bg-turf-500/10 text-turf-300'
              : 'bg-pitch-800 text-slate-400'
          }`}
        >
          <span className="font-medium">
            {i === 0 && '🔔 '}
            {b.bidderName}
          </span>
          <span className="font-bold tabular-nums">{formatCr(b.amount)}</span>
        </li>
      ))}
    </ul>
  )
}
