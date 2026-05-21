# Submission Links

GitHub repository:

https://github.com/akv828894/rapiddispatch-live-ops

Frontend deployment:

https://rapiddispatch-live-ops.vercel.app

Backend deployment:

Render deployment is configured through `render.yaml`. Create a Render Blueprint or Web Service from this GitHub repository and set:

```bash
CLIENT_ORIGIN=https://rapiddispatch-live-ops.vercel.app
```

After Render gives the backend URL, add it to Vercel:

```bash
VITE_SOCKET_URL=https://your-render-service.onrender.com
```

Then redeploy the Vercel project.
