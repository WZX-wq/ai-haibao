# Dev Startup

## Stable commands

Run both frontend and backend in one foreground session:

```bash
npm run serve
```

Run both services in the background:

```bash
npm run serve:bg
```

Check whether ports `5173` and `7001` are up:

```bash
npm run serve:status
```

Stop the background services started by `serve:bg`:

```bash
npm run serve:stop
```

## Notes

- Frontend runs on `http://127.0.0.1:5173/`
- Backend runs on `http://127.0.0.1:7001/`
- Background logs are written to `runlogs/frontend.log`, `runlogs/frontend.err.log`, `runlogs/backend.log`, and `runlogs/backend.err.log`
- The old Windows-unfriendly shell chaining has been replaced by a repo-native orchestrator in `scripts/dev-orchestrator.mjs`
