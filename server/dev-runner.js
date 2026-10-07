import { spawn } from 'node:child_process'

// Inicializa os dois processos sem depender de um shell específico do Windows/macOS/Linux.
const processes = [
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
  spawn(process.execPath, ['--watch', 'server/index.js'], { stdio: 'inherit' }),
]

let stopping = false
function stopProcesses(exitCode = 0) {
  if (stopping) return
  stopping = true
  for (const child of processes) child.kill('SIGTERM')
  process.exitCode = exitCode
}

for (const child of processes) {
  child.on('error', (error) => {
    console.error('Não foi possível iniciar um serviço local:', error)
    stopProcesses(1)
  })
  child.on('exit', (code) => {
    if (!stopping) stopProcesses(code ?? 1)
  })
}

process.on('SIGINT', () => stopProcesses())
process.on('SIGTERM', () => stopProcesses())
