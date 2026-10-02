import http from 'node:http'
import cors from 'cors'
import express from 'express'
import { Server } from 'socket.io'
import { registerSocketHandlers } from './socket'

const PORT = Number(process.env.PORT ?? 4000)
const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())

const app = express()
app.use(cors({ origin: CLIENT_ORIGIN }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() })
})

const server = http.createServer(app)

const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
})

registerSocketHandlers(io)

server.listen(PORT, () => {
  console.log(`🏏 Cricket Auction server listening on http://localhost:${PORT}`)
})
