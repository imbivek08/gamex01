'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { getSocket } from '@/lib/socket'
import type { ChatMessage } from '@/lib/types'

const QUICK_CHATS = ['🔥 Nice bid!', '👏 Well played', '😮 What a player!', '💰 Going once!', '🙌 Let’s go!']

export default function ChatPanel({ messages, participantId }: { messages: ChatMessage[]; participantId?: string }) {
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = (text: string, kind: 'TEXT' | 'QUICK' = 'TEXT') => {
    const value = text.trim()
    if (!value) return
    getSocket().emit('chat:send', { text: value, kind })
    setDraft('')
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    send(draft)
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-slate-100">Room chat</h2>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Keep the auction lively</p>
        </div>
        <span className="text-xl">💬</span>
      </div>
      <div className="max-h-72 min-h-32 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 && <p className="py-8 text-center text-xs text-slate-500">Say hello to the room 👋</p>}
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.participantId === participantId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${message.participantId === participantId ? 'rounded-br-sm bg-turf-500/20' : 'rounded-bl-sm bg-pitch-800'}`}>
              <p className="mb-0.5 text-[10px] font-bold text-slate-400">{message.participantName}</p>
              <p className="break-words text-sm text-slate-100">{message.text}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="border-t border-slate-700/60 p-3">
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {QUICK_CHATS.map((quickChat) => (
            <button key={quickChat} type="button" onClick={() => send(quickChat, 'QUICK')} className="whitespace-nowrap rounded-full border border-slate-700 bg-pitch-800 px-2.5 py-1 text-xs text-slate-300 hover:border-turf-500/60 hover:text-slate-100">
              {quickChat}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex gap-2">
          <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={240} placeholder="Message the room…" className="input min-w-0 px-3 py-2 text-sm" />
          <button type="submit" disabled={!draft.trim()} className="btn-primary shrink-0 px-4 py-2 text-sm">Send</button>
        </form>
      </div>
    </section>
  )
}
