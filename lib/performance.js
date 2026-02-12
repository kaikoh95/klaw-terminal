// Performance Tracking and Analytics
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadSignals } from './signals.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const PERFORMANCE_FILE = join(DATA_DIR, 'performance.json');

/**
 * Calculate performance metrics from signals
 */
export function calculatePerformance() {
  const signals = loadSignals();
  const closedSignals = signals.filter(s => s.status === 'CLOSED');
  
  if (closedSignals.length === 0) {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      hitRate: 0,
      avgReturn: 0,
      totalReturn: 0,
      bestTrade: null,
      worstTrade: null,
      winStreak: 0,
      lossStreak: 0,
      currentStreak: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      expectancy: 0,
      byTicker: {},
      byPattern: {},
      byTimeframe: {},
      timestamp: Date.now()
    };
  }
  
  const wins = closedSignals.filter(s => s.result === 'WIN');
  const losses = closedSignals.filter(s => s.result === 'LOSS');
  
  const totalReturn = closedSignals.reduce((sum, s) => sum + (s.pnlPercent || 0), 0);
  const avgReturn = totalReturn / closedSignals.length;
  
  // Win/Loss metrics
  const winReturns = wins.map(s => s.pnlPercent || 0);
  const lossReturns = losses.map(s => s.pnlPercent || 0);
  
  const avgWin = winReturns.length > 0 ? winReturns.reduce((a, b) => a + b, 0) / winReturns.length : 0;
  const avgLoss = lossReturns.length > 0 ? lossReturns.reduce((a, b) => a + b, 0) / lossReturns.length : 0;
  
  // Best and worst trades
  const sortedByPnl = [...closedSignals].sort((a, b) => (b.pnlPercent || 0) - (a.pnlPercent || 0));
  const bestTrade = sortedByPnl[0] || null;
  const worstTrade = sortedByPnl[sortedByPnl.length - 1] || null;
  
  // Streaks
  const streaks = calculateStreaks(closedSignals);
  
  // Profit factor
  const totalWins = winReturns.reduce((a, b) => a + b, 0);
  const totalLosses = Math.abs(lossReturns.reduce((a, b) => a + b, 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
  
  // Expectancy
  const hitRate = wins.length / closedSignals.length;
  const expectancy = (hitRate * avgWin) - ((1 - hitRate) * Math.abs(avgLoss));
  
  // Breakdown by ticker
  const byTicker = calculateByCategory(closedSignals, 'ticker');
  
  // Breakdown by pattern
  const byPattern = calculateByCategory(closedSignals, 'pattern');
  
  // Breakdown by timeframe
  const byTimeframe = calculateByCategory(closedSignals, 'timeframe');
  
  const performance = {
    totalTrades: closedSignals.length,
    wins: wins.length,
    losses: losses.length,
    hitRate: hitRate * 100,
    avgReturn: avgReturn,
    totalReturn: totalReturn,
    bestTrade: bestTrade ? {
      ticker: bestTrade.ticker,
      direction: bestTrade.direction,
      pnl: bestTrade.pnlPercent,
      date: new Date(bestTrade.entryTime).toISOString()
    } : null,
    worstTrade: worstTrade ? {
      ticker: worstTrade.ticker,
      direction: worstTrade.direction,
      pnl: worstTrade.pnlPercent,
      date: new Date(worstTrade.entryTime).toISOString()
    } : null,
    winStreak: streaks.maxWinStreak,
    lossStreak: streaks.maxLossStreak,
    currentStreak: streaks.currentStreak,
    avgWin: avgWin,
    avgLoss: avgLoss,
    profitFactor: profitFactor,
    expectancy: expectancy,
    byTicker: byTicker,
    byPattern: byPattern,
    byTimeframe: byTimeframe,
    timestamp: Date.now()
  };
  
  // Save to file
  savePerformance(performance);
  
  return performance;
}

/**
 * Calculate win/loss streaks
 */
function calculateStreaks(signals) {
  let currentStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  
  for (const signal of signals) {
    if (signal.result === 'WIN') {
      currentWinStreak++;
      currentLossStreak = 0;
      currentStreak++;
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
    } else if (signal.result === 'LOSS') {
      currentLossStreak++;
      currentWinStreak = 0;
      currentStreak--;
      maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
    }
  }
  
  return {
    currentStreak,
    maxWinStreak,
    maxLossStreak
  };
}

/**
 * Calculate performance breakdown by category
 */
function calculateByCategory(signals, category) {
  const breakdown = {};
  
  for (const signal of signals) {
    const key = signal[category] || 'Unknown';
    
    if (!breakdown[key]) {
      breakdown[key] = {
        trades: 0,
        wins: 0,
        losses: 0,
        hitRate: 0,
        avgReturn: 0,
        totalReturn: 0
      };
    }
    
    breakdown[key].trades++;
    if (signal.result === 'WIN') breakdown[key].wins++;
    if (signal.result === 'LOSS') breakdown[key].losses++;
    breakdown[key].totalReturn += signal.pnlPercent || 0;
  }
  
  // Calculate averages
  for (const key of Object.keys(breakdown)) {
    const data = breakdown[key];
    data.hitRate = (data.wins / data.trades) * 100;
    data.avgReturn = data.totalReturn / data.trades;
  }
  
  return breakdown;
}

/**
 * Save performance to disk
 */
function savePerformance(performance) {
  try {
    writeFileSync(PERFORMANCE_FILE, JSON.stringify(performance, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving performance:', error.message);
  }
}

/**
 * Load performance from disk
 */
export function loadPerformance() {
  if (!existsSync(PERFORMANCE_FILE)) {
    return calculatePerformance();
  }
  
  try {
    const data = readFileSync(PERFORMANCE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading performance:', error.message);
    return calculatePerformance();
  }
}

/**
 * Get performance summary for display
 */
export function getPerformanceSummary() {
  const perf = calculatePerformance();
  
  return {
    overview: {
      totalTrades: perf.totalTrades,
      hitRate: `${perf.hitRate.toFixed(1)}%`,
      totalReturn: `${perf.totalReturn.toFixed(2)}%`,
      avgReturn: `${perf.avgReturn.toFixed(2)}%`,
      profitFactor: perf.profitFactor === Infinity ? '∞' : perf.profitFactor.toFixed(2),
      expectancy: `${perf.expectancy.toFixed(2)}%`
    },
    streaks: {
      current: perf.currentStreak,
      bestWin: perf.winStreak,
      worstLoss: perf.lossStreak
    },
    trades: {
      wins: perf.wins,
      losses: perf.losses,
      avgWin: `${perf.avgWin.toFixed(2)}%`,
      avgLoss: `${perf.avgLoss.toFixed(2)}%`
    },
    extremes: {
      best: perf.bestTrade,
      worst: perf.worstTrade
    }
  };
}

/**
 * Generate performance report
 */
export function generatePerformanceReport() {
  const perf = calculatePerformance();
  
  let report = '═══════════════════════════════════════\n';
  report += '     KLAW TERMINAL PERFORMANCE\n';
  report += '═══════════════════════════════════════\n\n';
  
  report += `Total Trades: ${perf.totalTrades}\n`;
  report += `Win Rate: ${perf.hitRate.toFixed(1)}%\n`;
  report += `Total Return: ${perf.totalReturn > 0 ? '+' : ''}${perf.totalReturn.toFixed(2)}%\n`;
  report += `Average Return: ${perf.avgReturn > 0 ? '+' : ''}${perf.avgReturn.toFixed(2)}%\n`;
  report += `Profit Factor: ${perf.profitFactor === Infinity ? '∞' : perf.profitFactor.toFixed(2)}\n`;
  report += `Expectancy: ${perf.expectancy > 0 ? '+' : ''}${perf.expectancy.toFixed(2)}%\n\n`;
  
  report += '─────────────────────────────────────\n';
  report += `Wins: ${perf.wins} (avg: ${perf.avgWin > 0 ? '+' : ''}${perf.avgWin.toFixed(2)}%)\n`;
  report += `Losses: ${perf.losses} (avg: ${perf.avgLoss.toFixed(2)}%)\n`;
  report += `Current Streak: ${perf.currentStreak}\n`;
  report += `Best Win Streak: ${perf.winStreak}\n`;
  report += `Worst Loss Streak: ${perf.lossStreak}\n\n`;
  
  if (perf.bestTrade) {
    report += '─────────────────────────────────────\n';
    report += 'BEST TRADE\n';
    report += `${perf.bestTrade.ticker} ${perf.bestTrade.direction}: ${perf.bestTrade.pnl > 0 ? '+' : ''}${perf.bestTrade.pnl.toFixed(2)}%\n\n`;
  }
  
  if (perf.worstTrade) {
    report += 'WORST TRADE\n';
    report += `${perf.worstTrade.ticker} ${perf.worstTrade.direction}: ${perf.worstTrade.pnl.toFixed(2)}%\n\n`;
  }
  
  report += '═══════════════════════════════════════\n';
  
  return report;
}
