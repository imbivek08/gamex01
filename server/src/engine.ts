import type { Server } from 'socket.io'
import { prisma } from './db'
import type {
  AppNotification,
  AuctionPhase,
  AuctionSnapshot,
  PublicBid,
  PublicCurrentBid,
  PublicParticipant,
  PublicPlayer,
  PublicRoomPlayer,
  ResultsEntry,
  RoomSnapshot,
} from './types'

export const COUNTDOWN_MS = 45_000
export const MIN_BID_INCREMENT = 0.5
export const MAX_PARTICIPANTS = 10

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no ambiguous chars (0/O, 1/I/L)

export function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return code
}

function roundToCr(value: number): number {
  return Math.round(value * 2) / 2
}

interface EngineState {
  phase: AuctionPhase
  currentRoomPlayerId: string | null
  currentBid: number | null
  currentBidderId: string | null
  countdownEndsAt: number | null
  countdownTimer: NodeJS.Timeout | null
  paused: boolean
  countdownRemainingMs: number | null
}

/**
 * Server-authoritative auction engine for a single room.
 * Every mutation is validated, persisted to PostgreSQL, then broadcast.
 */
export class AuctionEngine {
  private state: EngineState = {
    phase: 'IDLE',
    currentRoomPlayerId: null,
    currentBid: null,
    currentBidderId: null,
    countdownEndsAt: null,
    countdownTimer: null,
    paused: false,
    countdownRemainingMs: null,
  }

  constructor(
    private readonly io: Server,
    private readonly roomId: string,
    private readonly broadcastRoom?: () => Promise<void>,
  ) {}

  // ---------- persistence ----------

  private async persistState() {
    await prisma.auctionState.upsert({
      where: { roomId: this.roomId },
      create: {
        roomId: this.roomId,
        currentRoomPlayerId: this.state.currentRoomPlayerId,
        currentBid: this.state.currentBid,
        currentBidderId: this.state.currentBidderId,
        phase: this.state.phase,
        countdownEndsAt: this.state.countdownEndsAt
          ? new Date(this.state.countdownEndsAt)
          : null,
        paused: this.state.paused,
      },
      update: {
        currentRoomPlayerId: this.state.currentRoomPlayerId,
        currentBid: this.state.currentBid,
        currentBidderId: this.state.currentBidderId,
        phase: this.state.phase,
        countdownEndsAt: this.state.countdownEndsAt
          ? new Date(this.state.countdownEndsAt)
          : null,
        paused: this.state.paused,
      },
    })
  }

