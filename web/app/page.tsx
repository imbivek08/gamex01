'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { getSocket } from '@/lib/socket'

type Mode = 'create' | 'join'

export default function HomePage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('create')
  const [name, setName] = useState('')
  const [roomName, setRoomName] = useState('')
  const [code, setCode] = useState('')
  const [purseSize, setPurseSize] = useState(100)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Please enter your name')
      return
    }
    if (mode === 'join' && !code.trim()) {
      setError('Please enter the room code')
      return
    }

    setLoading(true)
    const socket = getSocket()

    const payload =
      mode === 'create'
        ? { name: name.trim(), roomName: roomName.trim(), purseSize }
        : { name: name.trim(), code: code.trim().toUpperCase() }

    const handler = (res: { ok: boolean; code?: string; error?: string; userId?: string; name?: string }) => {
      socket.off('connect_error', connectErrorHandler)
      setLoading(false)
      if (res.ok && res.code) {
        if (res.userId) {
          localStorage.setItem(
            `auction:${res.code}`,
            JSON.stringify({ userId: res.userId, name: res.name ?? name.trim() }),
          )
        }
        router.push(`/room/${res.code}`)
      } else {
        setError(res.error ?? 'Something went wrong')
      }
    }

    const connectErrorHandler = () => {
      socket.off('room:created', handler)
      setLoading(false)
      setError('Could not connect to the server')
    }

    if (mode === 'create') {
      socket.emit('room:create', payload, handler)
    } else {
      socket.emit('room:join', payload, handler)
    }

    // Safety timeout in case the server never responds
    setTimeout(() => {
      setLoading((stillLoading) => {
        if (stillLoading) setError('Server is not responding — is it running?')
        return false
      })
    }, 8000)
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center animate-fade-in">
          <div className="mb-3 text-5xl">🏏</div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Cricket <span className="text-turf-400">Auction</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Create a room, invite friends, and bid to build your dream squad.
          </p>
        </div>

        {/* Card */}
        <div className="card p-6 animate-slide-up">
          {/* Mode tabs */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-pitch-800 p-1">
            {(['create', 'join'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  setError('')
                }}
                className={`rounded-lg py-2.5 text-sm font-semibold transition-all ${
                  mode === m
                    ? 'bg-turf-500 text-pitch-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m === 'create' ? 'Create Room' : 'Join Room'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Your Name
              </label>
              <input
                className="input"
                placeholder="e.g. Rohan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                autoFocus
              />
            </div>

            {mode === 'create' ? (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Room Name <span className="text-slate-600">(optional)</span>
                  </label>
                  <input
                    className="input"
                    placeholder="e.g. Sunday Strikers Auction"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    maxLength={40}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Purse Size (per player)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[50, 100, 150, 200].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPurseSize(p)}
                        className={`rounded-xl border py-2.5 text-sm font-bold transition-all ${
                          purseSize === p
                            ? 'border-turf-500 bg-turf-500/15 text-turf-400'
                            : 'border-slate-600 bg-pitch-800 text-slate-400 hover:border-slate-400'
                        }`}
                      >
                        ₹{p} Cr
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Room Code
                </label>
                <input
                  className="input text-center text-2xl font-bold tracking-[0.3em] uppercase"
                  placeholder="ABCD"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={4}
                />
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-pitch-950/30 border-t-pitch-950" />
              ) : mode === 'create' ? (
                '🏏 Create Room'
              ) : (
                '🚪 Join Room'
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          4–10 players · One host runs the auction · Everyone else bids
        </p>
      </div>
    </main>
  )
}
