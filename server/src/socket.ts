import type { Server, Socket } from 'socket.io'
import { prisma } from './db'
import { AuctionEngine, AuctionManager, generateRoomCode, MAX_PARTICIPANTS } from './engine'
import type { RoomSnapshot } from './types'

interface JoinPayload {
  code: string
  name: string
  userId?: string
}

export function registerSocketHandlers(io: Server) {
  let manager: AuctionManager

  const broadcastState = async (roomId: string) => {
    const engine = manager.getEngine(roomId)
    if (!engine) return
    const sockets = await io.in(roomId).fetchSockets()
    for (const s of sockets) {
      const participantId = (s.data as { participantId?: string }).participantId ?? null
      const snapshot: RoomSnapshot = await engine.getSnapshot()
      snapshot.you = participantId
        ? {
            participantId,
            isHost: snapshot.participants.find((p) => p.id === participantId)?.isHost ?? false,
          }
        : null
      s.emit('room:state', snapshot)
    }
  }

  manager = new AuctionManager(io, broadcastState)

  // Recover any auctions that were live before a server restart.
  manager.recoverAll().catch((e) => console.error('Failed to recover auctions:', e))

  io.on('connection', (socket: Socket) => {
    let currentRoomId: string | null = null
    let currentParticipantId: string | null = null

    const joinRoomSocket = (roomId: string) => {
      currentRoomId = roomId
      socket.join(roomId)
    }

    const leaveRoomSocket = () => {
      if (currentRoomId) socket.leave(currentRoomId)
      currentRoomId = null
      currentParticipantId = null
    }

    /** Send the full room snapshot, scoped to the requesting participant. */
    const sendState = async (roomId: string, participantId: string | null) => {
      const engine = manager.getEngine(roomId)
      if (!engine) return
      const snapshot: RoomSnapshot = await engine.getSnapshot()
      snapshot.you = participantId
        ? {
            participantId,
            isHost: snapshot.participants.find((p) => p.id === participantId)?.isHost ?? false,
          }
        : null
      socket.emit('room:state', snapshot)
    }

    const handleError = (cb: unknown, message: string) => {
      if (typeof cb === 'function') cb({ ok: false, error: message })
      socket.emit('notification', { type: 'error', message })
    }

    // ---------- create room ----------
    socket.on('room:create', async (payload: { name: string; roomName?: string; purseSize?: number }, cb) => {
      try {
        const name = (payload.name ?? '').trim()
        if (!name) return handleError(cb, 'Please enter your name')
        const purseSize = payload.purseSize ?? 100
        if (![50, 100, 150, 200].includes(purseSize)) {
          return handleError(cb, 'Invalid purse size')
        }

        const code = generateRoomCode()
        const hostUser = await prisma.user.create({
          data: { name, socketId: socket.id },
        })
        const room = await prisma.room.create({
          data: {
            code,
            name: (payload.roomName ?? '').trim() || `${name}'s Auction`,
            purseSize,
            hostId: hostUser.id,
            participants: {
              create: { name, isHost: true, purse: purseSize, userId: hostUser.id },
            },
          },
          include: { participants: true },
        })

        const host = room.participants.find((p) => p.isHost)!

        const engine = await manager.registerRoom(room.id)
        // Assign the seeded player pool to this room in random order.
        const allPlayers = await prisma.player.findMany()
        const shuffled = [...allPlayers].sort(() => Math.random() - 0.5)
        await prisma.roomPlayer.createMany({
          data: shuffled.map((p, i) => ({ roomId: room.id, playerId: p.id, order: i })),
        })
        await engine.getSnapshot() // warm the engine

        joinRoomSocket(room.id)
        currentParticipantId = host.id
        socket.data.participantId = host.id
        if (typeof cb === 'function') {
          cb({ ok: true, code: room.code, userId: room.hostId, participantId: host.id })
        }
        await sendState(room.id, host.id)
        io.emit('room:created', { code: room.code })
      } catch (e) {
        console.error('room:create failed', e)
        handleError(cb, 'Failed to create room')
      }
    })

    // ---------- join room (also used for reconnection) ----------
    socket.on('room:join', async (payload: JoinPayload, cb) => {
      try {
        const code = (payload.code ?? '').trim().toUpperCase()
        const name = (payload.name ?? '').trim()
        if (!code) return handleError(cb, 'Please enter a room code')
        if (!name) return handleError(cb, 'Please enter your name')

        const room = await prisma.room.findUnique({
          where: { code },
          include: { participants: { include: { user: true } } },
        })
        if (!room) return handleError(cb, 'Room not found — check the code')

        // Reconnecting? Same userId already seated in this room.
        if (payload.userId) {
          const existing = room.participants.find((p) => p.userId === payload.userId)
          if (existing) {
            const wasOffline = !existing.online
            await prisma.participant.update({
              where: { id: existing.id },
              data: { online: true, name },
            })
            await prisma.user.update({
              where: { id: existing.userId },
              data: { socketId: socket.id, name },
            })
            const engine = await manager.registerRoom(room.id)
            joinRoomSocket(room.id)
            currentParticipantId = existing.id
            socket.data.participantId = existing.id
            if (typeof cb === 'function') {
              cb({ ok: true, code: room.code, userId: existing.userId, participantId: existing.id })
            }
            await sendState(room.id, existing.id)
            // Broadcast to the room so presence (online/offline) stays accurate.
            await broadcastState(room.id)
            if (wasOffline) {
              io.to(room.id).emit('notification', {
                type: 'info',
                message: `${existing.name} reconnected`,
              })
            }
            return
          }
        }

        // New participant
        if (room.status !== 'LOBBY') {
          return handleError(cb, 'This room is no longer accepting players')
        }
        if (room.participants.length >= MAX_PARTICIPANTS) {
          return handleError(cb, 'Room is full (10 players max)')
        }

        const user = await prisma.user.create({
          data: { name, socketId: socket.id },
        })
        const participant = await prisma.participant.create({
          data: { roomId: room.id, userId: user.id, name, purse: room.purseSize },
        })

        const engine = await manager.registerRoom(room.id)
        joinRoomSocket(room.id)
        currentParticipantId = participant.id
        socket.data.participantId = participant.id
        if (typeof cb === 'function') {
          cb({ ok: true, code: room.code, userId: user.id, participantId: participant.id })
        }
        // Broadcast updated state to the whole room so everyone sees the new player.
        await broadcastState(room.id)
        io.to(room.id).emit('notification', {
          type: 'info',
          message: `${name} joined the room`,
        })
      } catch (e) {
        console.error('room:join failed', e)
        handleError(cb, 'Failed to join room')
      }
    })

    // ---------- host controls ----------
    const hostAction = async (fn: (engine: AuctionEngine) => Promise<void>): Promise<void> => {
      if (!currentRoomId || !currentParticipantId) throw new Error('Not in a room')
      const engine = manager.getEngine(currentRoomId)
      if (!engine) throw new Error('Room not found')
      await fn(engine)
    }

    const requireHost = async (): Promise<boolean> => {
      if (!currentParticipantId) return false
      const p = await prisma.participant.findUnique({ where: { id: currentParticipantId } })
      return p?.isHost ?? false
    }

    const hostHandler =
      (fn: (engine: AuctionEngine) => Promise<void>) =>
      async (_: unknown, cb: unknown) => {
        if (!(await requireHost())) return handleError(cb, 'Only the host can do that')
        try {
          await hostAction(fn)
          if (typeof cb === 'function') cb({ ok: true })
        } catch (e) {
          handleError(cb, e instanceof Error ? e.message : 'Action failed')
        }
      }

    socket.on('auction:start', hostHandler((e) => e.startAuction()))
    socket.on('auction:pause', hostHandler((e) => e.pause()))
    socket.on('auction:resume', hostHandler((e) => e.resume()))
    socket.on('auction:startCountdown', hostHandler((e) => e.startCountdown()))
    socket.on('auction:skipPlayer', hostHandler((e) => e.skipPlayer()))
    socket.on('auction:nextPlayer', hostHandler((e) => e.nextPlayer()))
    socket.on('auction:bringNextPlayer', hostHandler((e) => e.nextPlayer()))
    socket.on('auction:randomPlayer', hostHandler((e) => e.selectRandomPlayer()))
    socket.on('auction:selectPlayer', (payload: { roomPlayerId: string }, cb: unknown) => {
      hostHandler((e) => e.selectPlayer(payload.roomPlayerId))({}, cb)
    })
    socket.on('auction:confirmSold', hostHandler((e) => e.confirmSold()))
    socket.on('auction:confirmUnsold', hostHandler((e) => e.confirmUnsold()))

    // ---------- bidding ----------
    socket.on('bid:place', async (payload: { amount: number }, cb) => {
      if (!currentRoomId || !currentParticipantId) {
        return handleError(cb, 'You are not in a room')
      }
      const engine = manager.getEngine(currentRoomId)
      if (!engine) return handleError(cb, 'Room not found')
      try {
        await engine.placeBid(currentParticipantId, payload.amount)
        if (typeof cb === 'function') cb({ ok: true })
      } catch (e) {
        handleError(cb, e instanceof Error ? e.message : 'Bid rejected')
      }
    })

    // ---------- disconnect / presence ----------
    socket.on('disconnect', async () => {
      if (currentParticipantId) {
        await prisma.participant
          .update({ where: { id: currentParticipantId }, data: { online: false } })
          .catch(() => {})
        if (currentRoomId) {
          const engine = manager.getEngine(currentRoomId)
          if (engine) {
            await broadcastState(currentRoomId).catch(() => {})
          }
        }
      }
      leaveRoomSocket()
    })
  })
}
