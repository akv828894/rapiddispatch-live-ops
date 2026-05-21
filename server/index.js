import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import { Server } from 'socket.io'

const PORT = process.env.PORT || 4000
const defaultClientOrigins =
  'http://localhost:5173,https://rapiddispatch-live-ops.vercel.app'

const allowedOrigins = (process.env.CLIENT_ORIGIN || defaultClientOrigins)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const app = express()
app.use(express.json())
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
)

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

const tickets = new Map([
  [
    'RD-105',
    {
      id: 'RD-105',
      customer: 'Northstar Produce',
      route: 'DAL -> OKC',
      subject: 'Reefer unit stopped cooling',
      priority: 'Critical',
      status: 'Open',
      createdAt: new Date(Date.now() - 1000 * 60 * 34).toISOString(),
      notes:
        'Driver reports temperature rising above contract threshold. Customer expects ETA update before dispatch cut-off.',
      resolution: '',
    },
  ],
  [
    'RD-118',
    {
      id: 'RD-118',
      customer: 'Hawthorne Auto Parts',
      route: 'FTW -> PHX',
      subject: 'Missed pickup window',
      priority: 'High',
      status: 'Open',
      createdAt: new Date(Date.now() - 1000 * 60 * 51).toISOString(),
      notes:
        'Carrier arrived after dock closure. Need revised pickup and customer communication.',
      resolution: '',
    },
  ],
  [
    'RD-124',
    {
      id: 'RD-124',
      customer: 'Blue Mesa Retail',
      route: 'DAL -> AUS',
      subject: 'Duplicate accessorial charge',
      priority: 'Medium',
      status: 'In Review',
      createdAt: new Date(Date.now() - 1000 * 60 * 73).toISOString(),
      notes:
        'Billing flagged duplicate detention charge on invoice. Operations needs final confirmation.',
      resolution: 'Waiting on carrier proof of arrival.',
    },
  ],
  [
    'RD-131',
    {
      id: 'RD-131',
      customer: 'Metro Medical Supply',
      route: 'HOU -> DAL',
      subject: 'Delivery appointment moved',
      priority: 'High',
      status: 'Open',
      createdAt: new Date(Date.now() - 1000 * 60 * 96).toISOString(),
      notes:
        'Receiving team requested a later appointment. Confirm driver hours before committing.',
      resolution: '',
    },
  ],
])

const ticketLocks = new Map()

function getDashboardState() {
  return {
    tickets: [...tickets.values()].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    ),
    locks: [...ticketLocks.values()],
  }
}

function broadcastLocks() {
  io.emit('locks_updated', [...ticketLocks.values()])
}

function releaseLocksForSocket(socketId) {
  const released = []

  for (const [ticketId, lock] of ticketLocks.entries()) {
    if (lock.socketId === socketId) {
      ticketLocks.delete(ticketId)
      released.push(lock)
    }
  }

  if (released.length > 0) {
    broadcastLocks()
    io.emit('tickets_released', released)
  }
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'rapiddispatch-live-ops',
    activeLocks: ticketLocks.size,
    connectedClients: io.engine.clientsCount,
  })
})

app.get('/api/tickets', (_req, res) => {
  res.json(getDashboardState())
})

io.on('connection', (socket) => {
  socket.on('join_dashboard', ({ agentName } = {}) => {
    socket.data.agentName = agentName || 'Support Agent'
    socket.emit('dashboard_snapshot', getDashboardState())
  })

  socket.on('create_ticket', (payload = {}, ack) => {
    const id = `RD-${Math.floor(200 + Math.random() * 700)}`
    const ticket = {
      id,
      customer: payload.customer?.trim() || 'Unassigned Account',
      route: payload.route?.trim() || 'Dispatch pending',
      subject: payload.subject?.trim() || 'New support request',
      priority: payload.priority || 'Medium',
      status: 'Open',
      createdAt: new Date().toISOString(),
      notes: payload.notes?.trim() || 'Ticket opened from live operations board.',
      resolution: '',
    }

    tickets.set(id, ticket)
    io.emit('ticket_created', ticket)
    ack?.({ ok: true, ticket })
  })

  socket.on('lock_ticket', ({ ticketId, agentName } = {}, ack) => {
    if (!tickets.has(ticketId)) {
      ack?.({ ok: false, reason: 'Ticket not found.' })
      return
    }

    const existingLock = ticketLocks.get(ticketId)
    if (existingLock && existingLock.socketId !== socket.id) {
      ack?.({
        ok: false,
        reason: `Ticket is already locked by ${existingLock.agentName}.`,
        lock: existingLock,
      })
      return
    }

    const lock = {
      ticketId,
      socketId: socket.id,
      agentName: agentName?.trim() || socket.data.agentName || 'Support Agent',
      lockedAt: new Date().toISOString(),
    }

    ticketLocks.set(ticketId, lock)
    io.emit('ticket_locked', lock)
    broadcastLocks()
    ack?.({ ok: true, lock })
  })

  socket.on('save_ticket', ({ ticketId, resolution, status } = {}, ack) => {
    const lock = ticketLocks.get(ticketId)
    const ticket = tickets.get(ticketId)

    if (!ticket) {
      ack?.({ ok: false, reason: 'Ticket not found.' })
      return
    }

    if (!lock || lock.socketId !== socket.id) {
      ack?.({ ok: false, reason: 'You do not hold the active lock.' })
      return
    }

    const updatedTicket = {
      ...ticket,
      status: status || ticket.status,
      resolution: resolution ?? ticket.resolution,
      updatedAt: new Date().toISOString(),
    }

    tickets.set(ticketId, updatedTicket)
    ticketLocks.delete(ticketId)
    io.emit('ticket_updated', updatedTicket)
    io.emit('ticket_unlocked', { ticketId, releasedBy: socket.id })
    broadcastLocks()
    ack?.({ ok: true, ticket: updatedTicket })
  })

  socket.on('unlock_ticket', ({ ticketId } = {}, ack) => {
    const lock = ticketLocks.get(ticketId)

    if (!lock) {
      ack?.({ ok: true })
      return
    }

    if (lock.socketId !== socket.id) {
      ack?.({ ok: false, reason: 'Only the lock owner can release this ticket.' })
      return
    }

    ticketLocks.delete(ticketId)
    io.emit('ticket_unlocked', { ticketId, releasedBy: socket.id })
    broadcastLocks()
    ack?.({ ok: true })
  })

  socket.on('disconnect', () => {
    releaseLocksForSocket(socket.id)
  })
})

httpServer.listen(PORT, () => {
  console.log(`RapidDispatch Live Ops server running on port ${PORT}`)
})
