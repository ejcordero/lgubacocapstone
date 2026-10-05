require('dotenv').config();
const express = require('express');
const cors = require('cors');
const usersRouter = require('./routes/web');
const path = require('path'); 

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); 

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/downloads', express.static(path.join(__dirname, 'downloads'))); 
app.use('/halcon_uploads', express.static(path.join(__dirname, 'halcon_uploads'))); 
app.use('/halcon_documents', express.static(path.join(__dirname, 'halcon_documents')));
app.use('/admin_uploads', express.static(path.join(__dirname, 'admin_uploads')));
app.use('/owner_uploads', express.static(path.join(__dirname, 'owner_uploads')));
app.use('/charters', express.static(path.join(__dirname, 'charters'))); 
app.use('/api/stats', require('./routes/statsRoutes'));

app.get('/', (req, res) => res.send({ message: 'API running...' }));
app.use('/api', usersRouter); 

app.use((err, req, res, next) => {
  console.error('❌ [BACKEND] Unhandled Error:', err.message);
  console.error('   Stack:', err.stack);
  
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} does not exist`
  });
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Backend running at http://localhost:${PORT}`);
  console.log(`   API Routes: http://localhost:${PORT}/api/*`);
  console.log(`   Uploads:   http://localhost:${PORT}/uploads/`);
  console.log(`   Downloads: http://localhost:${PORT}/downloads/`);
  console.log(`   Halcon:    http://localhost:${PORT}/halcon_uploads/ & /halcon_documents/\n`);
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use!`);
    console.error(`   Solution: Kill the process using this port`);
    console.error(`   Command: npx kill-port ${PORT}\n`);
    process.exit(1);
  }
  
  if (error.code === 'EACCES') {
    console.error(`\n❌ Permission denied to use port ${PORT}`);
    console.error(`   Try a different port: PORT=3001 node server.js\n`);
    process.exit(1);
  }
  
  console.error('\n❌ Server failed to start:', error.message);
  process.exit(1);
});

// Graceful shutdown on Ctrl+C or termination signal
function shutdown(signal) {
  console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    
    // Close database pool if exists
    try {
      const pool = require('./db');
      if (pool && pool.end) {
        pool.end().then(() => {
          console.log('✅ Database connection closed');
          process.exit(0);
        }).catch(() => process.exit(0));
      } else {
        process.exit(0);
      }
    } catch (e) {
      // db module might not exist or not have pool
      process.exit(0);
    }
  });
  
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C
process.on('SIGTERM', () => shutdown('SIGTERM')); // Termination signal

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught Exception:', error.message);
  console.error('   Stack:', error.stack);
  shutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled Rejection at:', promise);
  console.error('   Reason:', reason);
});