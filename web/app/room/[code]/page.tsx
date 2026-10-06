'use client'

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getSocket } from '@/lib/socket'
import type { AppNotification, ChatMessage, RoomSnapshot } from '@/lib/types'
import Lobby from '@/components/Lobby'
import AuctionRoom from '@/components/AuctionRoom'
import Results from '@/components/Results'
import Toasts, { type Toast } from '@/components/Toasts'
import ChatPanel from '@/components/ChatPanel'

interface StoredIdentity {
  userId: string
  name: string
}

function getStoredIdentity(code: string): StoredIdentity | null {
  try {
    const raw = localStorage.getItem(`auction:${code}`)
    return raw ? (JSON.parse(raw) as StoredIdentity) : null
  } catch {
    return null
  }
}

export default function RoomPage() {
  const params = useParams<{ code: string }>()
  const code = (params.code ?? '').toUpperCase()

  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining] = useState(true)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const snapshotRef = useRef<RoomSnapshot | null>(null)
  snapshotRef.current = snapshot

  const pushToast = useCallback((n: AppNotification) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev.slice(-3), { id, ...n }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  useEffect(() => {
    const socket = getSocket()
    let cancelled = false

    const identity = getStoredIdentity(code)

    const onState = (state: RoomSnapshot) => {
      if (cancelled) return
      // Room-wide engine broadcasts do not include recipient-specific identity.
      // Keep the identity established during room join so host controls remain
      // available after auction state transitions.
      setSnapshot((previous) => ({
        ...state,
        you: state.you ?? previous?.you ?? null,
      }))
      setJoining(false)
      setJoinError('')
    }

    const onNotification = (n: AppNotification) => {
      if (cancelled) return
      pushToast(n)
    }
    const onChatMessage = (message: ChatMessage) => setChatMessages((previous) => [...previous, message].slice(-100))

    const onConnect = () => {
      if (cancelled) return
      setConnected(true)
      setChatMessages([])
      // (Re-)join the room on every (re)connect so state survives refreshes.
      socket.emit(
        'room:join',
        {
          code,
          name: identity?.name ?? 'Player',
          userId: identity?.userId,
        },
        (res: { ok: boolean; error?: string; userId?: string; name?: string }) => {
          if (cancelled) return
          if (res.ok && res.userId) {
            localStorage.setItem(
              `auction:${code}`,
              JSON.stringify({ userId: res.userId, name: res.name ?? identity?.name ?? 'Player' }),
            )
          } else if (!res.ok) {
            setJoining(false)
            setJoinError(res.error ?? 'Could not join room')
          }
        },
      )
    }

    const onDisconnect = () => {
      if (cancelled) return
      setConnected(false)
    }

    socket.on('room:state', onState)
    socket.on('notification', onNotification)
    socket.on('chat:message', onChatMessage)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    if (socket.connected) onConnect()

    return () => {
      cancelled = true
      socket.off('room:state', onState)
      socket.off('notification', onNotification)
      socket.off('chat:message', onChatMessage)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [code, pushToast])

  // ---------- render ----------

  if (joining) {
    return (
      <Centered>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-turf-500/30 border-t-turf-500" />
        <p className="mt-4 text-sm text-slate-400">Joining room {code}…</p>
      </Centered>
    )
  }

  if (joinError) {
    return (
      <Centered>
        <div className="card max-w-sm p-8 text-center">
          <div className="mb-3 text-4xl">😕</div>
          <h2 className="mb-2 text-lg font-bold">Couldn&apos;t join</h2>
          <p className="mb-6 text-sm text-slate-400">{joinError}</p>
          <a href="/" className="btn-primary w-full">
            Back to Home
          </a>
        </div>
      </Centered>
    )
  }

  if (!snapshot) {
    return (
      <Centered>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-turf-500/30 border-t-turf-500" />
        <p className="mt-4 text-sm text-slate-400">Loading room…</p>
      </Centered>
    )
  }

  const isHost = snapshot.you?.isHost ?? false

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-4 py-6">
      {/* Connection status */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Room {snapshot.room.code}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            connected ? 'bg-turf-500/15 text-turf-400' : 'bg-amber-500/15 text-amber-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              connected ? 'bg-turf-400' : 'animate-pulse bg-amber-400'
            }`}
          />
          {connected ? 'Live' : 'Reconnecting…'}
        </span>
      </div>

      {snapshot.room.status === 'LOBBY' && (
        <Lobby snapshot={snapshot} isHost={isHost} />
      )}

      {snapshot.room.status === 'AUCTION' && (
        <AuctionRoom snapshot={snapshot} isHost={isHost} />
      )}

      {snapshot.room.status === 'COMPLETE' && (
        <Results snapshot={snapshot} isHost={isHost} />
      )}

      <div className="mt-4">
        <ChatPanel messages={chatMessages} participantId={snapshot.you?.participantId} />
      </div>

      <Toasts toasts={toasts} />
    </main>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4">{children}</main>
  )
}
