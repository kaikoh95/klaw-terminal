// Signal Performance Tracking & Analysis
// Measures actual vs predicted outcomes for AI-generated signals

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERFORMANCE_FILE = join(__dirname, '..', 'data', 'signal-performance.json');

/**
 * Initialize signal performance tracking
 */
export function initializePerformanceTracking() {
  if (!existsSync(PERFORMANCE_FILE)) {
    const initialData = {
      signals: [],
      stats: {
        total: 0,
        profitable: 0,
        unprofitable: 0,
        breakeven: 0,
        avgAccuracy: 0,
        byPattern: {},
        byTimeframe: {},
        byTicker: {}
      }
    };
    savePerformanceData(initialData);
  }
}

/**
 * Load signal performance data
 */
function loadPerformanceData() {
  try {
    if (!existsSync(PERFORMANCE_FILE)) {
      initializePerformanceTracking();
    }
    return JSON.parse(readFileSync(PERFORMANCE_FILE, 'utf8'));
  } catch (error) {
    console.error('Error loading signal performance:', error);
    return { signals: [], stats: {} };
  }
}

/**
 * Save signal performance data
 */
function savePerformanceData(data) {
  try {
    writeFileSync(PERFORMANCE_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving signal performance:', error);
  }
}

/**
 * Track a new signal for performance monitoring
 */
export function trackSignal(signal, currentPrice) {
  const data = loadPerformanceData();
  
  const trackedSignal = {
    id: signal.id || Date.now(),
    ticker: signal.ticker,
    timestamp: signal.timestamp || Date.now(),
    direction: signal.direction,
    pattern: signal.pattern,
    timeframe: signal.timeframe,
    confidence: signal.confidence,
    entryPrice: signal.entryPrice || currentPrice,
    targetPrices: signal.targetPrices || [],
    stopLoss: signal.stopLoss,
    riskReward: signal.riskReward,
    status: 'ACTIVE',
    outcome: null,
    actualReturn: null,
    hitTargets: [],
    exitPrice: null,
    exitReason: null,
    durationHours: null
  };
  
  data.signals.push(trackedSignal);
  savePerformanceData(data);
  
  return trackedSignal.id;
}

/**
 * Update signal outcome based on price movement
 */
export function updateSignalOutcome(signalId, currentPrice, marketData) {
  const data = loadPerformanceData();
  const signal = data.signals.find(s => s.id === signalId);
  
  if (!signal || signal.status !== 'ACTIVE') {
    return null;
  }
  
  const entryPrice = signal.entryPrice;
  const currentReturn = ((currentPrice - entryPrice) / entryPrice) * 100;
  const isLong = signal.direction === 'LONG';
  const isShort = signal.direction === 'SHORT';
  
  // Check if stop loss hit
  if (signal.stopLoss) {
    const stopHit = isLong ? currentPrice <= signal.stopLoss : currentPrice >= signal.stopLoss;
    
    if (stopHit) {
      signal.status = 'CLOSED';
      signal.outcome = 'STOP_LOSS';
      signal.exitPrice = signal.stopLoss;
      signal.exitReason = 'Stop Loss Hit';
      signal.actualReturn = ((signal.stopLoss - entryPrice) / entryPrice) * 100;
      if (isShort) signal.actualReturn = -signal.actualReturn;
      signal.durationHours = (Date.now() - signal.timestamp) / (1000 * 60 * 60);
    }
  }
  
  // Check if targets hit
  if (signal.targetPrices && signal.status === 'ACTIVE') {
    for (let i = 0; i < signal.targetPrices.length; i++) {
      const target = signal.targetPrices[i];
      const targetHit = isLong ? currentPrice >= target : currentPrice <= target;
      
      if (targetHit && !signal.hitTargets.includes(i + 1)) {
        signal.hitTargets.push(i + 1);
        
        // Close on final target
        if (i === signal.targetPrices.length - 1) {
          signal.status = 'CLOSED';
          signal.outcome = 'TARGET_HIT';
          signal.exitPrice = target;
          signal.exitReason = `Target ${i + 1} Hit`;
          signal.actualReturn = ((target - entryPrice) / entryPrice) * 100;
          if (isShort) signal.actualReturn = -signal.actualReturn;
          signal.durationHours = (Date.now() - signal.timestamp) / (1000 * 60 * 60);
        }
      }
    }
  }
  
  // Auto-close signals older than timeframe threshold
  const ageHours = (Date.now() - signal.timestamp) / (1000 * 60 * 60);
  const maxAge = signal.timeframe === 'SCALP' ? 2 :
                 signal.timeframe === 'INTRADAY' ? 8 :
                 signal.timeframe === 'SWING' ? 72 : 24;
  
  if (ageHours > maxAge && signal.status === 'ACTIVE') {
    signal.status = 'CLOSED';
    signal.outcome = 'EXPIRED';
    signal.exitPrice = currentPrice;
    signal.exitReason = 'Timeframe Expired';
    signal.actualReturn = currentReturn;
    if (isShort) signal.actualReturn = -signal.actualReturn;
    signal.durationHours = ageHours;
  }
  
  savePerformanceData(data);
  
  // Recalculate stats if signal was closed
  if (signal.status === 'CLOSED') {
    recalculateStats();
  }
  
  return signal;
}

/**
 * Manually close a signal
 */
export function closeSignal(signalId, exitPrice, reason = 'Manual Close') {
  const data = loadPerformanceData();
  const signal = data.signals.find(s => s.id === signalId);
  
  if (!signal || signal.status !== 'ACTIVE') {
    return null;
  }
  
  signal.status = 'CLOSED';
  signal.outcome = reason.includes('Target') ? 'TARGET_HIT' : 
                  reason.includes('Stop') ? 'STOP_LOSS' : 'MANUAL_CLOSE';
  signal.exitPrice = exitPrice;
  signal.exitReason = reason;
  signal.actualReturn = ((exitPrice - signal.entryPrice) / signal.entryPrice) * 100;
  if (signal.direction === 'SHORT') signal.actualReturn = -signal.actualReturn;
  signal.durationHours = (Date.now() - signal.timestamp) / (1000 * 60 * 60);
  
  savePerformanceData(data);
  recalculateStats();
  
  return signal;
}

/**
 * Recalculate performance statistics
 */
function recalculateStats() {
  const data = loadPerformanceData();
  const closedSignals = data.signals.filter(s => s.status === 'CLOSED');
  
  if (closedSignals.length === 0) {
    return;
  }
  
  const stats = {
    total: closedSignals.length,
    profitable: closedSignals.filter(s => s.actualReturn > 0).length,
    unprofitable: closedSignals.filter(s => s.actualReturn < 0).length,
    breakeven: closedSignals.filter(s => s.actualReturn === 0).length,
    avgReturn: closedSignals.reduce((sum, s) => sum + s.actualReturn, 0) / closedSignals.length,
    winRate: (closedSignals.filter(s => s.actualReturn > 0).length / closedSignals.length) * 100,
    avgWin: closedSignals.filter(s => s.actualReturn > 0).reduce((sum, s) => sum + s.actualReturn, 0) / 
            (closedSignals.filter(s => s.actualReturn > 0).length || 1),
    avgLoss: closedSignals.filter(s => s.actualReturn < 0).reduce((sum, s) => sum + s.actualReturn, 0) / 
             (closedSignals.filter(s => s.actualReturn < 0).length || 1),
    avgDuration: closedSignals.reduce((sum, s) => sum + s.durationHours, 0) / closedSignals.length,
    byPattern: {},
    byTimeframe: {},
    byTicker: {},
    byConfidence: {}
  };
  
  // Group by pattern
  for (const signal of closedSignals) {
    if (!stats.byPattern[signal.pattern]) {
      stats.byPattern[signal.pattern] = {
        total: 0,
        profitable: 0,
        avgReturn: 0,
        winRate: 0
      };
    }
    
    const pattern = stats.byPattern[signal.pattern];
    pattern.total++;
    if (signal.actualReturn > 0) pattern.profitable++;
  }
  
  // Calculate pattern stats
  for (const pattern in stats.byPattern) {
    const p = stats.byPattern[pattern];
    const signals = closedSignals.filter(s => s.pattern === pattern);
    p.avgReturn = signals.reduce((sum, s) => sum + s.actualReturn, 0) / signals.length;
    p.winRate = (p.profitable / p.total) * 100;
  }
  
  // Group by timeframe
  for (const signal of closedSignals) {
    if (!stats.byTimeframe[signal.timeframe]) {
      stats.byTimeframe[signal.timeframe] = {
        total: 0,
        profitable: 0,
        avgReturn: 0,
        winRate: 0
      };
    }
    
    const tf = stats.byTimeframe[signal.timeframe];
    tf.total++;
    if (signal.actualReturn > 0) tf.profitable++;
  }
  
  // Calculate timeframe stats
  for (const timeframe in stats.byTimeframe) {
    const tf = stats.byTimeframe[timeframe];
    const signals = closedSignals.filter(s => s.timeframe === timeframe);
    tf.avgReturn = signals.reduce((sum, s) => sum + s.actualReturn, 0) / signals.length;
    tf.winRate = (tf.profitable / tf.total) * 100;
  }
  
  // Group by ticker
  for (const signal of closedSignals) {
    if (!stats.byTicker[signal.ticker]) {
      stats.byTicker[signal.ticker] = {
        total: 0,
        profitable: 0,
        avgReturn: 0,
        winRate: 0
      };
    }
    
    const ticker = stats.byTicker[signal.ticker];
    ticker.total++;
    if (signal.actualReturn > 0) ticker.profitable++;
  }
  
  // Calculate ticker stats
  for (const ticker in stats.byTicker) {
    const t = stats.byTicker[ticker];
    const signals = closedSignals.filter(s => s.ticker === ticker);
    t.avgReturn = signals.reduce((sum, s) => sum + s.actualReturn, 0) / signals.length;
    t.winRate = (t.profitable / t.total) * 100;
  }
  
  // Group by confidence buckets (1-3, 4-6, 7-10)
  const confidenceBuckets = {
    'LOW (1-3)': closedSignals.filter(s => s.confidence >= 1 && s.confidence <= 3),
    'MEDIUM (4-6)': closedSignals.filter(s => s.confidence >= 4 && s.confidence <= 6),
    'HIGH (7-10)': closedSignals.filter(s => s.confidence >= 7 && s.confidence <= 10)
  };
  
  for (const bucket in confidenceBuckets) {
    const signals = confidenceBuckets[bucket];
    if (signals.length > 0) {
      stats.byConfidence[bucket] = {
        total: signals.length,
        profitable: signals.filter(s => s.actualReturn > 0).length,
        avgReturn: signals.reduce((sum, s) => sum + s.actualReturn, 0) / signals.length,
        winRate: (signals.filter(s => s.actualReturn > 0).length / signals.length) * 100
      };
    }
  }
  
  data.stats = stats;
  savePerformanceData(data);
}

/**
 * Get performance statistics
 */
export function getPerformanceStats() {
  const data = loadPerformanceData();
  return data.stats;
}

/**
 * Get active signals
 */
export function getActiveSignals() {
  const data = loadPerformanceData();
  return data.signals.filter(s => s.status === 'ACTIVE');
}

/**
 * Get closed signals (recent N)
 */
export function getClosedSignals(limit = 50) {
  const data = loadPerformanceData();
  return data.signals
    .filter(s => s.status === 'CLOSED')
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

/**
 * Get best performing patterns
 */
export function getBestPatterns(minSampleSize = 3) {
  const stats = getPerformanceStats();
  
  if (!stats.byPattern) return [];
  
  return Object.entries(stats.byPattern)
    .filter(([_, data]) => data.total >= minSampleSize)
    .sort((a, b) => b[1].winRate - a[1].winRate)
    .map(([pattern, data]) => ({
      pattern,
      ...data
    }));
}

/**
 * Get performance summary for UI
 */
export function getPerformanceSummary() {
  const stats = getPerformanceStats();
  const activeSignals = getActiveSignals();
  const closedSignals = getClosedSignals(10);
  const bestPatterns = getBestPatterns();
  
  return {
    overview: {
      totalSignals: stats.total || 0,
      winRate: stats.winRate || 0,
      avgReturn: stats.avgReturn || 0,
      avgWin: stats.avgWin || 0,
      avgLoss: stats.avgLoss || 0,
      avgDuration: stats.avgDuration || 0,
      profitFactor: Math.abs(stats.avgWin / (stats.avgLoss || -1)) || 0
    },
    active: activeSignals.length,
    recentClosed: closedSignals,
    bestPatterns: bestPatterns.slice(0, 5),
    byTimeframe: stats.byTimeframe || {},
    byTicker: stats.byTicker || {},
    byConfidence: stats.byConfidence || {}
  };
}

// Initialize on import
initializePerformanceTracking();
