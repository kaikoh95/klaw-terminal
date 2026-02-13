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
import { calculateMarketSentiment } from '../lib/sentiment.js';
import { 
  getPerformanceSummary as getSignalPerformanceSummary, 
  getActiveSignals, 
  getClosedSignals, 
  getBestPatterns 
} from '../lib/signal-performance.js';
import {
  calculatePositionSize,
  calculatePortfolioHeat,
  calculateKellyCriterion,
  buildCorrelationMatrix,
  analyzeSignalRisk
} from '../lib/risk-management.js';
import {
  exportSignalsToCSV,
  exportPerformanceToCSV,
  exportAnalysisToCSV
} from '../lib/export.js';
import {
  loadAlerts,
  addAlert,
  removeAlert,
  getActiveAlerts,
  getTriggeredAlerts,
  checkAlerts,
  clearOldTriggeredAlerts,
  getAlertsForTicker
} from '../lib/alerts.js';
import {
  getTickerSentiment,
  batchGetSentiment,
  getSentimentSummary,
  getTrendingStocks
} from '../lib/stocktwits.js';

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
    
    // Add sentiment analysis if we have technicals
    if (data.technicals && Object.keys(data.technicals).length > 0) {
      data.sentiment = calculateMarketSentiment(data.technicals);
    }
    
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

