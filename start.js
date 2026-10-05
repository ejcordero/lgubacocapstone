#!/usr/bin/env node

/**
 * 🏛️ BACO Official - Unified Dev Server
 * Runs: Backend (3000) + Chat API (3001) + Frontend (5173)
 * 
 * Usage: node start.js
 */

const { spawn } = require('child_process');
const path = require('path');

// ============================================
// ⚙️ CONFIGURATION
// ============================================
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
    color: '\x1b[32m', // Green
    cwd: './BacoFrontend',
    cmd: 'npx',
    args: ['vite', '--host'],
    port: 5173,
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
  console.log('  🏛️  BACO OFFICIAL - UNIFIED DEV SERVER');
  console.log('  Starting all services...\n');
  console.log('  Services:');
  console.log('    🗄️  Backend   → http://localhost:3000');
  console.log('    🤖  Chat API  → http://localhost:3001');
  console.log('    🌐  Frontend  → http://localhost:5173');
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
  
  // Delay start slightly to avoid race conditions
  setTimeout(() => {
    log(name, color, `${prefix}Starting ${name} on port ${port}...`);

    const proc = spawn(cmd, args, {
      cwd: path.resolve(cwd),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env }
    });

    processes.set(name, { proc, port });

    // === STDOUT ===
    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      lines.forEach(line => {
        console.log(`${color}${prefix}${'\x1b[0m'}${line}`);
        
        // Detect successful startup
        if (line.toLowerCase().includes('running') || 
            line.toLowerCase().includes('ready') ||
            line.includes('localhost:' + port)) {
          log(name, color, `✅ ${name} is READY → http://localhost:${port}`);
        }
      });
    });

    // === STDERR ===
    proc.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      lines.forEach(line => {
        // Color errors red
        console.log(`\x1b[31m${prefix}ERROR: ${line}\x1b[0m`);
        
        // Helpful messages for common errors
        if (line.includes('EADDRINUSE')) {
          console.log(`\x1b[33m${prefix}⚠️  Port ${port} is busy! Run: npx kill-port ${port}\x1b[0m`);
        }
        if (line.includes('ECONNREFUSED') || line.includes('connect')) {
          console.log(`\x1b[33m${prefix}⚠️  Database connection failed! Check if MySQL is running.\x1b[0m`);
        }
        if (line.includes('Cannot find module')) {
          console.log(`\x1b[33m${prefix}⚠️  Missing module! Run: npm install\x1b[0m`);
        }
      });
    });

    // === ERROR ===
    proc.on('error', (err) => {
      console.error(`\x1b[31m${prefix}❌ Failed to start ${name}: ${err.message}\x1b[0m`);
      
      if (err.code === 'ENOENT') {
        console.error(`\x1b[33m${prefix}→ Make sure "${cmd}" is installed\x1b[0m`);
      }
    });

    // === EXIT ===
    proc.on('exit', (code) => {
      if (!isShuttingDown && code !== 0) {
        console.log(`\x1b[33m${prefix}⚠️  ${name} exited (code: ${code}). Restarting...\x1b[0m`);
        setTimeout(() => startService(service, index), 2000);
      } else if (!isShuttingDown) {
        processes.delete(name);
      }
    });

  }, index * 1500); // Stagger starts by 1.5 seconds
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
  
  if (count === 0) {
    printFooter();
    process.exit(0);
  }

  processes.forEach((data, name) => {
    const { proc } = data;
    
    // Try graceful shutdown first
    const killTimeout = setTimeout(() => {
      console.log(`  ⚡ Force killing ${name}...`);
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

  // Hard exit after 10 seconds
  setTimeout(() => {
    console.log('\n  ⚠️  Forced shutdown\n');
    process.exit(1);
  }, 10000);
}

// ============================================
// ▶️ START EVERYTHING
// ============================================
printHeader();

SERVICES.forEach((service, index) => {
  startService(service, index);
});

// Handle shutdown signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('\n❌ Uncaught Exception:', err.message);
  shutdown('ERROR');
});

process.on('unhandledRejection', (reason) => {
  console.error('\n❌ Unhandled Rejection:', reason);
});