'use client'

import type { RoomSnapshot } from '@/lib/types'
import { formatCr, roleColor } from '@/lib/format'

export default function Results({ snapshot, isHost }: { snapshot: RoomSnapshot; isHost: boolean }) {
  const results = snapshot.results ?? []
  const sorted = [...results].sort((a, b) => b.squad.length - a.squad.length || b.spent - a.spent)
  const leader = sorted[0]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card p-8 text-center">
        <div className="mb-2 text-5xl">🏆</div>
        <h1 className="mb-1 text-2xl font-extrabold tracking-tight">Auction Complete!</h1>
        <p className="text-sm text-slate-400">
          {snapshot.room.name} · {snapshot.auction.soldPlayers.length} players sold
        </p>
        {leader && leader.squad.length > 0 && (
          <p className="mt-3 inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm font-semibold text-amber-300">
            👑 {leader.name} wins with {leader.squad.length} players!
          </p>
        )}
      </div>

      {/* Per-bidder results */}
      <div className="space-y-4">
        {sorted.map((r, rank) => (
          <div key={r.participantId} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-pitch-700 text-xs font-extrabold text-slate-300">
                  {rank + 1}
                </span>
                <span className="font-bold text-slate-100">{r.name}</span>
                {rank === 0 && r.squad.length > 0 && <span>👑</span>}
              </div>
              <div className="text-right text-xs text-slate-400">
                <span className="font-bold text-slate-200">{r.squad.length}</span> players · spent{' '}
                <span className="font-bold text-amber-400">{formatCr(r.spent)}</span> · left{' '}
                <span className="font-bold text-turf-400">{formatCr(r.remaining)}</span>
              </div>
            </div>
            {r.squad.length > 0 ? (
              <ul className="divide-y divide-slate-800">
                {r.squad.map((p, i) => (
                  <li key={i} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="flex items-center gap-2.5">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${roleColor(p.role)}`}
                      >
                        {p.role}
                      </span>
                      <span className="font-medium text-slate-200">{p.name}</span>
                      <span className="text-xs text-slate-500">⭐ {p.rating}</span>
                    </span>
                    <span className="font-bold tabular-nums text-amber-400">{formatCr(p.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-center text-sm text-slate-500">No players purchased</p>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <a href="/" className="btn-primary flex-1">
          {isHost ? '🏠 New Room' : '🏠 Back to Home'}
        </a>
      </div>
    </div>
  )
}
