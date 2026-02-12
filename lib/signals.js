// Signal Generation and Tracking
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const SIGNALS_FILE = join(DATA_DIR, 'signals.json');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Load all signals from disk
 */
export function loadSignals() {
  if (!existsSync(SIGNALS_FILE)) {
    return [];
  }
  
  try {
    const data = readFileSync(SIGNALS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading signals:', error.message);
    return [];
  }
}

/**
 * Save signals to disk
 */
export function saveSignals(signals) {
  try {
    writeFileSync(SIGNALS_FILE, JSON.stringify(signals, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving signals:', error.message);
  }
}

/**
 * Generate a trading signal from AI analysis
 */
export function generateSignal(analysis, marketData) {
  // Skip if neutral or low confidence
  if (analysis.signal === 'NEUTRAL' || analysis.confidence < 5) {
    return null;
  }
  
  const signal = {
    id: generateSignalId(),
    ticker: analysis.ticker,
    direction: analysis.signal,
    confidence: analysis.confidence,
    entry: analysis.entry,
    targets: analysis.targets,
    stopLoss: analysis.stopLoss,
    riskReward: analysis.riskReward,
    reasoning: analysis.reasoning,
    pattern: analysis.pattern,
    timeframe: analysis.timeframe,
    alerts: analysis.alerts,
    status: 'OPEN',
    entryTime: Date.now(),
    exitTime: null,
    result: null,
    pnl: null,
    pnlPercent: null,
    marketContext: {
      entryPrice: marketData.price,
      volume: marketData.volume,
      volumeRatio: marketData.volumeRatio,
      change: marketData.change,
      changePercent: marketData.changePercent
    }
  };
  
  return signal;
}

/**
 * Add a new signal
 */
export function addSignal(signal) {
  const signals = loadSignals();
  signals.push(signal);
  saveSignals(signals);
  return signal;
}

/**
 * Update signal status
 */
export function updateSignal(signalId, updates) {
  const signals = loadSignals();
  const index = signals.findIndex(s => s.id === signalId);
  
  if (index === -1) {
    console.error(`Signal ${signalId} not found`);
    return null;
  }
  
  signals[index] = { ...signals[index], ...updates };
  saveSignals(signals);
  
  return signals[index];
}

/**
 * Close a signal
 */
export function closeSignal(signalId, exitPrice, result = 'WIN') {
  const signals = loadSignals();
  const signal = signals.find(s => s.id === signalId);
  
  if (!signal) {
    console.error(`Signal ${signalId} not found`);
    return null;
  }
  
  // Calculate P&L
  const entryPrice = signal.entry;
  let pnl, pnlPercent;
  
  if (signal.direction === 'LONG') {
    pnl = exitPrice - entryPrice;
    pnlPercent = (pnl / entryPrice) * 100;
  } else {
    pnl = entryPrice - exitPrice;
    pnlPercent = (pnl / entryPrice) * 100;
  }
  
  const updates = {
    status: 'CLOSED',
    exitTime: Date.now(),
    exitPrice: exitPrice,
    result: result,
    pnl: pnl,
    pnlPercent: pnlPercent
  };
  
  return updateSignal(signalId, updates);
}

/**
 * Get open signals
 */
export function getOpenSignals() {
  const signals = loadSignals();
  return signals.filter(s => s.status === 'OPEN');
}

/**
 * Get closed signals
 */
export function getClosedSignals() {
  const signals = loadSignals();
  return signals.filter(s => s.status === 'CLOSED');
}

/**
 * Get signals by ticker
 */
export function getSignalsByTicker(ticker) {
  const signals = loadSignals();
  return signals.filter(s => s.ticker === ticker);
}

/**
 * Get recent signals (last N)
 */
export function getRecentSignals(count = 10) {
  const signals = loadSignals();
  return signals.slice(-count).reverse();
}

/**
 * Generate unique signal ID
 */
function generateSignalId() {
  return `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Process batch of AI analyses and generate signals
 */
export function processBatchAnalysis(analysisResults, marketDataMap) {
  const newSignals = [];
  
  for (const [ticker, analysis] of Object.entries(analysisResults)) {
    if (analysis.error) continue;
    
    const marketData = marketDataMap[ticker];
    if (!marketData) continue;
    
    const signal = generateSignal(analysis, marketData);
    
    if (signal) {
      addSignal(signal);
      newSignals.push(signal);
      console.log(`✅ Generated ${signal.direction} signal for ${ticker} (confidence: ${signal.confidence}/10)`);
    } else {
      console.log(`⏭️  Skipped ${ticker} - ${analysis.signal} signal with confidence ${analysis.confidence}`);
    }
  }
  
  return newSignals;
}

/**
 * Export signals summary
 */
export function exportSignalsSummary() {
  const signals = loadSignals();
  const open = signals.filter(s => s.status === 'OPEN');
  const closed = signals.filter(s => s.status === 'CLOSED');
  
  return {
    total: signals.length,
    open: open.length,
    closed: closed.length,
    openSignals: open,
    recentClosed: closed.slice(-10).reverse()
  };
}
