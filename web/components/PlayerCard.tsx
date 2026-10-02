'use client'

import type { PublicRoomPlayer } from '@/lib/types'
import { formatCr, roleColor } from '@/lib/format'

export default function PlayerCard({ player }: { player: PublicRoomPlayer }) {
  return (
    <div className="card relative overflow-hidden p-6">
      {/* Rating watermark */}
      <div className="pointer-events-none absolute -right-3 -top-6 select-none text-[7rem] font-extrabold leading-none text-slate-800/40">
        {player.rating}
      </div>

      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${roleColor(player.role)}`}>
            {player.role}
          </span>
          <span className="rounded-full border border-slate-600 bg-pitch-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
            Rating {player.rating}
          </span>
        </div>

        <h2 className="mb-1 text-2xl font-extrabold tracking-tight text-slate-50 sm:text-3xl">
          {player.name}
        </h2>
        <p className="text-sm text-slate-400">
          Base price <span className="font-bold text-amber-400">{formatCr(player.basePrice)}</span>
        </p>
      </div>
    </div>
  )
}
