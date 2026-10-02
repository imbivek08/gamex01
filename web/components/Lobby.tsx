'use client'

import { useState } from 'react'
import type { RoomSnapshot } from '@/lib/types'
import { getSocket } from '@/lib/socket'

export default function Lobby({ snapshot, isHost }: { snapshot: RoomSnapshot; isHost: boolean }) {
  const [starting, setStarting] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(snapshot.room.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable — select fallback
    }
  }

  const startAuction = () => {
    setStarting(true)
    getSocket().emit('auction:start', {}, () => setStarting(false))
  }

  const bidders = snapshot.participants.filter((p) => !p.isHost)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Room code */}
      <div className="card p-6 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Share this code with friends
        </p>
        <button
          onClick={copyCode}
          className="group inline-flex items-center gap-3 rounded-2xl border border-dashed border-slate-500 bg-pitch-800 px-8 py-4 transition-colors hover:border-turf-500"
        >
          <span className="text-4xl font-extrabold tracking-[0.35em] text-turf-400">
            {snapshot.room.code}
          </span>
          <span className="text-lg text-slate-500 transition-colors group-hover:text-slate-300">
            {copied ? '✓' : '⧉'}
          </span>
        </button>
        <p className="mt-2 text-xs text-slate-500">
          {copied ? 'Copied!' : 'Tap to copy'} · Purse ₹{snapshot.room.purseSize} Cr per player
        </p>
      </div>

      {/* Participants */}
      <div className="card p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">
          Players ({snapshot.participants.length}/10)
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {snapshot.participants.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-pitch-800 px-3 py-2.5"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  p.online ? 'bg-turf-400' : 'bg-slate-600'
                }`}
              />
              <span className="truncate text-sm font-medium text-slate-200">
                {p.name}
                {p.isHost && <span className="ml-1.5 text-xs text-amber-400">👑 Host</span>}
              </span>
            </div>
          ))}
          {Array.from({ length: Math.max(0, 4 - snapshot.participants.length) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex items-center justify-center rounded-xl border border-dashed border-slate-700 px-3 py-2.5 text-xs text-slate-600"
            >
              Waiting…
            </div>
          ))}
        </div>
      </div>

      {/* Host controls / bidder waiting */}
      {isHost ? (
        <div className="card border-2 border-turf-500/30 p-6 text-center shadow-lg shadow-turf-500/10">
          <div className="mb-3 text-2xl">🔨</div>
          <h3 className="mb-2 text-lg font-bold text-slate-100">Ready to Start?</h3>
          <p className="mb-4 text-sm text-slate-400">
            {bidders.length === 0
              ? 'Waiting for at least one friend to join…'
              : `You have ${bidders.length} bidder${bidders.length > 1 ? 's' : ''} ready!`}
          </p>
          <button
            className="btn-primary w-full py-3 text-lg font-bold"
            onClick={startAuction}
            disabled={starting || bidders.length === 0}
          >
            {starting ? (
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-pitch-950/30 border-t-pitch-950" />
            ) : bidders.length === 0 ? (
              'Waiting for Players…'
            ) : (
              '🏏 Start the Auction'
            )}
          </button>
          {bidders.length > 0 && (
            <p className="mt-3 text-xs text-turf-400">
              Click the button above to begin the auction!
            </p>
          )}
        </div>
      ) : (
        <div className="card p-6 text-center">
          <div className="mb-2 text-3xl">⏳</div>
          <p className="text-sm text-slate-400">
            You&apos;re in! Waiting for the host to start the auction…
          </p>
        </div>
      )}
    </div>
  )
}
