/**
 * End-to-end multiplayer test: simulates a host + 3 bidders over Socket.IO
 * and exercises the full auction flow including validation.
 *
 * Uses a continuous state tracker to avoid broadcast race conditions.
 *
 * Run with: npx tsx test-e2e.ts  (server must be running on :4000)
 */
import { io, type Socket } from 'socket.io-client'

const URL = process.env.TEST_URL ?? 'http://localhost:4000'

function connect(): Socket {
  return io(URL, { transports: ['websocket'], forceNew: true })
}

function emitAck(socket: Socket, event: string, payload?: unknown): Promise<any> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (res: any) => resolve(res))
  })
}

/** Attach a continuous state tracker to a socket. */
function trackState(socket: Socket) {
  const latest: { current: any } = { current: null }
  socket.on('room:state', (s: any) => {
    latest.current = s
  })
  return latest
}

/** Poll the tracked state until predicate matches or timeout. */
async function waitFor(
  latest: { current: any },
  predicate: (s: any) => boolean,
  label: string,
): Promise<any> {
  const start = Date.now()
  while (Date.now() - start < 60000) {
    if (latest.current && predicate(latest.current)) return latest.current
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error(`Timeout waiting for: ${label}`)
}

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++
    console.log(`  ✅ ${label}`)
  } else {
    failed++
    console.error(`  ❌ ${label}`)
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log('🏏 Cricket Auction E2E test\n')

  // --- Setup: host creates room, 3 bidders join ---
  console.log('1. Room creation & joining')
  const host = connect()
  const hostState = trackState(host)
  const hostRes = await emitAck(host, 'room:create', {
    name: 'HostHarry',
    roomName: 'Test Auction',
    purseSize: 100,
  })
  assert(hostRes.ok && hostRes.code?.length === 4, `host created room (code: ${hostRes?.code})`)
  const code = hostRes.code

  const bidders: Socket[] = []
  const bidderNames = ['BidderA', 'BidderB', 'BidderC']
  for (const name of bidderNames) {
    const b = connect()
    const res = await emitAck(b, 'room:join', { name, code })
    assert(res.ok, `${name} joined room`)
    bidders.push(b)
  }

  // 4th bidder joins (room has space)
  const extra = connect()
  const extraRes = await emitAck(extra, 'room:join', { name: 'BidderD', code })
  assert(extraRes.ok, '4th bidder joined (room has space)')

  // --- Lobby state ---
  console.log('\n2. Lobby state')
  const lobbyState = await waitFor(hostState, (s) => s.participants.length >= 4, '4 participants')
  assert(lobbyState.room.status === 'LOBBY', 'room is in LOBBY')
  assert(lobbyState.participants.length >= 4, `at least 4 participants (${lobbyState.participants.length})`)
  assert(lobbyState.you?.isHost === true, 'host sees isHost=true')

  // --- Start auction ---
  console.log('\n3. Start auction')
  await emitAck(host, 'auction:start')
  const auctionState = await waitFor(hostState, (s) => s.auction.phase === 'COUNTDOWN', 'automatic COUNTDOWN phase')
  assert(auctionState.room.status === 'AUCTION', 'room is now AUCTION')
  assert(auctionState.auction.currentPlayer !== null, 'first player is up')
  assert(auctionState.auction.currentBid === null, 'no bids yet')
  const firstPlayer = auctionState.auction.currentPlayer
  console.log(`   First player: ${firstPlayer.name} (${firstPlayer.role}, ${firstPlayer.rating}, base ₹${firstPlayer.basePrice} Cr)`)

  // --- Bidding ---
  console.log('\n4. Bidding & validation')
  const basePrice = firstPlayer.basePrice

  const lowBid = await emitAck(bidders[0], 'bid:place', { amount: basePrice - 0.5 })
  assert(lowBid?.ok === false, 'bid below base price rejected')

  const bid1 = await emitAck(bidders[0], 'bid:place', { amount: basePrice })
  assert(bid1?.ok === true, `BidderA bid ₹${basePrice} Cr`)

  const sameBid = await emitAck(bidders[1], 'bid:place', { amount: basePrice })
  assert(sameBid?.ok === false, 'bid equal to current rejected')

  const badIncrement = await emitAck(bidders[1], 'bid:place', { amount: basePrice + 0.3 })
  assert(badIncrement?.ok === false, 'bid with bad increment rejected')

  const bid2 = await emitAck(bidders[1], 'bid:place', { amount: basePrice + 1 })
  assert(bid2?.ok === true, `BidderB raised to ₹${basePrice + 1} Cr`)

  const hostBid = await emitAck(host, 'bid:place', { amount: basePrice + 2 })
  assert(hostBid?.ok === false, 'host bid rejected')

  const bidState = await waitFor(
    hostState,
    (s) => s.auction.currentBid?.amount === basePrice + 1,
    'BidderB highest',
  )
  assert(bidState.auction.currentBid.bidderName === 'BidderB', 'BidderB is highest bidder')
  assert(bidState.auction.bidHistory.length === 2, `bid history has 2 entries (${bidState.auction.bidHistory.length})`)

  // --- Countdown ---
  console.log('\n5. Countdown')
  const cdState = await waitFor(hostState, (s) => s.auction.phase === 'COUNTDOWN', 'COUNTDOWN')
  assert(cdState.auction.countdownEndsAt !== null, 'countdown is running')
  const initialCountdownEndsAt = cdState.auction.countdownEndsAt

  const bid3 = await emitAck(bidders[2], 'bid:place', { amount: basePrice + 2 })
  assert(bid3?.ok === true, 'bid during countdown accepted')
  const resetState = await waitFor(
    hostState,
    (s) => s.auction.currentBid?.amount === basePrice + 2,
    'reset bid state',
  )
  assert(
    resetState.auction.countdownEndsAt > initialCountdownEndsAt,
    'countdown reset after a new bid',
  )

  const pendingState = await waitFor(hostState, (s) => s.auction.phase === 'SOLD_PENDING', 'SOLD_PENDING')
  assert(pendingState.auction.currentBid.amount === basePrice + 2, 'highest bid carried into SOLD_PENDING')

  // --- Confirm sold ---
  console.log('\n6. Confirm SOLD')
  await emitAck(host, 'auction:confirmSold')
  const soldState = await waitFor(
    hostState,
    (s) => s.auction.phase === 'COUNTDOWN' && s.auction.currentPlayer?.id !== firstPlayer.id,
    'next player after sold',
  )
  assert(soldState.auction.soldPlayers.length === 1, 'player marked as sold')
  assert(soldState.auction.soldPlayers[0].soldToName === 'BidderC', 'sold to BidderC')
  const bidderC = soldState.participants.find((p: any) => p.name === 'BidderC')
  assert(Math.abs(bidderC.purse - (100 - (basePrice + 2))) < 0.01, `BidderC purse debited (₹${bidderC.purse} Cr left)`)

  // --- Skip player ---
  console.log('\n7. Skip player')
  const skipState = await waitFor(hostState, (s) => s.auction.currentPlayer !== null, 'player up for skip')
  const skippedPlayer = skipState.auction.currentPlayer
  await emitAck(host, 'auction:skipPlayer')
  const afterSkip = await waitFor(
    hostState,
    (s) => s.auction.currentPlayer?.id !== skippedPlayer.id,
    'player after skip',
  )
  assert(afterSkip.auction.soldPlayers.length === 1, 'skipped player not in sold list')

  // --- Unsold flow ---
  console.log('\n8. Unsold flow')
  const unsoldPlayer = afterSkip.auction.currentPlayer
  const unsoldPending = await waitFor(hostState, (s) => s.auction.phase === 'UNSOLD_PENDING', 'UNSOLD_PENDING')
  assert(unsoldPending.auction.currentPlayer.id === unsoldPlayer.id, 'UNSOLD_PENDING for player with no bids')
  await emitAck(host, 'auction:confirmUnsold')
  const afterUnsold = await waitFor(
    hostState,
    (s) => s.auction.currentPlayer?.id !== unsoldPlayer.id,
    'player after unsold',
  )
  assert(afterUnsold.auction.soldPlayers.length === 1, 'unsold player not added to sold list')

  // --- Pause/resume ---
  console.log('\n9. Pause / resume')
  await emitAck(host, 'auction:pause')
  await waitFor(hostState, (s) => s.auction.paused === true, 'paused')
  const pausedBid = await emitAck(bidders[0], 'bid:place', { amount: 50 })
  assert(pausedBid?.ok === false, 'bid rejected while paused')
  await emitAck(host, 'auction:resume')
  const resumedState = await waitFor(hostState, (s) => s.auction.paused === false, 'resumed')
  assert(resumedState.auction.paused === false, 'auction resumed')

  // --- Select player validation ---
  console.log('\n10. Select player validation')
  const badSelect = await emitAck(host, 'auction:selectPlayer', { roomPlayerId: 'nonexistent' })
  assert(badSelect?.ok === false, 'selectPlayer rejects invalid id')

  // --- Persistence: late join rejected ---
  console.log('\n11. Persistence')
  const refresher = connect()
  const stillThere = await emitAck(refresher, 'room:join', { name: 'LateLarry', code })
  assert(stillThere?.ok === false, 'late join rejected (auction already running)')

  // --- Summary ---
  console.log(`\n${'='.repeat(40)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  console.log('='.repeat(40))

  host.disconnect()
  bidders.forEach((b) => b.disconnect())
  extra.disconnect()
  refresher.disconnect()

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('Test crashed:', e)
  process.exit(1)
})
