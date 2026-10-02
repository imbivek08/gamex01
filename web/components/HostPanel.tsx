'use client'

import { useState } from 'react'
import type { RoomSnapshot } from '@/lib/types'
import { getSocket } from '@/lib/socket'
import { formatCr, roleColor } from '@/lib/format'

export default function HostPanel({ snapshot }: { snapshot: RoomSnapshot }) {
  const [showPicker, setShowPicker] = useState(false)
  const { auction } = snapshot
  const socket = getSocket()

  const emit = (event: string) => socket.emit(event, {})

  const isWaitingForHost = auction.phase === 'WAITING_FOR_HOST'
  const isSoldPending = auction.phase === 'SOLD_PENDING'
  const isUnsoldPending = auction.phase === 'UNSOLD_PENDING'

  return (
    <div className="space-y-4">
      {/* Host controls */}
      <div className="card p-5">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          🎙 Host Controls
        </h3>

        <div className="grid grid-cols-2 gap-2">
          {/* Settlement is explicit so the host remains in control after the
              closing timer and the winning bid is visible to everyone. */}
          {isSoldPending && (
            <button
              className="btn-primary col-span-2 py-3 text-base"
              onClick={() => emit('auction:confirmSold')}
            >
              🔨 Confirm SOLD · {formatCr(auction.currentBid?.amount ?? 0)}
            </button>
          )}
          {isUnsoldPending && (
            <button
              className="btn-primary col-span-2 py-3 text-base"
              onClick={() => emit('auction:confirmUnsold')}
            >
              Confirm UNSOLD
            </button>
          )}

          {/* Next Player (shown when waiting for host) */}
          {isWaitingForHost && (
            <button
              className="btn-primary col-span-2 py-3 text-base animate-pulse"
              onClick={() => emit('auction:nextPlayer')}
            >
              ⏭ Next Player
            </button>
          )}

          {/* Every player now enters the closing countdown automatically. */}
          {auction.phase === 'COUNTDOWN' && !auction.paused && (
            <div className="col-span-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-center text-sm font-semibold text-amber-300">
              ⏱ Automatic countdown is running
            </div>
          )}

          {/* Pause / Resume */}
          {!isWaitingForHost && !isSoldPending && !isUnsoldPending && (
            <>
              {auction.paused ? (
                <button className="btn-secondary" onClick={() => emit('auction:resume')}>
                  ▶ Resume
                </button>
              ) : (
                <button
                  className="btn-secondary"
                  disabled={auction.phase !== 'BIDDING' && auction.phase !== 'COUNTDOWN'}
                  onClick={() => emit('auction:pause')}
                >
                  ⏸ Pause
                </button>
              )}

              {/* Skip */}
              <button
                className="btn-secondary"
                disabled={!auction.currentPlayer}
                onClick={() => emit('auction:skipPlayer')}
              >
                ⏭ Skip Player
              </button>
            </>
          )}

          {/* Player picker */}
          <button
            className="btn-secondary col-span-2"
            onClick={() => setShowPicker((v) => !v)}
          >
            📋 {showPicker ? 'Hide Player List' : 'Select Player'}
          </button>
        </div>
      </div>

      {/* Player picker */}
      {showPicker && <PlayerPicker snapshot={snapshot} />}

      {/* Participant overview */}
      <div className="card p-5">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          Bidders
        </h3>
        <ul className="space-y-1.5">
          {snapshot.participants
            .filter((p) => !p.isHost)
            .map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg bg-pitch-800 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${p.online ? 'bg-turf-400' : 'bg-slate-600'}`}
                  />
                  <span className="font-medium text-slate-200">{p.name}</span>
                  {auction.currentBid?.bidderId === p.id && (
                    <span className="text-xs text-amber-400">🔔 high bid</span>
                  )}
                </span>
                <span className="font-bold tabular-nums text-turf-400">{formatCr(p.purse)}</span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  )
}

function PlayerPicker({ snapshot }: { snapshot: RoomSnapshot }) {
  const [pending, setPending] = useState<string[]>([])

  // Derive pending players: not sold and not current.
  const soldIds = new Set(snapshot.auction.soldPlayers.map((p) => p.id))
  const currentId = snapshot.auction.currentPlayer?.id
  const available = snapshot.auction.soldPlayers
    .filter((p) => !soldIds.has(p.id) && p.id !== currentId)
    .sort((a, b) => b.rating - a.rating)

  const select = (roomPlayerId: string) => {
    setPending((prev) => [...prev, roomPlayerId])
    getSocket().emit('auction:selectPlayer', { roomPlayerId }, () =>
      setPending((prev) => prev.filter((id) => id !== roomPlayerId)),
    )
  }

  if (available.length === 0) {
    return (
      <div className="card p-4 text-center text-sm text-slate-500">
        No more players available — the auction is wrapping up!
      </div>
    )
  }

  return (
    <div className="card p-4 animate-slide-up">
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
        Pick the next player
      </h4>
      <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {available.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => select(p.id)}
              disabled={pending.includes(p.id)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-700/60 bg-pitch-800 px-3 py-2 text-left text-sm transition-colors hover:border-turf-500/50 hover:bg-pitch-700 disabled:opacity-40"
            >
              <span className="flex items-center gap-2">
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${roleColor(p.role)}`}>
                  {p.role}
                </span>
                <span className="font-medium text-slate-200">{p.name}</span>
              </span>
              <span className="text-xs text-slate-500">
                {p.rating} · {formatCr(p.basePrice)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
