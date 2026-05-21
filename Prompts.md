# AI Transparency Notes

This project was built with AI assistance during local development.

Prompts used:

- Asked for help planning a Week 19 real-time helpdesk project with React, Express, Socket.io, in-memory ticket locks, and ghost disconnect handling.
- Asked for implementation support for a production-style Socket.io server using a `Map` as the source of truth for ticket locks.
- Asked for UI support for a two-window demo that shows live lock state, disabled edit buttons, reconnect warning, save/unlock, close/unlock, and new-ticket streaming.

Manual review checklist:

- Confirm `lock_ticket` rejects requests when another socket owns the ticket.
- Confirm `unlock_ticket` only releases locks owned by the current socket.
- Confirm `disconnect` scans the lock map and broadcasts released tickets.
- Confirm there is no polling loop or `setInterval` in the frontend.
