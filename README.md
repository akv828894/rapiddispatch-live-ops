# RapidDispatch Live Ops Helpdesk

Real-time support ticket board for RapidDispatch Freight & Logistics. The app uses React, Express, and Socket.io to prevent support agents from overwriting each other while editing the same ticket.

## Features

- Live ticket board with Socket.io updates
- No polling or `setInterval`
- Server-owned in-memory ticket locks with `Map`
- Locked rows turn gray and show the agent holding the lock
- Edit buttons are disabled for every socket except the lock owner
- Save and close both release the lock
- Ghost disconnect handling releases tickets when a locked tab closes
- Reconnect warning banner for dropped WebSocket connections
- Live new-ticket creation broadcast to every connected dashboard

## Local Setup

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Backend health check: `http://localhost:4000/health`

## Demo Script

1. Open `http://localhost:5173` in two browser windows side by side.
2. Use different agent names in each window.
3. In Window 1, click **Edit** on a ticket.
4. Window 2 should instantly show the gray locked row, lock icon, "Locked by [Agent Name]", and disabled Edit button.
5. In Window 1, click **Save & release** or **Close**.
6. Window 2 should instantly unlock the ticket.
7. For ghost disconnect: lock a ticket in Window 1, then close that tab. Window 2 should unlock automatically after the socket disconnects.

## Deployment Notes

Backend environment on Render:

```bash
PORT=4000
CLIENT_ORIGIN=https://your-vercel-app.vercel.app
```

Frontend environment on Vercel:

```bash
VITE_SOCKET_URL=https://your-render-service.onrender.com
```

Socket.io will use WSS automatically when the frontend loads over HTTPS and connects to the HTTPS Render URL.
