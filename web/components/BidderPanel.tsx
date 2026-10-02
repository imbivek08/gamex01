'use client'

import { useState } from 'react'
import type { RoomSnapshot } from '@/lib/types'
import { getSocket } from '@/lib/socket'
import { formatCr, roleColor } from '@/lib/format'

const QUICK_RAISES = [0.5, 1, 2, 5]

export default function BidderPanel({ snapshot }: { snapshot: RoomSnapshot }) {
  const [customAmount, setCustomAmount] = useState('')
  const [placing, setPlacing] = useState(false)
  const [justBid, setJustBid] = useState(false)

  const { auction } = snapshot
  const you = snapshot.participants.find((p) => p.id === snapshot.you?.participantId)
  const isHighestBidder = auction.currentBid?.bidderId === snapshot.you?.participantId

  const canBid =
    (auction.phase === 'BIDDING' || auction.phase === 'COUNTDOWN') &&
    !auction.paused &&
    auction.currentPlayer !== null

  const minBid = auction.currentBid?.amount ?? auction.currentPlayer?.basePrice ?? 0.5
  const nextMin = minBid + 0.5

  const placeBid = (amount: number) => {
    if (!canBid || placing) return
    setPlacing(true)
    getSocket().emit('bid:place', { amount }, (res: { ok: boolean }) => {
      setPlacing(false)
      if (res.ok) {
        setJustBid(true)
        setCustomAmount('')
        setTimeout(() => setJustBid(false), 600)
      }
    })
  }

  const handleCustomBid = () => {
    const amount = parseFloat(customAmount)
    if (!Number.isNaN(amount)) placeBid(amount)
  }

  const squad = snapshot.participants.find((p) => p.id === snapshot.you?.participantId)

  return (
    <div className="space-y-4">
      {/* Bidding controls */}
      <div className="card p-5">
        {auction.paused && (
          <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-sm font-semibold text-amber-300">
            ⏸ Auction is paused by the host
          </p>
        )}

        {isHighestBidder && auction.currentBid && (
          <p className="mb-3 rounded-lg border border-turf-500/30 bg-turf-500/10 px-3 py-2 text-center text-sm font-semibold text-turf-300">
            🔔 You&apos;re the highest bidder at {formatCr(auction.currentBid.amount)}
          </p>
        )}

        {/* Quick raise buttons */}
        <div className="mb-4 grid grid-cols-4 gap-2">
          {QUICK_RAISES.map((raise) => {
            const amount = Math.round((minBid + raise) * 2) / 2
            const affordable = you ? amount <= you.purse : false
            return (
              <button
                key={raise}
                onClick={() => placeBid(amount)}
                disabled={!canBid || placing || !affordable}
                className="rounded-xl border border-slate-600 bg-pitch-800 py-3 text-sm font-bold text-slate-200 transition-all hover:border-turf-500 hover:bg-turf-500/10 hover:text-turf-300 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-slate-600 disabled:hover:bg-pitch-800 disabled:hover:text-slate-200"
              >
                <span className="block text-[10px] font-semibold uppercase text-slate-500">
                  +{raise} Cr
                </span>
                {formatCr(amount)}
              </button>
            )
          })}
        </div>

        {/* Custom amount + BID */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
              ₹
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min={nextMin}
              className="input pl-8 tabular-nums"
              placeholder={`Min ${formatCr(nextMin)}`}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              disabled={!canBid}
            />
          </div>
          <button
            onClick={handleCustomBid}
            disabled={!canBid || placing || !customAmount}
            className={`btn-primary px-8 text-lg ${justBid ? 'animate-hammer-slam' : ''}`}
          >
            {placing ? (
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-pitch-950/30 border-t-pitch-950" />
            ) : (
              'BID'
            )}
          </button>
        </div>

        {you && (
          <p className="mt-3 text-center text-xs text-slate-500">
            Remaining purse:{' '}
            <span className="font-bold text-slate-300">{formatCr(you.purse)}</span> · Bids must be
            in ₹0.5 Cr steps
          </p>
        )}
      </div>

      {/* Your squad */}
      <div className="card p-5">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          Your Squad ({squad?.squadCount ?? 0} players)
        </h3>
        <SquadList snapshot={snapshot} />
      </div>
    </div>
  )
}

function SquadList({ snapshot }: { snapshot: RoomSnapshot }) {
  const youId = snapshot.you?.participantId
  // We don't have per-player squad detail in the snapshot for the bidder's own squad
  // beyond squadCount; derive sold players for this bidder from soldPlayers.
  const myPlayers = snapshot.auction.soldPlayers.filter(
    (p) => p.soldToName === snapshot.participants.find((x) => x.id === youId)?.name,
  )

  if (myPlayers.length === 0) {
    return <p className="py-2 text-center text-sm text-slate-500">No players yet — go get some!</p>
  }

  return (
    <ul className="space-y-1.5">
      {myPlayers.map((p) => (
        <li
          key={p.id}
          className="flex items-center justify-between rounded-lg bg-pitch-800 px-3 py-2 text-sm"
        >
          <span className="flex items-center gap-2">
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${roleColor(p.role)}`}>
              {p.role}
            </span>
            <span className="font-medium text-slate-200">{p.name}</span>
          </span>
          <span className="font-bold tabular-nums text-amber-400">{formatCr(p.soldFor ?? 0)}</span>
        </li>
      ))}
    </ul>
  )
}