  /** Rebuild in-memory state from the database (used on server boot). */
  static async recover(
    io: Server,
    roomId: string,
    broadcastRoom?: () => Promise<void>,
  ): Promise<AuctionEngine | null> {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { auctionState: true },
    })
    if (!room || !room.auctionState) return null

    const engine = new AuctionEngine(io, roomId, broadcastRoom)
    const s = room.auctionState
    engine.state.phase = s.phase
    engine.state.currentRoomPlayerId = s.currentRoomPlayerId
    engine.state.currentBid = s.currentBid
    engine.state.currentBidderId = s.currentBidderId
    engine.state.paused = s.paused
    // A running countdown does not survive a restart. Keep the player open so
    // the host can start a fresh countdown after reconnecting.
    if (engine.state.phase === 'COUNTDOWN') {
      engine.state.phase = 'BIDDING'
      engine.state.countdownEndsAt = null
    }
    return engine
  }

  // ---------- broadcasting ----------

  private async broadcast() {
    if (this.broadcastRoom) {
      await this.broadcastRoom()
      return
    }
    const snapshot = await this.getSnapshot()
    this.io.to(this.roomId).emit('room:state', snapshot)
  }

  private notify(type: AppNotification['type'], message: string) {
    this.io.to(this.roomId).emit('notification', { type, message } satisfies AppNotification)
  }

  // ---------- queries ----------

  async getSnapshot(): Promise<RoomSnapshot> {
    const room = await prisma.room.findUniqueOrThrow({
      where: { id: this.roomId },
      include: {
        participants: {
          include: {
            user: true,
            squad: { include: { roomPlayer: { include: { player: true } } } },
          },
          orderBy: { joinedAt: 'asc' },
        },
        players: {
          include: { player: true, soldTo: true },
          orderBy: { order: 'asc' },
        },
        purchases: {
          include: { roomPlayer: { include: { player: true } }, bidder: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    const participants: PublicParticipant[] = room.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.name,
      isHost: p.isHost,
      purse: p.purse,
      online: p.online,
      squadCount: p.squad.length,
    }))

    const toPublicRoomPlayer = (rp: (typeof room.players)[number]): PublicRoomPlayer => ({
      id: rp.id,
      name: rp.player.name,
      role: rp.player.role,
      rating: rp.player.rating,
      basePrice: rp.player.basePrice,
      status: rp.status,
      soldFor: rp.soldFor,
      soldToId: rp.soldToId,
      soldToName: rp.soldTo?.name ?? null,
    })

    const currentRoomPlayer = room.players.find((rp) => rp.id === this.state.currentRoomPlayerId) ?? null

    let bidHistory: PublicBid[] = []
    if (currentRoomPlayer) {
      const bids = await prisma.bid.findMany({
        where: { roomPlayerId: currentRoomPlayer.id },
        include: { bidder: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      bidHistory = bids.map((b) => ({
        id: b.id,
        amount: b.amount,
        bidderId: b.bidderId,
        bidderName: b.bidder.name,
        createdAt: b.createdAt.toISOString(),
      }))
    }

    const soldPlayers = room.players
      .filter((rp) => rp.status === 'SOLD')
      .map(toPublicRoomPlayer)
    const pendingPlayers = room.players
      .filter((rp) => rp.status === 'PENDING')
      .map(toPublicRoomPlayer)

    const currentBid: PublicCurrentBid | null = this.state.currentBid !== null
      ? {
          amount: this.state.currentBid,
          bidderId: this.state.currentBidderId!,
          bidderName:
            room.participants.find((p) => p.id === this.state.currentBidderId)?.name ?? 'Unknown',
        }
      : null

    const auction: AuctionSnapshot = {
      phase: this.state.phase,
      currentPlayer: currentRoomPlayer ? toPublicRoomPlayer(currentRoomPlayer) : null,
      pendingPlayers,
      currentBid,
      countdownEndsAt: this.state.countdownEndsAt,
      paused: this.state.paused,
      bidHistory,
      soldPlayers,
    }

    let results: ResultsEntry[] | null = null
    if (room.status === 'COMPLETE') {
      results = room.participants
        .filter((p) => !p.isHost)
        .map((p) => ({
          participantId: p.id,
          name: p.name,
          squad: p.squad.map((s) => ({
            name: s.roomPlayer.player.name,
            role: s.roomPlayer.player.role,
            rating: s.roomPlayer.player.rating,
            amount: s.amount,
          })),
          spent: roundToCr(p.squad.reduce((sum, s) => sum + s.amount, 0)),
          remaining: p.purse,
        }))
    }

    return {
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        status: room.status,
        purseSize: room.purseSize,
        hostId: room.hostId,
        createdAt: room.createdAt.toISOString(),
      },
      participants,
      you: null, // filled in by the socket layer
      auction,
      results,
    }
  }

  // ---------- host controls ----------

  async startAuction(): Promise<void> {
    const room = await prisma.room.findUniqueOrThrow({ where: { id: this.roomId } })
    if (room.status !== 'LOBBY') throw new Error('Auction has already started')
    const bidders = await prisma.participant.count({
      where: { roomId: this.roomId, isHost: false },
    })
    if (bidders < 1) throw new Error('Need at least one bidder to start')

    await prisma.room.update({ where: { id: this.roomId }, data: { status: 'AUCTION' } })
    await this.advanceToNextPlayer()
    this.notify('info', 'The auction is live! First player is up.')
    await this.broadcast()
  }

  async pause(): Promise<void> {
    if (this.state.phase !== 'BIDDING' && this.state.phase !== 'COUNTDOWN') {
      throw new Error('Nothing to pause')
    }
    if (this.state.countdownTimer) {
      clearTimeout(this.state.countdownTimer)
      this.state.countdownTimer = null
      if (this.state.countdownEndsAt) {
        this.state.countdownRemainingMs = Math.max(0, this.state.countdownEndsAt - Date.now())
      }
      this.state.countdownEndsAt = null
    }
    this.state.paused = true
    await this.persistState()
    this.notify('info', 'Auction paused by host')
    await this.broadcast()
  }

  async resume(): Promise<void> {
    if (!this.state.paused) throw new Error('Auction is not paused')
    this.state.paused = false
    if (this.state.phase === 'COUNTDOWN' && this.state.countdownRemainingMs !== null) {
      this.state.countdownEndsAt = Date.now() + this.state.countdownRemainingMs
      this.state.countdownRemainingMs = null
      this.state.countdownTimer = setTimeout(() => this.onCountdownEnd(), this.state.countdownEndsAt - Date.now())
    }
    await this.persistState()
    this.notify('info', 'Auction resumed')
    await this.broadcast()
  }

  async startCountdown(): Promise<void> {
    if (this.state.phase !== 'BIDDING' || !this.state.currentRoomPlayerId) {
      throw new Error('No player is currently up for auction')
    }
    if (this.state.paused) throw new Error('Auction is paused')
    this.startCountdownTimer()
    await this.persistState()
    this.notify('countdown', 'Going once… going twice…')
    await this.broadcast()
  }

  private startAutomaticCountdown() {
    this.state.phase = 'COUNTDOWN'
    this.startCountdownTimer()
    this.notify('countdown', 'Bidding is live — closing in 45 seconds.')
  }

  private startCountdownTimer() {
    if (this.state.countdownTimer) {
      clearTimeout(this.state.countdownTimer)
    }
    this.state.countdownEndsAt = Date.now() + COUNTDOWN_MS
    this.state.countdownTimer = setTimeout(() => {
      this.onCountdownEnd().catch((error) => {
        console.error(`Countdown settlement failed for room ${this.roomId}:`, error)
      })
    }, COUNTDOWN_MS)
  }

  private resetCountdownAfterBid() {
    if (this.state.phase !== 'COUNTDOWN' || this.state.paused) return
    this.startCountdownTimer()
  }

  async skipPlayer(): Promise<void> {
    if (!this.state.currentRoomPlayerId) throw new Error('No player is currently up')
    if (this.state.phase !== 'BIDDING' && this.state.phase !== 'COUNTDOWN') {
      throw new Error('Confirm the current player first')
    }
    await this.clearCountdown()
    await prisma.roomPlayer.update({
      where: { id: this.state.currentRoomPlayerId },
      data: { status: 'UNSOLD' },
    })
    this.notify('unsold', 'Player skipped by host')
    await this.waitForHostToSelectNext()
    await this.broadcast()
  }

  /** Host picks any pending player to auction next. */
  async selectPlayer(roomPlayerId: string): Promise<void> {
    const rp = await prisma.roomPlayer.findFirst({
      where: { id: roomPlayerId, roomId: this.roomId },
    })
    if (!rp) throw new Error('Player not found in this room')
    if (rp.status !== 'PENDING') throw new Error('Player is not available')
    if (this.state.phase !== 'WAITING_FOR_HOST') {
      throw new Error('Wait for the current player to be settled first')
    }
    await this.clearCountdown()
    if (this.state.currentRoomPlayerId) {
      await prisma.roomPlayer.update({
        where: { id: this.state.currentRoomPlayerId },
        data: { status: 'PENDING' },
      })
    }
    await prisma.roomPlayer.update({
      where: { id: roomPlayerId },
      data: { status: 'CURRENT' },
    })
    this.state.currentRoomPlayerId = roomPlayerId
    this.state.currentBid = null
    this.state.currentBidderId = null
    this.startAutomaticCountdown()
    await this.persistState()
    this.notify('info', 'Host selected a new player')
    await this.broadcast()
  }

  async selectRandomPlayer(): Promise<void> {
    if (this.state.phase !== 'WAITING_FOR_HOST') {
      throw new Error('Wait for the current player to be settled first')
    }
    const pending = await prisma.roomPlayer.findMany({
      where: { roomId: this.roomId, status: 'PENDING' },
      select: { id: true },
    })
    if (pending.length === 0) {
      throw new Error('No players remain in the auction pool')
    }
    const selected = pending[Math.floor(Math.random() * pending.length)]
    await this.selectPlayer(selected.id)
  }

  async confirmSold(): Promise<void> {
    if (this.state.phase !== 'SOLD_PENDING' || !this.state.currentRoomPlayerId) {
      throw new Error('No sale to confirm')
    }
    if (this.state.currentBid === null || !this.state.currentBidderId) {
      throw new Error('Cannot confirm a sale without a winning bid')
    }
    const roomPlayerId = this.state.currentRoomPlayerId
    const amount = this.state.currentBid
    const bidderId = this.state.currentBidderId

    await this.clearCountdown()

    // Persist: mark sold, debit purse, record purchase — all in one transaction.
    await prisma.$transaction(async (tx) => {
      await tx.roomPlayer.update({
        where: { id: roomPlayerId },
        data: { status: 'SOLD', soldToId: bidderId, soldFor: amount },
      })
      await tx.participant.update({
        where: { id: bidderId },
        data: { purse: { decrement: amount } },
      })
      await tx.purchase.create({
        data: { roomId: this.roomId, roomPlayerId, bidderId, amount },
      })
    })

    const player = await prisma.roomPlayer.findUniqueOrThrow({
      where: { id: roomPlayerId },
      include: { player: true },
    })
    const bidder = await prisma.participant.findUniqueOrThrow({ where: { id: bidderId } })
    this.notify('sold', `${player.player.name} SOLD to ${bidder.name} for ₹${amount.toFixed(1)} Cr!`)

    await this.waitForHostToSelectNext()
    await this.broadcast()
  }

  async confirmUnsold(): Promise<void> {
    if (this.state.phase !== 'UNSOLD_PENDING' || !this.state.currentRoomPlayerId) {
      throw new Error('No unsold confirmation pending')
    }
    const roomPlayerId = this.state.currentRoomPlayerId
    await this.clearCountdown()
    await prisma.roomPlayer.update({
      where: { id: roomPlayerId },
      data: { status: 'UNSOLD' },
    })
    const player = await prisma.roomPlayer.findUniqueOrThrow({
      where: { id: roomPlayerId },
      include: { player: true },
    })
    this.notify('unsold', `${player.player.name} went UNSOLD`)
    await this.waitForHostToSelectNext()
    await this.broadcast()
  }

  // ---------- bidding ----------

  async placeBid(participantId: string, rawAmount: number): Promise<void> {
    // --- validation ---
    const room = await prisma.room.findUniqueOrThrow({ where: { id: this.roomId } })
    if (room.status !== 'AUCTION') throw new Error('The auction is not live')

    const participant = await prisma.participant.findFirst({
      where: { id: participantId, roomId: this.roomId },
      include: { user: true },
    })
    if (!participant) throw new Error('You are not in this room')
    if (participant.isHost) throw new Error('The host cannot bid')
    if (!participant.online) throw new Error('You are disconnected')

    if (this.state.paused) throw new Error('The auction is paused')
    if (this.state.phase !== 'BIDDING' && this.state.phase !== 'COUNTDOWN') {
      throw new Error('Bidding is closed for this player')
    }
    if (!this.state.currentRoomPlayerId) throw new Error('No player is up for auction')

    const roomPlayer = await prisma.roomPlayer.findUniqueOrThrow({
      where: { id: this.state.currentRoomPlayerId },
      include: { player: true },
    })
    if (roomPlayer.status !== 'CURRENT') throw new Error('This player is no longer available')

    if (!Number.isFinite(rawAmount) || rawAmount <= 0) throw new Error('Enter a valid bid amount')
    // Validate the raw amount is a valid increment BEFORE rounding.
    if (rawAmount % MIN_BID_INCREMENT !== 0) {
      throw new Error(`Bids must be in steps of ₹${MIN_BID_INCREMENT.toFixed(1)} Cr`)
    }
    const amount = roundToCr(rawAmount)

    const minBid = this.state.currentBid ?? roomPlayer.player.basePrice
    if (amount < minBid) {
      throw new Error(
        this.state.currentBid === null
          ? `Bid must be at least the base price of ₹${roomPlayer.player.basePrice.toFixed(1)} Cr`
          : `Bid must be higher than ₹${this.state.currentBid.toFixed(1)} Cr`,
      )
    }
    if (this.state.currentBid !== null && amount - this.state.currentBid < MIN_BID_INCREMENT) {
      throw new Error(`Minimum raise is ₹${MIN_BID_INCREMENT.toFixed(1)} Cr`)
    }
    if (amount > participant.purse) {
      throw new Error(`Insufficient purse — you have ₹${participant.purse.toFixed(1)} Cr left`)
    }

    // --- persist + update state ---
    await prisma.bid.create({
      data: {
        roomId: this.roomId,
        roomPlayerId: roomPlayer.id,
        bidderId: participant.id,
        amount,
      },
    })
    this.state.currentBid = amount
    this.state.currentBidderId = participant.id
    this.resetCountdownAfterBid()
    await this.persistState()

    this.notify('bid', `${participant.name} bids ₹${amount.toFixed(1)} Cr for ${roomPlayer.player.name}!`)
    await this.broadcast()
  }

  // ---------- internals ----------

  private async onCountdownEnd() {
    this.state.countdownTimer = null
    this.state.countdownEndsAt = null
    if (this.state.phase !== 'COUNTDOWN') return

    const roomPlayerId = this.state.currentRoomPlayerId
    const amount = this.state.currentBid
    const bidderId = this.state.currentBidderId
    if (!roomPlayerId) {
      throw new Error('Countdown ended without a current player')
    }

    this.state.phase = amount !== null && bidderId !== null ? 'SOLD_PENDING' : 'UNSOLD_PENDING'
    await this.persistState()
    const player = await prisma.roomPlayer.findUniqueOrThrow({
      where: { id: roomPlayerId },
      include: { player: true },
    })
    this.notify(
      amount !== null && bidderId !== null ? 'info' : 'unsold',
      amount !== null && bidderId !== null
        ? `${player.player.name} is ready to be sold for ₹${amount.toFixed(1)} Cr. Host: confirm SOLD.`
        : `${player.player.name} has no bids. Host: confirm UNSOLD.`,
    )
    await this.broadcast()
  }

  private async clearCountdown() {
    if (this.state.countdownTimer) {
      clearTimeout(this.state.countdownTimer)
      this.state.countdownTimer = null
    }
    this.state.countdownEndsAt = null
    this.state.countdownRemainingMs = null
  }



  /** Host brings the next player up for auction. */
  async nextPlayer(): Promise<void> {
    if (this.state.phase !== 'WAITING_FOR_HOST') {
      throw new Error('Not waiting for host to bring next player')
    }
    await this.advanceToNextPlayer()
    await this.broadcast()
  }

  private async waitForHostToSelectNext() {
    await this.clearCountdown()
    const remaining = await prisma.roomPlayer.count({
      where: { roomId: this.roomId, status: 'PENDING' },
    })
    if (remaining === 0) {
      this.state.phase = 'COMPLETE'
      this.state.currentRoomPlayerId = null
      this.state.currentBid = null
      this.state.currentBidderId = null
      await prisma.room.update({ where: { id: this.roomId }, data: { status: 'COMPLETE' } })
      await this.persistState()
      this.notify('complete', 'Auction complete! Check the final results.')
      return
    }
    this.state.currentRoomPlayerId = null
    this.state.currentBid = null
    this.state.currentBidderId = null
    this.state.phase = 'WAITING_FOR_HOST'
    this.state.paused = false
    await this.persistState()
  }

  /** Move to the next pending player, or finish the auction. */
  private async advanceToNextPlayer() {
    const next = await prisma.roomPlayer.findFirst({
      where: { roomId: this.roomId, status: 'PENDING' },
      orderBy: { order: 'asc' },
    })

    if (!next) {
      await this.clearCountdown()
      this.state.phase = 'COMPLETE'
      this.state.currentRoomPlayerId = null
      this.state.currentBid = null
      this.state.currentBidderId = null
      await prisma.room.update({ where: { id: this.roomId }, data: { status: 'COMPLETE' } })
      await this.persistState()
      this.notify('complete', 'Auction complete! Check the final results.')
      return
    }

    await prisma.roomPlayer.update({ where: { id: next.id }, data: { status: 'CURRENT' } })
    this.state.currentRoomPlayerId = next.id
    this.state.currentBid = null
    this.state.currentBidderId = null
    this.startAutomaticCountdown()
    this.state.paused = false
    await this.persistState()
  }
}

/** Manages all live engines and room membership. */
export class AuctionManager {
  private engines = new Map<string, AuctionEngine>()

  constructor(
    private readonly io: Server,
    private readonly broadcastRoom?: (roomId: string) => Promise<void>,
  ) {}

  async registerRoom(roomId: string) {
    if (this.engines.has(roomId)) return this.engines.get(roomId)!
    const engine = await AuctionEngine.recover(
      this.io,
      roomId,
      this.broadcastRoom ? () => this.broadcastRoom!(roomId) : undefined,
    )
    if (engine) {
      this.engines.set(roomId, engine)
      return engine
    }
    const fresh = new AuctionEngine(
      this.io,
      roomId,
      this.broadcastRoom ? () => this.broadcastRoom!(roomId) : undefined,
    )
    this.engines.set(roomId, fresh)
    return fresh
  }

  getEngine(roomId: string): AuctionEngine | undefined {
    return this.engines.get(roomId)
  }

  /** Rebuild engines for rooms that were mid-auction when the server (re)started. */
  async recoverAll() {
    const states = await prisma.auctionState.findMany({
      where: { phase: { in: ['BIDDING', 'COUNTDOWN', 'SOLD_PENDING', 'UNSOLD_PENDING', 'WAITING_FOR_HOST'] } },
      select: { roomId: true },
    })
    for (const { roomId } of states) {
      await this.registerRoom(roomId)
    }
    if (states.length > 0) {
      console.log(`Recovered ${states.length} in-progress auction(s)`)
    }
  }
}
