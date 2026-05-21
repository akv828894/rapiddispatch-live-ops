import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Clock3,
  Lock,
  Plus,
  Radio,
  Save,
  Truck,
  Unlock,
  X,
} from 'lucide-react'
import { io } from 'socket.io-client'
import './App.css'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000'
const AGENTS = ['Aarav Singh', 'Meera Iyer', 'Kabir Sharma', 'Nisha Rao']

function getStoredAgent() {
  const saved = localStorage.getItem('rapidDispatchAgent')
  if (saved) return saved
  const next = AGENTS[Math.floor(Math.random() * AGENTS.length)]
  localStorage.setItem('rapidDispatchAgent', next)
  return next
}

function App() {
  const socketRef = useRef(null)
  const [agentName, setAgentName] = useState(getStoredAgent)
  const [socketId, setSocketId] = useState('')
  const [tickets, setTickets] = useState([])
  const [locks, setLocks] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [connection, setConnection] = useState('connecting')
  const [notice, setNotice] = useState('')
  const [draft, setDraft] = useState({ resolution: '', status: 'Open' })
  const [newTicket, setNewTicket] = useState({
    customer: '',
    route: '',
    subject: '',
    priority: 'High',
    notes: '',
  })

  const lockByTicket = useMemo(
    () => new Map(locks.map((lock) => [lock.ticketId, lock])),
    [locks],
  )

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedId)
  const selectedLock = selectedId ? lockByTicket.get(selectedId) : null
  const ownsSelectedLock = selectedLock?.socketId === socketId

  useEffect(() => {
    localStorage.setItem('rapidDispatchAgent', agentName)
    socketRef.current?.emit('join_dashboard', { agentName })
  }, [agentName])

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 700,
      reconnectionDelayMax: 3000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setSocketId(socket.id)
      setConnection('connected')
      socket.emit('join_dashboard', { agentName })
    })

    socket.on('disconnect', () => {
      setConnection('disconnected')
    })

    socket.on('reconnect_attempt', () => {
      setConnection('connecting')
    })

    socket.on('dashboard_snapshot', ({ tickets: liveTickets, locks: liveLocks }) => {
      setTickets(liveTickets)
      setLocks(liveLocks)
    })

    socket.on('ticket_created', (ticket) => {
      setTickets((current) => [ticket, ...current.filter((item) => item.id !== ticket.id)])
    })

    socket.on('ticket_updated', (ticket) => {
      setTickets((current) =>
        current.map((item) => (item.id === ticket.id ? ticket : item)),
      )
    })

    socket.on('ticket_locked', (lock) => {
      setLocks((current) => [
        ...current.filter((item) => item.ticketId !== lock.ticketId),
        lock,
      ])
    })

    socket.on('ticket_unlocked', ({ ticketId }) => {
      setLocks((current) => current.filter((item) => item.ticketId !== ticketId))
    })

    socket.on('locks_updated', (liveLocks) => {
      setLocks(liveLocks)
    })

    socket.on('tickets_released', (released) => {
      const names = released.map((lock) => lock.agentName).join(', ')
      setNotice(`Disconnected editor released ${released.length} ticket(s): ${names}`)
    })

    return () => {
      socket.disconnect()
    }
  }, [agentName])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 4200)
    return () => window.clearTimeout(timer)
  }, [notice])

  function selectTicket(ticket) {
    const lock = lockByTicket.get(ticket.id)
    if (lock && lock.socketId !== socketId) {
      setSelectedId(ticket.id)
      return
    }

    socketRef.current?.emit(
      'lock_ticket',
      { ticketId: ticket.id, agentName },
      (response) => {
        if (!response?.ok) {
          setNotice(response?.reason || 'Ticket could not be locked.')
          return
        }

        setSelectedId(ticket.id)
        setDraft({
          resolution: ticket.resolution || '',
          status: ticket.status || 'Open',
        })
      },
    )
  }

  function closeEditor() {
    if (selectedId && ownsSelectedLock) {
      socketRef.current?.emit('unlock_ticket', { ticketId: selectedId })
    }
    setSelectedId(null)
  }

  function saveTicket() {
    socketRef.current?.emit(
      'save_ticket',
      {
        ticketId: selectedId,
        resolution: draft.resolution,
        status: draft.status,
      },
      (response) => {
        if (!response?.ok) {
          setNotice(response?.reason || 'Ticket could not be saved.')
          return
        }
        setSelectedId(null)
        setNotice(`${selectedId} saved and released for the team.`)
      },
    )
  }

  function createTicket(event) {
    event.preventDefault()
    socketRef.current?.emit('create_ticket', newTicket, (response) => {
      if (!response?.ok) {
        setNotice('Ticket could not be created.')
        return
      }
      setNewTicket({
        customer: '',
        route: '',
        subject: '',
        priority: 'High',
        notes: '',
      })
      setNotice(`${response.ticket.id} added to the live board.`)
    })
  }

  const openCount = tickets.filter((ticket) => ticket.status !== 'Resolved').length

  return (
    <main className="app-shell">
      {connection !== 'connected' && (
        <div className="connection-banner">
          <AlertTriangle size={18} />
          Connection Lost: Reconnecting...
        </div>
      )}

      <header className="topbar">
        <div>
          <p className="eyebrow">RapidDispatch Freight & Logistics</p>
          <h1>Live Ops Helpdesk</h1>
        </div>

        <div className="agent-panel">
          <label htmlFor="agentName">Active agent</label>
          <input
            id="agentName"
            value={agentName}
            onChange={(event) => setAgentName(event.target.value)}
          />
          <span className={`socket-state ${connection}`}>
            <Radio size={15} />
            {connection === 'connected' ? 'Live socket' : 'Reconnecting'}
          </span>
        </div>
      </header>

      <section className="metrics-strip" aria-label="Operations summary">
        <div>
          <span>{tickets.length}</span>
          Total tickets
        </div>
        <div>
          <span>{openCount}</span>
          Active workload
        </div>
        <div>
          <span>{locks.length}</span>
          Locked now
        </div>
        <div>
          <span>0</span>
          Polling calls
        </div>
      </section>

      {notice && <div className="notice">{notice}</div>}

      <section className="workspace">
        <section className="ticket-board" aria-label="Live ticket board">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Dispatch support queue</p>
              <h2>Active Tickets</h2>
            </div>
            <div className="live-pill">
              <span />
              Streaming
            </div>
          </div>

          <div className="ticket-list">
            {tickets.map((ticket) => {
              const lock = lockByTicket.get(ticket.id)
              const isLockedByOther = lock && lock.socketId !== socketId
              const isMine = lock?.socketId === socketId

              return (
                <article
                  key={ticket.id}
                  className={`ticket-row ${lock ? 'locked' : ''} ${isMine ? 'mine' : ''}`}
                >
                  <div className="ticket-main">
                    <div className="ticket-id">
                      <Truck size={17} />
                      {ticket.id}
                      <span className={`priority ${ticket.priority.toLowerCase()}`}>
                        {ticket.priority}
                      </span>
                    </div>
                    <h3>{ticket.subject}</h3>
                    <p>
                      {ticket.customer} · {ticket.route}
                    </p>
                    {lock && (
                      <div className="lock-note">
                        <Lock size={15} />
                        Locked by {lock.agentName}
                      </div>
                    )}
                  </div>

                  <div className="ticket-actions">
                    <span className="status">{ticket.status}</span>
                    <button
                      type="button"
                      onClick={() => selectTicket(ticket)}
                      disabled={isLockedByOther}
                      title={isLockedByOther ? `Locked by ${lock.agentName}` : 'Edit ticket'}
                    >
                      {isMine ? <Unlock size={16} /> : <Lock size={16} />}
                      Edit
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <aside className="side-panel">
          <form className="new-ticket" onSubmit={createTicket}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Intake</p>
                <h2>New Ticket</h2>
              </div>
              <Plus size={19} />
            </div>

            <input
              value={newTicket.customer}
              onChange={(event) =>
                setNewTicket((current) => ({ ...current, customer: event.target.value }))
              }
              placeholder="Customer"
              required
            />
            <input
              value={newTicket.route}
              onChange={(event) =>
                setNewTicket((current) => ({ ...current, route: event.target.value }))
              }
              placeholder="Route, e.g. DAL -> DEN"
            />
            <input
              value={newTicket.subject}
              onChange={(event) =>
                setNewTicket((current) => ({ ...current, subject: event.target.value }))
              }
              placeholder="Issue summary"
              required
            />
            <select
              value={newTicket.priority}
              onChange={(event) =>
                setNewTicket((current) => ({ ...current, priority: event.target.value }))
              }
            >
              <option>Critical</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
            <textarea
              value={newTicket.notes}
              onChange={(event) =>
                setNewTicket((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Internal notes"
              rows="4"
            />
            <button type="submit">
              <Plus size={16} />
              Add live ticket
            </button>
          </form>

          <div className="ops-note">
            <Clock3 size={18} />
            Locks are owned by the active socket. Closing a locked tab releases that ticket
            from the server disconnect handler.
          </div>
        </aside>
      </section>

      {selectedTicket && (
        <div className="editor-backdrop" role="presentation">
          <section className="editor" role="dialog" aria-modal="true">
            <div className="editor-header">
              <div>
                <p className="eyebrow">{selectedTicket.id}</p>
                <h2>{selectedTicket.subject}</h2>
              </div>
              <button type="button" className="icon-button" onClick={closeEditor}>
                <X size={18} />
              </button>
            </div>

            <div className="ticket-context">
              <p>{selectedTicket.customer}</p>
              <p>{selectedTicket.notes}</p>
            </div>

            {selectedLock && !ownsSelectedLock ? (
              <div className="locked-editor">
                <Lock size={22} />
                Locked by {selectedLock.agentName}
              </div>
            ) : (
              <>
                <label>
                  Status
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, status: event.target.value }))
                    }
                  >
                    <option>Open</option>
                    <option>In Review</option>
                    <option>Waiting on Carrier</option>
                    <option>Resolved</option>
                  </select>
                </label>
                <label>
                  Resolution
                  <textarea
                    value={draft.resolution}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        resolution: event.target.value,
                      }))
                    }
                    rows="7"
                    placeholder="Write the customer-safe resolution note..."
                  />
                </label>
                <div className="editor-actions">
                  <button type="button" className="secondary" onClick={closeEditor}>
                    <Unlock size={16} />
                    Close
                  </button>
                  <button type="button" onClick={saveTicket}>
                    <Save size={16} />
                    Save & release
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

export default App
