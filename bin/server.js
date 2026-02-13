#!/usr/bin/env node
// Web UI Server
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { 
  fetchAllTickers, 
  getCacheStats as getMarketDataCacheStats, 
  clearCache as clearMarketDataCache 
} from '../lib/market-data.js';
import { analyzeMarketData } from '../lib/technicals.js';
import { exportSignalsSummary, getRecentSignals } from '../lib/signals.js';
import { loadPerformance, getPerformanceSummary } from '../lib/performance.js';
import { calculateMarketSentiment } from '../lib/sentiment.js';
import { getCacheStats, clearCache } from '../lib/gemini.js';
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
  analyzeSignalRisk,
  generatePositionSizingRecommendations
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
import {
  fetchTickerNews,
  batchFetchNews,
  getNewsSummary
} from '../lib/news.js';
import {
  analyzeOptionsChain,
  batchAnalyzeOptions
} from '../lib/options.js';
import {
  analyzeMultiTimeframe,
  batchAnalyzeMultiTimeframe
} from '../lib/multi-timeframe.js';
import {
  fetchEarningsCalendar,
  batchFetchEarnings,
  getEarningsSummary
} from '../lib/earnings.js';
import {
  getWatchlist,
  getTickerSymbols,
  addTicker,
  removeTicker,
  resetWatchlist,
  detectTickerConfig
} from '../lib/watchlist.js';
import {
  registerClient,
  notifySignal,
  notify,
  loadNotifications,
  getRecentNotifications,
  markAsRead,
  markAllAsRead,
  clearOldNotifications,
  getNotificationStats
} from '../lib/notifications.js';
import {
  loadJournal,
  addTrade,
  updateTrade,
  deleteTrade,
  getTrades,
  getTrade,
  getStats,
  exportToCSV as exportJournalToCSV
} from '../lib/trade-journal.js';
import {
  detectMarketRegime,
  applyRegimeFilter
} from '../lib/market-regime.js';

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

