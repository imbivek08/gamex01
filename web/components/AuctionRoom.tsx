'use client'

import { useState } from 'react'
import type { RoomSnapshot } from '@/lib/types'
import { getSocket } from '@/lib/socket'
import { formatCr } from '@/lib/format'
import PlayerCard from '@/components/PlayerCard'
import CountdownRing from '@/components/CountdownRing'
import BidHistory from '@/components/BidHistory'
import BidderPanel from '@/components/BidderPanel'
import HostPanel from '@/components/HostPanel'

export default function AuctionRoom({ snapshot, isHost }: { snapshot: RoomSnapshot; isHost: boolean }) {
  const { auction, room } = snapshot
  const currentBidder = snapshot.participants.find((p) => p.id === auction.currentBid?.bidderId)
  const you = snapshot.participants.find((p) => p.id === snapshot.you?.participantId)

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Status bar */}
      <div className="card flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg">🔨</span>
          <div>
            <p className="text-sm font-bold text-slate-200">
              {auction.phase === 'BIDDING' && 'Open for bids'}
              {auction.phase === 'COUNTDOWN' && 'Going once…'}
              {auction.phase === 'SOLD_PENDING' && 'Sale ready to confirm'}
              {auction.phase === 'UNSOLD_PENDING' && 'Unsold ready to confirm'}
              {auction.phase === 'WAITING_FOR_HOST' && 'Host must bring up the next player'}
              {auction.paused && <span className="ml-2 text-amber-400">· Paused</span>}
            </p>
            <p className="text-xs text-slate-500">
              {auction.soldPlayers.length} sold · {room.name}
            </p>
          </div>
        </div>
        {you && !isHost && (
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Your purse
            </p>
            <p className="text-lg font-extrabold tabular-nums text-turf-400">
              {formatCr(you.purse)}
            </p>
          </div>
        )}
      </div>

      {/* Current player */}
      {auction.currentPlayer ? (
        <div className="space-y-4">
          <PlayerCard player={auction.currentPlayer} />

          {/* Bid + countdown row */}
          <div className="card flex items-center justify-around gap-4 p-5">
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Current bid
              </p>
              {auction.currentBid ? (
                <>
                  <p className="text-2xl font-extrabold tabular-nums text-amber-400 sm:text-3xl">
                    {formatCr(auction.currentBid.amount)}
                  </p>
                  <p className="text-xs text-slate-400">
                    by <span className="font-semibold text-slate-200">{currentBidder?.name}</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-extrabold tabular-nums text-slate-500 sm:text-3xl">
                    —
                  </p>
                  <p className="text-xs text-slate-500">No bids yet</p>
                </>
              )}
            </div>

            {auction.phase === 'COUNTDOWN' && auction.countdownEndsAt && (
              <CountdownRing endsAt={auction.countdownEndsAt} />
            )}
          </div>

          {/* Current leader */}
          {auction.phase === 'BIDDING' && !auction.paused && auction.currentBid && currentBidder && (
            <div className="card border border-turf-500/30 bg-turf-500/5 p-4">
              <div className="flex items-center justify-end gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Current leader
                </p>
                <p className="flex items-center gap-1.5 text-sm font-bold text-amber-400">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  {currentBidder.name}
                </p>
              </div>
            </div>
          )}

          {/* Bid history */}
          <div className="card p-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              Bid history
            </h3>
            <BidHistory bids={auction.bidHistory} />
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center text-slate-400">Loading next player…</div>
      )}

      {/* Role-specific panel */}
      {isHost ? (
        <HostPanel snapshot={snapshot} />
      ) : (
        <BidderPanel snapshot={snapshot} />
      )}
    </div>
  )
}