// Get market sentiment
app.get('/api/sentiment', (req, res) => {
  try {
    const scanFile = join(__dirname, '..', 'data', 'latest-scan.json');
    
    if (!existsSync(scanFile)) {
      return res.json({ success: false, error: 'No scan data available. Run a market scan first.' });
    }
    
    const data = JSON.parse(readFileSync(scanFile, 'utf8'));
    
    if (!data.technicals || Object.keys(data.technicals).length === 0) {
      return res.json({ success: false, error: 'No technical analysis data available' });
    }
    
    const sentiment = calculateMarketSentiment(data.technicals);
    res.json({ success: true, data: sentiment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Signal performance tracking
app.get('/api/signal-performance/summary', (req, res) => {
  try {
    const summary = getSignalPerformanceSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/signal-performance/active', (req, res) => {
  try {
    const active = getActiveSignals();
    res.json({ success: true, data: active });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/signal-performance/closed', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const closed = getClosedSignals(limit);
    res.json({ success: true, data: closed });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/signal-performance/best-patterns', (req, res) => {
  try {
    const minSampleSize = parseInt(req.query.minSampleSize) || 3;
    const patterns = getBestPatterns(minSampleSize);
    res.json({ success: true, data: patterns });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Risk Management Endpoints

// Calculate position size
app.post('/api/risk/position-size', (req, res) => {
  try {
    const { accountSize, riskPercent, entryPrice, stopLoss, commission } = req.body;
    
    if (!accountSize || !riskPercent || !entryPrice || !stopLoss) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: accountSize, riskPercent, entryPrice, stopLoss' 
      });
    }
    
    const result = calculatePositionSize(
      parseFloat(accountSize),
      parseFloat(riskPercent),
      parseFloat(entryPrice),
      parseFloat(stopLoss),
      parseFloat(commission || 0)
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Calculate portfolio heat
app.post('/api/risk/portfolio-heat', (req, res) => {
  try {
    const { positions, accountSize } = req.body;
    
    if (!accountSize) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameter: accountSize' 
      });
    }
    
    const result = calculatePortfolioHeat(
      positions || [],
      parseFloat(accountSize)
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Calculate Kelly Criterion
app.post('/api/risk/kelly', (req, res) => {
  try {
    const { winRate, avgWin, avgLoss } = req.body;
    
    if (!winRate || !avgWin || !avgLoss) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: winRate, avgWin, avgLoss' 
      });
    }
    
    const result = calculateKellyCriterion(
      parseFloat(winRate),
      parseFloat(avgWin),
      parseFloat(avgLoss)
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Build correlation matrix
app.get('/api/risk/correlation', async (req, res) => {
  try {
    const marketData = await fetchAllTickers();
    const result = buildCorrelationMatrix(marketData);
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analyze signal risk
app.post('/api/risk/analyze-signal', (req, res) => {
  try {
    const { signal, accountSize, riskPercent } = req.body;
    
    if (!signal || !accountSize) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: signal, accountSize' 
      });
    }
    
    const result = analyzeSignalRisk(
      signal,
      parseFloat(accountSize),
      parseFloat(riskPercent || 1)
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy',
    timestamp: Date.now(),
    version: '1.1.0'
  });
});

// Trigger AI analysis from web UI
app.post('/api/analyze', async (req, res) => {
  try {
    console.log('🤖 AI Analysis triggered from web UI...');
    
    // Fetch fresh market data
    const marketData = await fetchAllTickers();
    const technicals = {};
    
    // Calculate technicals for all tickers
    for (const [ticker, data] of Object.entries(marketData)) {
      if (data && data.historicalData) {
        technicals[ticker] = analyzeMarketData(data);
      }
    }
    
    // Import Gemini module dynamically
    const { batchAnalyze } = await import('../lib/gemini.js');
    const { saveSignals } = await import('../lib/signals.js');
    
    // Run AI analysis
    const analysis = await batchAnalyze(marketData, technicals);
    
    // Save signals
    const signalsGenerated = [];
    for (const [ticker, result] of Object.entries(analysis)) {
      if (result && !result.error && result.signal !== 'NEUTRAL') {
        signalsGenerated.push(result);
        saveSignals([result]);
      }
    }
    
    console.log(`✅ Analysis complete. Generated ${signalsGenerated.length} signals.`);
    
    res.json({ 
      success: true, 
      data: {
        analysis,
        signalsGenerated: signalsGenerated.length,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('❌ AI Analysis error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      hint: error.message.includes('GEMINI_API_KEY') 
        ? 'Set GEMINI_API_KEY environment variable' 
        : 'Check server logs for details'
    });
  }
});

// Export endpoints

// Export signals to CSV
app.get('/api/export/signals', (req, res) => {
  try {
    const csv = exportSignalsToCSV();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="klaw-terminal-signals-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export performance to CSV
app.get('/api/export/performance', (req, res) => {
  try {
    const csv = exportPerformanceToCSV();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="klaw-terminal-performance-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export technical analysis to CSV
app.get('/api/export/analysis', (req, res) => {
  try {
    const csv = exportAnalysisToCSV();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="klaw-terminal-analysis-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Price Alert Endpoints

// Get all alerts
app.get('/api/alerts', (req, res) => {
  try {
    const alerts = loadAlerts();
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get active alerts
app.get('/api/alerts/active', (req, res) => {
  try {
    const alerts = getActiveAlerts();
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get triggered alerts
app.get('/api/alerts/triggered', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const alerts = getTriggeredAlerts(limit);
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get alerts for specific ticker
app.get('/api/alerts/:ticker', (req, res) => {
  try {
    const ticker = req.params.ticker;
    const alerts = getAlertsForTicker(ticker);
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add new alert
app.post('/api/alerts', (req, res) => {
  try {
    const { ticker, price, condition, note } = req.body;
    
    if (!ticker || !price || !condition) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: ticker, price, condition' 
      });
    }
    
    if (!['above', 'below'].includes(condition)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Condition must be "above" or "below"' 
      });
    }
    
    const alert = addAlert(ticker, price, condition, note || '');
    res.json({ success: true, data: alert });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete alert
app.delete('/api/alerts/:id', (req, res) => {
  try {
    const alertId = req.params.id;
    const success = removeAlert(alertId);
    
    if (success) {
      res.json({ success: true, message: 'Alert removed' });
    } else {
      res.status(404).json({ success: false, error: 'Alert not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear old triggered alerts
app.post('/api/alerts/cleanup', (req, res) => {
  try {
    const daysOld = parseInt(req.body.daysOld) || 7;
    const removed = clearOldTriggeredAlerts(daysOld);
    res.json({ success: true, data: { removed } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// StockTwits Sentiment Endpoints

// Get sentiment data from cache
app.get('/api/sentiment', (req, res) => {
  try {
    const sentimentFile = join(__dirname, '..', 'data', 'sentiment.json');
    
    if (!existsSync(sentimentFile)) {
      return res.json({ 
        success: false, 
        error: 'No sentiment data available. Run npm run sentiment first.' 
      });
    }
    
    const data = JSON.parse(readFileSync(sentimentFile, 'utf8'));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get fresh sentiment for a specific ticker
app.get('/api/sentiment/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const sentiment = await getTickerSentiment(ticker);
    res.json({ success: true, data: sentiment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get trending stocks from StockTwits
app.get('/api/sentiment/trending', async (req, res) => {
  try {
    const trending = await getTrendingStocks();
    res.json({ success: true, data: trending });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Refresh sentiment data for all watchlist tickers
app.post('/api/sentiment/refresh', async (req, res) => {
  try {
    const tickers = req.body.tickers || ['SPY', 'QQQ', 'ONDS', 'USAR', 'HOVR', 'RDDT', 'UUUU'];
    
    console.log(`Refreshing sentiment for: ${tickers.join(', ')}`);
    
    const sentimentData = await batchGetSentiment(tickers);
    const summary = getSentimentSummary(sentimentData);
    const trending = await getTrendingStocks();
    
    // Save to file
    const outputPath = join(__dirname, '..', 'data', 'sentiment.json');
    const data = {
      timestamp: Date.now(),
      tickers: sentimentData,
      summary,
      trending: trending.slice(0, 20)
    };
    
    writeFileSync(outputPath, JSON.stringify(data, null, 2));
    
    console.log(`✅ Sentiment data refreshed and saved`);
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error refreshing sentiment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
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
    
    // Check for triggered alerts
    const triggeredAlerts = checkAlerts(marketData);
    
    // Prepare market update message
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
    
    // Send alert notifications if any triggered
    if (triggeredAlerts.length > 0) {
      const alertMessage = JSON.stringify({
        type: 'alert-triggered',
        data: triggeredAlerts,
        timestamp: now
      });
      
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(alertMessage);
        }
      });
      
      console.log(`🔔 ${triggeredAlerts.length} alert(s) triggered:`, 
        triggeredAlerts.map(a => `${a.ticker} ${a.condition} $${a.price}`).join(', '));
    }
    
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
