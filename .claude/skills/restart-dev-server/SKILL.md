---
name: restart-dev-server
description: Use at the end of every coding task in this project (บังโต POS / pung-to-pos) that touched app code. Stops any Nuxt dev server already running and starts a fresh one, left running, so the user always has an up-to-date preview to open without doing it themselves.
---

# Restart dev server after finishing a prompt

This project's convention: whenever a prompt in this repo involved changing
app code (pages, components, server routes, schema, config — anything that
affects the running app), end the turn by restarting the Nuxt dev server and
**leaving it running** for the user. Don't stop it again afterward — that's
the one thing this skill changes from the default "start it, test it, kill
it" verification pattern.

Skip this for prompts that didn't touch app code (pure discussion, memory
updates, reviewing a file, etc.) — no server to restart.

## Steps

1. **Find and stop any server already listening on port 3000.**

   ```bash
   netstat -ano | grep ':3000' | grep LISTENING
   ```

   If a PID shows up, kill it:

   ```bash
   taskkill //PID <pid> //F
   ```

   Nuxt keeps a dev-server lock file; if you skip this step and try to start
   a second instance, it fails with "Another Nuxt dev server is already
   running" instead of actually starting.

2. **Start a fresh dev server in the background.**

   ```bash
   (npm run dev > /tmp/nuxt-dev.log 2>&1 &)
   ```

3. **Wait for it to come up, then confirm.**

   ```bash
   timeout 40 bash -c 'until curl -sf http://localhost:3000/api/health >/dev/null 2>&1; do sleep 1; done' && echo READY
   ```

   If it times out, check `/tmp/nuxt-dev.log` for the actual error (port
   conflict, migration failure, syntax error) rather than retrying blindly.

4. **Leave it running.** Do not `taskkill` it at the end of the turn. Tell
   the user the dev server is up at `http://localhost:3000` so they can look
   at the change themselves.

## Notes specific to this repo

- This is a Windows environment; PowerShell is the primary shell but the
  Bash tool (Git Bash) is what this workflow uses — `netstat`/`taskkill`
  syntax above is Git Bash's (`//PID` and `//F` with doubled leading
  slashes, since a single `/` gets mangled by Git Bash's path conversion).
- `npm run db:seed` / `npm run db:migrate` are separate commands, not part
  of `npm run dev` — run them first if a task changed the schema, before
  starting the server in step 2.
- If you were mid-way through using the dev server for your own
  verification (curl smoke tests, etc.) when the task finished, that
  running instance already satisfies step 2–3 — just skip straight to
  leaving it running instead of killing and restarting redundantly.
