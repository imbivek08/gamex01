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
  const phaseLabel =
    auction.phase === 'BIDDING'
      ? 'LIVE BIDDING'
      : auction.phase === 'COUNTDOWN'
        ? 'FINAL CALL'
        : auction.phase === 'SOLD_PENDING'
          ? 'AWAITING SALE'
          : auction.phase === 'UNSOLD_PENDING'
            ? 'UNSOLD REVIEW'
            : auction.phase === 'WAITING_FOR_HOST'
              ? 'NEXT LOT'
              : 'AUCTION FLOOR'

  return (
    <div className="space-y-4 pb-6 animate-fade-in">
      {/* Auction header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-xl text-pitch-950 shadow-lg shadow-amber-400/20">
            🔨
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-400">{phaseLabel}</p>
            <h1 className="max-w-[70vw] truncate text-lg font-extrabold text-slate-100 sm:max-w-none">
              {room.name}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-slate-700 bg-pitch-900 px-3 py-2 text-right">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Lots sold</p>
            <p className="text-sm font-extrabold text-slate-100">{auction.soldPlayers.length}</p>
          </div>
          {you && !isHost && (
            <div className="rounded-xl border border-turf-500/30 bg-turf-500/10 px-3 py-2 text-right">
              <p className="text-[9px] font-bold uppercase tracking-wider text-turf-300">Your purse</p>
              <p className="text-sm font-extrabold tabular-nums text-turf-300">{formatCr(you.purse)}</p>
            </div>
          )}
          {auction.paused && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-300">
              PAUSED
            </span>
          )}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          {/* Current player */}
          {auction.currentPlayer ? (
            <>
              <PlayerCard player={auction.currentPlayer} />

              {/* Live bid board */}
              <div className="card relative overflow-hidden border-amber-400/20 bg-gradient-to-br from-pitch-900 via-pitch-900 to-amber-950/20 p-5 sm:p-7">
                <div className="absolute -right-10 -top-16 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
                <div className="relative flex flex-col items-center justify-between gap-5 sm:flex-row">
                  <div className="text-center sm:text-left">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Current bid</p>
                    {auction.currentBid ? (
                      <>
                        <p className="mt-1 text-4xl font-black tabular-nums tracking-tight text-amber-300 sm:text-5xl">
                          {formatCr(auction.currentBid.amount)}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          Leading with <span className="font-bold text-slate-200">{currentBidder?.name}</span>
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mt-1 text-4xl font-black text-slate-600 sm:text-5xl">—</p>
                        <p className="mt-1 text-sm text-slate-500">Opening bid · {formatCr(auction.currentPlayer.basePrice)}</p>
                      </>
                    )}
                  </div>
                  {auction.phase === 'COUNTDOWN' && auction.countdownEndsAt && (
                    <div className="flex flex-col items-center gap-2">
                      <CountdownRing endsAt={auction.countdownEndsAt} />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-rose-300">Final call</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bid history */}
              <div className="card p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Live bid history</h3>
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-500">
                    {auction.bidHistory.length} bids
                  </span>
                </div>
                <BidHistory bids={auction.bidHistory} />
              </div>
            </>
          ) : (
            <div className="card p-10 text-center text-slate-400">Loading next player…</div>
          )}

          {/* Controls remain below the stage on small screens */}
          <div className="lg:hidden">
            {isHost ? <HostPanel snapshot={snapshot} /> : <BidderPanel snapshot={snapshot} />}
          </div>
        </div>

        {/* Persistent auctioneer/bidder rail on desktop */}
        <aside className="hidden space-y-4 lg:block lg:sticky lg:top-4">
          {isHost ? <HostPanel snapshot={snapshot} /> : <BidderPanel snapshot={snapshot} />}
        </aside>
      </div>
    </div>
  )
}
