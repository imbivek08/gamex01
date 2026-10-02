-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('LOBBY', 'AUCTION', 'COMPLETE');

-- CreateEnum
CREATE TYPE "PlayerRole" AS ENUM ('WK', 'BAT', 'BOWL', 'AR');

-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('PENDING', 'CURRENT', 'SOLD', 'UNSOLD');

-- CreateEnum
CREATE TYPE "AuctionPhase" AS ENUM ('IDLE', 'BIDDING', 'COUNTDOWN', 'SOLD_PENDING', 'UNSOLD_PENDING', 'COMPLETE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "socketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "purseSize" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "status" "RoomStatus" NOT NULL DEFAULT 'LOBBY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "purse" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "online" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "PlayerRole" NOT NULL,
    "rating" INTEGER NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomPlayer" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "PlayerStatus" NOT NULL DEFAULT 'PENDING',
    "soldToId" TEXT,
    "soldFor" DOUBLE PRECISION,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RoomPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "roomPlayerId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "roomPlayerId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionState" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "currentRoomPlayerId" TEXT,
    "currentBid" DOUBLE PRECISION,
    "currentBidderId" TEXT,
    "phase" "AuctionPhase" NOT NULL DEFAULT 'IDLE',
    "countdownEndsAt" TIMESTAMP(3),
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuctionState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Room_code_key" ON "Room"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_roomId_userId_key" ON "Participant"("roomId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomPlayer_roomId_playerId_key" ON "RoomPlayer"("roomId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionState_roomId_key" ON "AuctionState"("roomId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomPlayer" ADD CONSTRAINT "RoomPlayer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomPlayer" ADD CONSTRAINT "RoomPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomPlayer" ADD CONSTRAINT "RoomPlayer_soldToId_fkey" FOREIGN KEY ("soldToId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_roomPlayerId_fkey" FOREIGN KEY ("roomPlayerId") REFERENCES "RoomPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_roomPlayerId_fkey" FOREIGN KEY ("roomPlayerId") REFERENCES "RoomPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionState" ADD CONSTRAINT "AuctionState_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
