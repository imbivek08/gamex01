'use client'

import type { PublicRoomPlayer } from '@/lib/types'
import { formatCr, roleColor } from '@/lib/format'

export default function PlayerCard({ player }: { player: PublicRoomPlayer }) {
  return (
    <div className="card relative overflow-hidden border-amber-400/20 bg-gradient-to-br from-pitch-900 via-pitch-900 to-turf-500/10 p-5 sm:p-8">
      <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-turf-500 via-amber-400 to-transparent" />
      {/* Rating watermark */}
      <div className="pointer-events-none absolute -right-2 -top-5 select-none text-[6rem] font-extrabold leading-none text-slate-800/50 sm:text-[8rem]">
        {player.rating}
      </div>

      <div className="relative">
        <div className="mb-6 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400">LOT ON THE BLOCK</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Base price</span>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${roleColor(player.role)}`}>
            {player.role}
          </span>
          <span className="rounded-full border border-slate-600 bg-pitch-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
            Rating {player.rating}
          </span>
        </div>

        <h2 className="mb-1 max-w-[75%] text-3xl font-black tracking-tight text-slate-50 sm:text-5xl">
          {player.name}
        </h2>
        <p className="text-sm text-slate-400">
          Starting at <span className="font-bold text-amber-400">{formatCr(player.basePrice)}</span>
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2 border-t border-slate-700/70 pt-4 text-xs sm:grid-cols-4">
          <ProfileStat label="Matches" value={player.matchesPlayed?.toString() ?? '—'} />
          <ProfileStat label="Runs" value={player.runs?.toLocaleString() ?? '—'} />
          <ProfileStat label="Wickets" value={player.wickets?.toString() ?? '—'} />
          <ProfileStat
            label={player.role === 'BOWL' ? 'Economy' : 'Strike rate'}
            value={
              player.role === 'BOWL'
                ? player.economyRate?.toFixed(1) ?? '—'
                : player.strikeRate?.toFixed(1) ?? '—'
            }
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
          {player.nationality && <span>{player.nationality}</span>}
          {player.age && <span>Age {player.age}</span>}
          {player.battingStyle && <span>{player.battingStyle}</span>}
          {player.bowlingStyle && <span>{player.bowlingStyle}</span>}
        </div>
        {player.bio && <p className="mt-3 max-w-2xl text-xs leading-relaxed text-slate-500">{player.bio}</p>}
      </div>
    </div>
  )
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-pitch-800/70 px-2 py-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 font-bold tabular-nums text-slate-200">{value}</p>
    </div>
  )
}
