import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const rootDir = path.resolve(path.dirname(__filename), '..')
const serviceDir = path.join(rootDir, 'service')
const runlogsDir = path.join(rootDir, 'runlogs')
const pidFile = path.join(runlogsDir, 'dev-processes.json')
const isWin = process.platform === 'win32'
const npmCmd = isWin ? 'npm.cmd' : 'npm'

function readSimpleEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const out = {}
  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    out[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
  }
  return out
}

const localEnv = {
  ...readSimpleEnvFile(path.join(rootDir, '.env.local')),
  ...readSimpleEnvFile(path.join(rootDir, '.env')),
}
const devHostname = String(localEnv.VITE_DEV_HOSTNAME || '').trim()
const frontendPort = Number(localEnv.VITE_DEV_PORT || (devHostname ? 443 : 5173))
const frontendUrl =
  devHostname && frontendPort === 443
    ? `https://${devHostname}/`
    : `${devHostname ? 'https' : 'http'}://${devHostname || '127.0.0.1'}:${frontendPort}/`

const targets = [
  {
    name: 'frontend',
    cwd: rootDir,
    port: frontendPort,
    url: frontendUrl,
    command: npmCmd,
    args: ['run', 'dev'],
    stdout: path.join(runlogsDir, 'frontend.log'),
    stderr: path.join(runlogsDir, 'frontend.err.log'),
  },
  {
    name: 'backend',
    cwd: serviceDir,
    port: 7001,
    url: 'http://127.0.0.1:7001/design/cate?type=1',
    command: npmCmd,
    args: ['run', 'dev'],
    stdout: path.join(runlogsDir, 'backend.log'),
    stderr: path.join(runlogsDir, 'backend.err.log'),
  },
]

const args = new Set(process.argv.slice(2))

function ensureRunlogsDir() {
  fs.mkdirSync(runlogsDir, { recursive: true })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function checkTcpPort(target) {
  return await new Promise((resolve) => {
    const url = new URL(target.url)
    const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80))
    const socket = net.createConnection(
      {
        host: url.hostname,
        port,
      },
      () => {
        socket.destroy()
        resolve(true)
      },
    )
    socket.on('error', () => resolve(false))
    socket.setTimeout(3000, () => {
      socket.destroy()
      resolve(false)
    })
  })
}

async function checkTarget(target) {
  return new Promise((resolve) => {
    try {
      const url = new URL(target.url)
      const transport = url.protocol === 'https:' ? https : http
      const req = transport.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method: 'GET',
          rejectUnauthorized: false,
        },
        (res) => {
          res.resume()
          resolve(Boolean(res.statusCode && res.statusCode < 500))
        },
      )
      req.on('error', async () => resolve(await checkTcpPort(target)))
      req.setTimeout(3000, () => {
        req.destroy()
        checkTcpPort(target).then(resolve)
      })
      req.end()
    } catch {
      checkTcpPort(target).then(resolve)
    }
  })
}

async function waitForTarget(target, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await checkTarget(target)) {
      return true
    }
    await sleep(500)
  }
  return false
}

async function collectStatus() {
  const rows = []
  for (const target of targets) {
    rows.push({
      name: target.name,
      port: target.port,
      up: await checkTarget(target),
      url: target.url,
    })
  }
  return rows
}

async function preflightPorts() {
  const rows = await collectStatus()
  const upRows = rows.filter((row) => row.up)
  if (upRows.length === 0) {
    return { ok: true, rows }
  }
  if (upRows.length === rows.length) {
    console.log('Frontend and backend are already running.')
    printStatus(rows)
    return { ok: false, rows, alreadyRunning: true }
  }
  console.error('Detected a partial existing startup. Please stop the old process before starting again.')
  printStatus(rows)
  return { ok: false, rows, alreadyRunning: false }
}

function printStatus(rows) {
  for (const row of rows) {
    console.log(`${row.name}: ${row.up ? 'up' : 'down'} on ${row.port} -> ${row.url}`)
  }
}

function readPidFile() {
  if (!fs.existsSync(pidFile)) return null
  try {
    return JSON.parse(fs.readFileSync(pidFile, 'utf8'))
  } catch {
    return null
  }
}

function writePidFile(payload) {
  ensureRunlogsDir()
  fs.writeFileSync(pidFile, JSON.stringify(payload, null, 2))
}

function removePidFile() {
  if (fs.existsSync(pidFile)) {
    fs.unlinkSync(pidFile)
  }
}

function isProcessAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function killTree(pid) {
  return new Promise((resolve) => {
    if (!pid || !isProcessAlive(pid)) {
      resolve()
      return
    }

    if (isWin) {
      const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
      killer.once('exit', () => resolve())
      killer.once('error', () => resolve())
      return
    }

    try {
      process.kill(-pid, 'SIGTERM')
    } catch {
      try {
        process.kill(pid, 'SIGTERM')
      } catch {
        resolve()
        return
      }
    }
    resolve()
  })
}

function resetLogs() {
  ensureRunlogsDir()
  for (const target of targets) {
    fs.writeFileSync(target.stdout, '')
    fs.writeFileSync(target.stderr, '')
  }
}

function spawnAttached(target) {
  const command = isWin ? 'cmd.exe' : target.command
  const commandArgs = isWin ? ['/d', '/s', '/c', 'npm run dev'] : target.args
  return spawn(command, commandArgs, {
    cwd: target.cwd,
    env: { ...process.env },
    stdio: 'inherit',
    shell: false,
  })
}

function spawnDetached(target) {
  let child
  if (isWin) {
    const cwd = target.cwd.replace(/'/g, "''")
    const stdout = target.stdout.replace(/'/g, "''")
    const stderr = target.stderr.replace(/'/g, "''")
    const psCommand = `Set-Location '${cwd}'; npm run dev *>> '${stdout}' 2>> '${stderr}'`
    child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand], {
      cwd: target.cwd,
      env: { ...process.env },
      stdio: 'ignore',
      detached: true,
      windowsHide: true,
      shell: false,
    })
  } else {
    const stdoutFd = fs.openSync(target.stdout, 'a')
    const stderrFd = fs.openSync(target.stderr, 'a')
    child = spawn(target.command, target.args, {
      cwd: target.cwd,
      env: { ...process.env },
      stdio: ['ignore', stdoutFd, stderrFd],
      detached: true,
      windowsHide: true,
      shell: false,
    })
  }
  child.unref()
  return child
}

async function stopBackground() {
  const payload = readPidFile()
  if (!payload?.targets?.length) {
    console.log('No background dev processes recorded.')
    return
  }

  for (const target of payload.targets) {
    await killTree(target.pid)
  }

  removePidFile()
  console.log('Background dev processes stopped.')
}

async function startBackground() {
  await stopBackground()
  const preflight = await preflightPorts()
  if (!preflight.ok) {
    process.exitCode = preflight.alreadyRunning ? 0 : 1
    return
  }
  resetLogs()

  const children = targets.map((target) => ({ target, child: spawnDetached(target) }))

  writePidFile({
    startedAt: new Date().toISOString(),
    targets: children.map(({ target, child }) => ({
      name: target.name,
      pid: child.pid,
      port: target.port,
      cwd: target.cwd,
      stdout: target.stdout,
      stderr: target.stderr,
    })),
  })

  for (const { target } of children) {
    const up = await waitForTarget(target)
    if (!up) {
      console.error(`${target.name} failed to become ready on port ${target.port}.`)
      process.exitCode = 1
      return
    }
  }

  console.log('Background dev servers are ready.')
  console.log(`Frontend: ${targets[0].url}`)
  console.log(`Backend: ${targets[1].url}`)
  console.log(`Logs: ${runlogsDir}`)
}

async function startAttached() {
  const preflight = await preflightPorts()
  if (!preflight.ok) {
    process.exitCode = preflight.alreadyRunning ? 0 : 1
    return
  }
  resetLogs()

  const children = targets.map(spawnAttached)

  const shutdown = async () => {
    for (const child of children) {
      await killTree(child.pid)
    }
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  children.forEach((child, index) => {
    child.once('exit', async (code) => {
      if (code === 0) return
      console.error(`${targets[index].name} exited with code ${code ?? 'unknown'}. Stopping the other process.`)
      for (const other of children) {
        if (other.pid !== child.pid) {
          await killTree(other.pid)
        }
      }
      process.exit(code ?? 1)
    })
  })

  for (const target of targets) {
    const up = await waitForTarget(target)
    if (!up) {
      console.error(`${target.name} failed to become ready on port ${target.port}.`)
      await shutdown()
      return
    }
  }

  console.log(`Frontend ready at ${targets[0].url}`)
  console.log(`Backend ready at ${targets[1].url}`)
}

async function main() {
  if (args.has('--status')) {
    printStatus(await collectStatus())
    return
  }

  if (args.has('--stop')) {
    await stopBackground()
    return
  }

  if (args.has('--background')) {
    await startBackground()
    return
  }

  await startAttached()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
