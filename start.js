#!/usr/bin/env node

/**
 * 🏛️ BACO Official - Unified Server
 * Runs: Backend (3000) + Chat API (3001) + Frontend (Dynamic Port)
 * 
 * Usage: node start.js
 */

const { spawn } = require('child_process');
const path = require('path');

const FRONTEND_PORT = process.env.PORT || 5173;
const isProduction = process.env.NODE_ENV === 'production';

const SERVICES = [
  {
    name: 'BACKEND',
    color: '\x1b[36m', // Cyan
    cwd: './BacoBackend',
    cmd: 'node',
    args: ['server.js'],
    port: 3000,
    prefix: '🗄️ '
  },
  {
    name: 'CHAT-API',
    color: '\x1b[35m', // Magenta
    cwd: './BacoFrontend',
    cmd: 'node',
    args: ['server.js'],
    port: 3001,
    prefix: '🤖 '
  },
  {
    name: 'FRONTEND',
    color: '\x1b[32m',
    cwd: './BacoFrontend',
    cmd: 'npx',
    args: isProduction 
      ? ['vite', 'preview', '--host', '0.0.0.0', '--port', String(FRONTEND_PORT)]
      : ['vite', '--host', '0.0.0.0', '--port', String(FRONTEND_PORT)],
    port: FRONTEND_PORT,
    prefix: '🌐 '
  }
];

let processes = new Map();
let isShuttingDown = false;

// ============================================
// 🎨 HELPER FUNCTIONS
// ============================================
function log(serviceName, color, message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${color}[${timestamp}]${'\x1b[0m'} ${message}`);
}

function printHeader() {
  console.log('\n' + '='.repeat(60));
  console.log('  🏛️  BACO OFFICIAL - UNIFIED SERVER');
  console.log(`  Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log('  Starting all services...\n');
  console.log('  Services:');
  console.log('    🗄️  Backend   → http://localhost:3000');
  console.log('    🤖  Chat API  → http://localhost:3001');
  console.log(`    🌐  Frontend  → http://localhost:${FRONTEND_PORT}`);
  console.log('\n' + '='.repeat(60));
  console.log('\n  Press Ctrl+C to stop all services\n');
  console.log('-'.repeat(60) + '\n');
}

function printFooter() {
  console.log('\n' + '-'.repeat(60));
  console.log('  ✅ All services stopped\n');
}

// ============================================
// 🚀 START SERVICES
// ============================================
function startService(service, index) {
  const { name, color, cwd, cmd, args, port, prefix } = service;
  
  setTimeout(() => {
    log(name, color, `${prefix}Starting ${name} on port ${port}...`);

    const proc = spawn(cmd, args, {
      cwd: path.resolve(cwd),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env }
    });

    processes.set(name, { proc, port });

    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      lines.forEach(line => {
        console.log(`${color}${prefix}${'\x1b[0m'}${line}`);
        
        if (line.toLowerCase().includes('running') || 
            line.toLowerCase().includes('ready') ||
            line.includes('localhost:' + port) ||
            line.includes('Local:')) {
          log(name, color, `✅ ${name} is READY`);
        }
      });
    });

    proc.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      lines.forEach(line => {
        console.log(`\x1b[31m${prefix}ERROR: ${line}\x1b[0m`);
        if (line.includes('EADDRINUSE')) {
          console.log(`\x1b[33m${prefix}⚠️  Port ${port} is busy!\x1b[0m`);
        }
      });
    });

    proc.on('error', (err) => {
      console.error(`\x1b[31m${prefix}❌ Failed to start ${name}: ${err.message}\x1b[0m`);
    });

    proc.on('exit', (code) => {
      if (!isShuttingDown && code !== 0) {
        console.log(`\x1b[33m${prefix}⚠️  ${name} exited (code: ${code}). Restarting...\x1b[0m`);
        setTimeout(() => startService(service, index), 2000);
      } else if (!isShuttingDown) {
        processes.delete(name);
      }
    });

  }, index * 1500);
}

// ============================================
// 🛑 SHUTDOWN
// ============================================
function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\n' + '='.repeat(60));
  console.log(`  🛑 ${signal} received. Stopping all services...`);
  console.log('='.repeat(60) + '\n');

  let count = processes.size;
  if (count === 0) { printFooter(); process.exit(0); }

  processes.forEach((data, name) => {
    const { proc } = data;
    const killTimeout = setTimeout(() => {
      proc.kill('SIGKILL');
      count--;
      if (count <= 0) printFooter() || process.exit(0);
    }, 5000);

    proc.on('exit', () => {
      clearTimeout(killTimeout);
      count--;
      console.log(`  ✅ ${name} stopped`);
      if (count <= 0) printFooter() || process.exit(0);
    });

    console.log(`  🛑 Stopping ${name}...`);
    proc.kill('SIGTERM');
  });

  setTimeout(() => { process.exit(1); }, 10000);
}

// ============================================
// ▶️ START EVERYTHING
// ============================================
printHeader();
SERVICES.forEach((service, index) => { startService(service, index); });

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => { console.error('\n❌ Uncaught Exception:', err.message); shutdown('ERROR'); });
process.on('unhandledRejection', (reason) => { console.error('\n❌ Unhandled Rejection:', reason); });