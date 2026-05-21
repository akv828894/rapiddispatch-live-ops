# Development Assistance Log

This file is included for the course transparency requirement.

Support requested during development:

- Planning the real-time helpdesk flow for ticket locking, release, and ghost disconnects.
- Structuring a Socket.io server where an in-memory `Map` owns active ticket locks.
- Reviewing the two-window demo path for lock state, disabled edit buttons, reconnect warning, save/release, close/release, and live ticket creation.

Manual review checklist:

- Confirm `lock_ticket` rejects requests when another socket owns the ticket.
- Confirm `unlock_ticket` only releases locks owned by the current socket.
- Confirm `disconnect` scans the lock map and broadcasts released tickets.
- Confirm there is no polling loop or `setInterval` in the frontend.
