// Mirrors server/src/types.ts — keep in sync.

export type Role = 'WK' | 'BAT' | 'BOWL' | 'AR'
export type RoomStatus = 'LOBBY' | 'AUCTION' | 'COMPLETE'
export type AuctionPhase =
  | 'IDLE'
  | 'BIDDING'
  | 'COUNTDOWN'
  | 'SOLD_PENDING'
  | 'UNSOLD_PENDING'
  | 'WAITING_FOR_HOST'
  | 'COMPLETE'

export interface PublicRoomPlayer {
  id: string
  name: string
  role: Role
  rating: number
  basePrice: number
  nationality: string | null
  age: number | null
  battingStyle: string | null
  bowlingStyle: string | null
  matchesPlayed: number | null
  runs: number | null
  wickets: number | null
  strikeRate: number | null
  economyRate: number | null
  bio: string | null
  status: 'PENDING' | 'CURRENT' | 'SOLD' | 'UNSOLD'
  soldFor: number | null
  soldToId: string | null
  soldToName: string | null
}

export interface PublicParticipant {
  id: string
  userId: string
  name: string
  isHost: boolean
  purse: number
  online: boolean
  squadCount: number
}

export interface PublicBid {
  id: string
  amount: number
  bidderId: string
  bidderName: string
  createdAt: string
}

export interface PublicCurrentBid {
  amount: number
  bidderId: string
  bidderName: string
}

export interface AuctionSnapshot {
  phase: AuctionPhase
  currentPlayer: PublicRoomPlayer | null
  pendingPlayers: PublicRoomPlayer[]
  currentBid: PublicCurrentBid | null
  countdownEndsAt: number | null
  paused: boolean
  bidHistory: PublicBid[]
  soldPlayers: PublicRoomPlayer[]
}

export interface ResultsEntry {
  participantId: string
  name: string
  squad: Array<{ name: string; role: Role; rating: number; amount: number }>
  spent: number
  remaining: number
}

export interface RoomSnapshot {
  room: {
    id: string
    code: string
    name: string
    status: RoomStatus
    purseSize: number
    hostId: string
    createdAt: string
  }
  participants: PublicParticipant[]
  you: { participantId: string; isHost: boolean } | null
  auction: AuctionSnapshot
  results: ResultsEntry[] | null
}

export type NotificationType =
  | 'bid'
  | 'sold'
  | 'unsold'
  | 'info'
  | 'error'
  | 'countdown'
  | 'complete'

export interface AppNotification {
  type: NotificationType
  message: string
}