// Get market regime analysis
app.get('/api/market-regime', async (req, res) => {
  try {
    const { ticker } = req.query;
    const marketData = await fetchAllTickers();
    const regimes = {};
    
    for (const [symbol, data] of Object.entries(marketData)) {
      if (ticker && symbol !== ticker) continue;
      if (data && data.historicalData) {
        const technicals = analyzeMarketData(data);
        regimes[symbol] = detectMarketRegime(data, technicals);
      }
    }
    
    res.json({ 
      success: true, 
      data: ticker ? regimes[ticker] : regimes, 
      timestamp: Date.now() 
    });
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

// Generate detailed position sizing recommendations for a signal
app.post('/api/risk/position-sizing-recommendations', (req, res) => {
  try {
    const { signal, accountSize } = req.body;
    
    if (!signal) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameter: signal' 
      });
    }
    
    const result = generatePositionSizingRecommendations(
      signal,
      parseFloat(accountSize || 10000)
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
    
    // Save signals and send notifications
    const signalsGenerated = [];
    for (const [ticker, result] of Object.entries(analysis)) {
      if (result && !result.error && result.signal !== 'NEUTRAL') {
        signalsGenerated.push(result);
        saveSignals([result]);
        
        // Send notification for high-confidence signals (7+)
        if (result.confidence >= 7) {
          notifySignal(result);
        }
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

// News Feed API Endpoints

// Get cached news data
app.get('/api/news', (req, res) => {
  try {
    const newsFile = join(__dirname, '..', 'data', 'news.json');
    
    if (!existsSync(newsFile)) {
      return res.json({ 
        success: false, 
        error: 'No news data available. Call /api/news/refresh to fetch news.' 
      });
    }
    
    const data = JSON.parse(readFileSync(newsFile, 'utf8'));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get news for a specific ticker
app.get('/api/news/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const limit = parseInt(req.query.limit) || 10;
    const news = await fetchTickerNews(ticker, limit);
    res.json({ success: true, data: news });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Refresh news data for all watchlist tickers
app.post('/api/news/refresh', async (req, res) => {
  try {
    const tickers = req.body.tickers || ['SPY', 'QQQ', 'ONDS', 'USAR', 'HOVR', 'RDDT', 'UUUU'];
    const limit = parseInt(req.body.limit) || 10;
    
    console.log(`Fetching news for: ${tickers.join(', ')}`);
    
    const newsData = await batchFetchNews(tickers, limit);
    const summary = getNewsSummary(newsData);
    
    // Save to file
    const outputPath = join(__dirname, '..', 'data', 'news.json');
    const data = {
      timestamp: Date.now(),
      tickers: newsData,
      summary
    };
    
    writeFileSync(outputPath, JSON.stringify(data, null, 2));
    
    console.log(`✅ News data fetched and saved`);
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Options Chain Analysis Endpoints

// Get options analysis for a specific ticker
app.get('/api/options/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    
    // Need current price
    const marketData = await fetchAllTickers();
    const tickerData = marketData[ticker];
    
    if (!tickerData || !tickerData.price) {
      return res.status(404).json({ 
        success: false, 
        error: `No market data for ${ticker}` 
      });
    }
    
    const analysis = await analyzeOptionsChain(ticker, tickerData.price);
    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error(`Options analysis error for ${req.params.ticker}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Batch analyze options for all watchlist tickers
app.post('/api/options/refresh', async (req, res) => {
  try {
    const tickers = req.body.tickers || ['SPY', 'QQQ', 'ONDS', 'USAR', 'RDDT', 'UUUU'];
    
    console.log(`Analyzing options for: ${tickers.join(', ')}`);
    
    // Get current prices
    const marketData = await fetchAllTickers();
    const priceMap = {};
    
    for (const ticker of tickers) {
      if (marketData[ticker] && marketData[ticker].price) {
        priceMap[ticker] = marketData[ticker].price;
      }
    }
    
    const optionsData = await batchAnalyzeOptions(Object.keys(priceMap), priceMap);
    
    // Save to file
    const outputPath = join(__dirname, '..', 'data', 'options.json');
    const data = {
      timestamp: Date.now(),
      tickers: optionsData
    };
    
    writeFileSync(outputPath, JSON.stringify(data, null, 2));
    
    console.log(`✅ Options data analyzed and saved`);
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error analyzing options:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get cached options data
app.get('/api/options', (req, res) => {
  try {
    const optionsFile = join(__dirname, '..', 'data', 'options.json');
    
    if (!existsSync(optionsFile)) {
      return res.json({ 
        success: false, 
        error: 'No options data available. Use POST /api/options/refresh to fetch.' 
      });
    }
    
    const data = JSON.parse(readFileSync(optionsFile, 'utf8'));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Multi-Timeframe Analysis Endpoints

// Analyze single ticker across multiple timeframes
app.get('/api/multi-timeframe/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    console.log(`Analyzing ${ticker} across multiple timeframes...`);
    
    const mtfData = await analyzeMultiTimeframe(ticker);
    res.json({ success: true, data: mtfData });
  } catch (error) {
    console.error(`Error analyzing ${req.params.ticker}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Batch analyze multiple tickers with multi-timeframe
app.post('/api/multi-timeframe/refresh', async (req, res) => {
  try {
    const tickers = req.body.tickers || ['SPY', 'QQQ', 'ONDS', 'USAR', 'RDDT', 'UUUU'];
    
    console.log(`Multi-timeframe analysis for: ${tickers.join(', ')}`);
    
    const mtfData = await batchAnalyzeMultiTimeframe(tickers);
    
    // Save to file
    const outputPath = join(__dirname, '..', 'data', 'multi-timeframe.json');
    const data = {
      timestamp: Date.now(),
      tickers: mtfData
    };
    
    writeFileSync(outputPath, JSON.stringify(data, null, 2));
    
    console.log(`✅ Multi-timeframe data analyzed and saved`);
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error analyzing multi-timeframe:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get cached multi-timeframe data
app.get('/api/multi-timeframe', (req, res) => {
  try {
    const mtfFile = join(__dirname, '..', 'data', 'multi-timeframe.json');
    
    if (!existsSync(mtfFile)) {
      return res.json({ 
        success: false, 
        error: 'No multi-timeframe data available. Use POST /api/multi-timeframe/refresh to fetch.' 
      });
    }
    
    const data = JSON.parse(readFileSync(mtfFile, 'utf8'));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Earnings Calendar Endpoints

// Get earnings calendar for a specific ticker
app.get('/api/earnings/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    console.log(`Fetching earnings calendar for ${ticker}...`);
    
    const earnings = await fetchEarningsCalendar(ticker);
    res.json({ success: true, data: earnings });
  } catch (error) {
    console.error(`Error fetching earnings for ${req.params.ticker}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Batch fetch earnings for all watchlist tickers
app.post('/api/earnings/refresh', async (req, res) => {
  try {
    const tickers = req.body.tickers || ['SPY', 'QQQ', 'ONDS', 'USAR', 'RDDT', 'UUUU'];
    
    console.log(`Fetching earnings calendar for: ${tickers.join(', ')}`);
    console.log('⚠️ Alpha Vantage free tier: 25 calls/day, 5 calls/min. This may take a while...');
    
    const earningsData = await batchFetchEarnings(tickers);
    
    // Save to file
    const outputPath = join(__dirname, '..', 'data', 'earnings.json');
    const data = {
      timestamp: Date.now(),
      tickers: earningsData
    };
    
    writeFileSync(outputPath, JSON.stringify(data, null, 2));
    
    console.log(`✅ Earnings calendar data fetched and saved`);
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching earnings calendar:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get cached earnings data
app.get('/api/earnings', (req, res) => {
  try {
    const earningsFile = join(__dirname, '..', 'data', 'earnings.json');
    
    if (!existsSync(earningsFile)) {
      return res.json({ 
        success: false, 
        error: 'No earnings data available. Use POST /api/earnings/refresh to fetch.' 
      });
    }
    
    const data = JSON.parse(readFileSync(earningsFile, 'utf8'));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get earnings summary (upcoming, alerts, etc.)
app.get('/api/earnings/summary', (req, res) => {
  try {
    const earningsFile = join(__dirname, '..', 'data', 'earnings.json');
    
    if (!existsSync(earningsFile)) {
      return res.json({ 
        success: false, 
        error: 'No earnings data available. Use POST /api/earnings/refresh to fetch.' 
      });
    }
    
    const data = JSON.parse(readFileSync(earningsFile, 'utf8'));
    const summary = getEarningsSummary(data.tickers);
    
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Gemini Cache Management Endpoints

// Get cache statistics
app.get('/api/cache/stats', (req, res) => {
  try {
    const stats = getCacheStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear analysis cache
app.post('/api/cache/clear', (req, res) => {
  try {
    const result = clearCache();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Market Data Cache Management Endpoints

// Get market data cache statistics
app.get('/api/market-cache/stats', (req, res) => {
  try {
    const stats = getMarketDataCacheStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear market data cache
app.post('/api/market-cache/clear', (req, res) => {
  try {
    const result = clearMarketDataCache();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Notification Endpoints

// Get all notifications
app.get('/api/notifications', (req, res) => {
  try {
    const notifications = loadNotifications();
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get recent notifications
app.get('/api/notifications/recent', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const notifications = getRecentNotifications(limit);
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark notification as read
app.post('/api/notifications/:id/read', (req, res) => {
  try {
    const { id } = req.params;
    const success = markAsRead(id);
    res.json({ success, message: success ? 'Marked as read' : 'Notification not found' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark all notifications as read
app.post('/api/notifications/read-all', (req, res) => {
  try {
    const count = markAllAsRead();
    res.json({ success: true, data: { count } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear old notifications
app.post('/api/notifications/cleanup', (req, res) => {
  try {
    const daysOld = parseInt(req.body.daysOld) || 7;
    const removed = clearOldNotifications(daysOld);
    res.json({ success: true, data: { removed } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get notification statistics
app.get('/api/notifications/stats', (req, res) => {
  try {
    const stats = getNotificationStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send custom notification (for testing or manual alerts)
app.post('/api/notifications/send', (req, res) => {
  try {
    const { title, message, type, priority } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: title, message' 
      });
    }
    
    notify(title, message, type || 'info', priority || 'medium');
    res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Watchlist Management Endpoints

// Get full watchlist
app.get('/api/watchlist', (req, res) => {
  try {
    const watchlist = getWatchlist();
    res.json({ success: true, data: watchlist });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get ticker symbols only
app.get('/api/watchlist/symbols', (req, res) => {
  try {
    const symbols = getTickerSymbols();
    res.json({ success: true, data: symbols });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add ticker to watchlist
app.post('/api/watchlist/add', (req, res) => {
  try {
    const { symbol, yahoo, google, name, exchange } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ success: false, error: 'Symbol is required' });
    }
    
    // Auto-detect config if not fully provided
    let config;
    if (yahoo && google) {
      config = { yahoo, google, name: name || symbol, exchange: exchange || 'UNKNOWN' };
    } else {
      config = detectTickerConfig(symbol, exchange);
    }
    
    const ticker = addTicker(symbol, config);
    res.json({ success: true, data: ticker });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Remove ticker from watchlist
app.delete('/api/watchlist/remove/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    removeTicker(symbol);
    res.json({ success: true, message: `Removed ${symbol} from watchlist` });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Reset watchlist to defaults
app.post('/api/watchlist/reset', (req, res) => {
  try {
    const watchlist = resetWatchlist();
    res.json({ success: true, data: watchlist, message: 'Watchlist reset to defaults' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Trade Journal Endpoints

// Get all trades with optional filters
app.get('/api/journal/trades', (req, res) => {
  try {
    const filters = {
      ticker: req.query.ticker,
      status: req.query.status,
      direction: req.query.direction,
      pattern: req.query.pattern,
      outcome: req.query.outcome, // 'winners' or 'losers'
      startDate: req.query.startDate ? parseInt(req.query.startDate) : undefined,
      endDate: req.query.endDate ? parseInt(req.query.endDate) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };
    
    const trades = getTrades(filters);
    res.json({ success: true, data: trades });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get a single trade by ID
app.get('/api/journal/trades/:id', (req, res) => {
  try {
    const trade = getTrade(req.params.id);
    res.json({ success: true, data: trade });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// Add a new trade
app.post('/api/journal/trades', (req, res) => {
  try {
    const trade = addTrade(req.body);
    res.json({ success: true, data: trade, message: 'Trade added to journal' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update an existing trade
app.put('/api/journal/trades/:id', (req, res) => {
  try {
    const trade = updateTrade(req.params.id, req.body);
    res.json({ success: true, data: trade, message: 'Trade updated' });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// Delete a trade
app.delete('/api/journal/trades/:id', (req, res) => {
  try {
    const result = deleteTrade(req.params.id);
    res.json({ success: true, data: result, message: 'Trade deleted' });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// Get journal statistics
app.get('/api/journal/stats', (req, res) => {
  try {
    const stats = getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export journal to CSV
app.get('/api/journal/export', (req, res) => {
  try {
    const csv = exportJournalToCSV();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="trade-journal.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  // Register client for notifications
  registerClient(ws);
  
  // Send initial data immediately on connect
  (async () => {
    try {
      const marketData = await fetchAllTickers();
      ws.send(JSON.stringify({
        type: 'market-update',
        data: marketData,
        timestamp: Date.now()
      }));
      
      // Send recent notifications
      const recentNotifications = getRecentNotifications(10);
      ws.send(JSON.stringify({
        type: 'notifications-init',
        data: recentNotifications,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error sending initial data:', error);
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
