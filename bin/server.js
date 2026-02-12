#!/usr/bin/env node
// Web UI Server
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import { fetchAllTickers } from '../lib/market-data.js';
import { analyzeMarketData } from '../lib/technicals.js';
import { exportSignalsSummary, getRecentSignals } from '../lib/signals.js';
import { loadPerformance, getPerformanceSummary } from '../lib/performance.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const PORT = 3847;

// Serve static files
app.use(express.static(join(__dirname, '..', 'web')));
app.use(express.json());

// API Routes

// Get latest market data
app.get('/api/market-data', async (req, res) => {
  try {
    const marketData = await fetchAllTickers();
    res.json({ success: true, data: marketData, timestamp: Date.now() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get technical analysis
app.get('/api/technicals', async (req, res) => {
  try {
    const marketData = await fetchAllTickers();
    const technicals = {};
    
    for (const [ticker, data] of Object.entries(marketData)) {
      if (data && data.historicalData) {
        technicals[ticker] = analyzeMarketData(data);
      }
    }
    
    res.json({ success: true, data: technicals, timestamp: Date.now() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get latest scan results
app.get('/api/latest-scan', (req, res) => {
  try {
    const scanFile = join(__dirname, '..', 'data', 'latest-scan.json');
    
    if (!existsSync(scanFile)) {
      return res.json({ success: false, error: 'No scan data available' });
    }
    
    const data = JSON.parse(readFileSync(scanFile, 'utf8'));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get signals
app.get('/api/signals', (req, res) => {
  try {
    const summary = exportSignalsSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get recent signals
app.get('/api/signals/recent', (req, res) => {
  try {
    const count = parseInt(req.query.count) || 20;
    const signals = getRecentSignals(count);
    res.json({ success: true, data: signals });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get performance
app.get('/api/performance', (req, res) => {
  try {
    const performance = loadPerformance();
    res.json({ success: true, data: performance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get performance summary
app.get('/api/performance/summary', (req, res) => {
  try {
    const summary = getPerformanceSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy',
    timestamp: Date.now(),
    version: '1.0.0'
  });
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  // Send initial data immediately on connect
  (async () => {
    try {
      const marketData = await fetchAllTickers();
      ws.send(JSON.stringify({
        type: 'market-update',
        data: marketData,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error sending initial market data:', error);
    }
  })();
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Broadcast market data updates every 5 seconds
let lastBroadcast = 0;
const BROADCAST_INTERVAL = 5000; // 5 seconds

setInterval(async () => {
  const now = Date.now();
  
  // Skip if no clients connected or too soon since last update
  if (wss.clients.size === 0 || now - lastBroadcast < BROADCAST_INTERVAL) {
    return;
  }
  
  try {
    const marketData = await fetchAllTickers();
    const message = JSON.stringify({
      type: 'market-update',
      data: marketData,
      timestamp: now
    });
    
    // Broadcast to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
    
    lastBroadcast = now;
    console.log(`Broadcast market update to ${wss.clients.size} client(s)`);
  } catch (error) {
    console.error('Error broadcasting market data:', error);
  }
}, 5000);

// Start server
server.listen(PORT, () => {
  console.log('\n🐾 Klaw Terminal - Web UI');
  console.log('═══════════════════════════════════════');
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('WebSocket server ready for live updates');
  console.log('═══════════════════════════════════════\n');
  console.log('Available endpoints:');
  console.log('  Dashboard:  http://localhost:3847');
  console.log('  Signals:    http://localhost:3847/signals.html');
  console.log('  Analysis:   http://localhost:3847/analysis.html');
  console.log('\nPress Ctrl+C to stop\n');
});
