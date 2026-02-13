// Trade Journal - Log actual trades, track execution vs signals, learn from outcomes
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const JOURNAL_FILE = join(DATA_DIR, 'trade-journal.json');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Load trade journal from disk
 */
export function loadJournal() {
  if (!existsSync(JOURNAL_FILE)) {
    return { trades: [], stats: null };
  }
  
  try {
    const data = readFileSync(JOURNAL_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load trade journal:', error);
    return { trades: [], stats: null };
  }
}

/**
 * Save trade journal to disk
 */
function saveJournal(journal) {
  try {
    writeFileSync(JOURNAL_FILE, JSON.stringify(journal, null, 2));
  } catch (error) {
    console.error('Failed to save trade journal:', error);
    throw error;
  }
}

/**
 * Add a new trade to the journal
 */
export function addTrade(trade) {
  const journal = loadJournal();
  
  const newTrade = {
    id: Date.now().toString(),
    ticker: trade.ticker,
    direction: trade.direction, // LONG or SHORT
    entryDate: trade.entryDate || Date.now(),
    entryPrice: trade.entryPrice,
    size: trade.size, // number of shares/contracts
    exitDate: trade.exitDate || null,
    exitPrice: trade.exitPrice || null,
    stopLoss: trade.stopLoss || null,
    targets: trade.targets || { t1: null, t2: null, t3: null },
    status: trade.status || 'OPEN', // OPEN, CLOSED, STOPPED_OUT
    pnl: trade.pnl || null,
    pnlPercent: trade.pnlPercent || null,
    signalId: trade.signalId || null, // link to original AI signal
    signalConfidence: trade.signalConfidence || null,
    pattern: trade.pattern || null,
    timeframe: trade.timeframe || null,
    notes: trade.notes || '',
    tags: trade.tags || [],
    executionQuality: {
      slippage: trade.slippage || 0, // actual entry vs planned entry
      timingDelay: trade.timingDelay || 0, // minutes from signal to entry
      targetHit: trade.targetHit || null // which target was hit (t1, t2, t3, none)
    },
    mistakes: trade.mistakes || [], // what went wrong?
    lessons: trade.lessons || '' // what did I learn?
  };
  
  // Calculate P&L if exit price provided
  if (newTrade.exitPrice && newTrade.entryPrice && newTrade.size) {
    const multiplier = newTrade.direction === 'LONG' ? 1 : -1;
    newTrade.pnl = (newTrade.exitPrice - newTrade.entryPrice) * multiplier * newTrade.size;
    newTrade.pnlPercent = ((newTrade.exitPrice - newTrade.entryPrice) / newTrade.entryPrice) * multiplier * 100;
  }
  
  journal.trades.push(newTrade);
  journal.stats = calculateStats(journal.trades);
  
  saveJournal(journal);
  return newTrade;
}

/**
 * Update an existing trade
 */
export function updateTrade(tradeId, updates) {
  const journal = loadJournal();
  const tradeIndex = journal.trades.findIndex(t => t.id === tradeId);
  
  if (tradeIndex === -1) {
    throw new Error('Trade not found');
  }
  
  const trade = journal.trades[tradeIndex];
  
  // Merge updates
  Object.assign(trade, updates);
  
  // Recalculate P&L if exit info updated
  if (trade.exitPrice && trade.entryPrice && trade.size) {
    const multiplier = trade.direction === 'LONG' ? 1 : -1;
    trade.pnl = (trade.exitPrice - trade.entryPrice) * multiplier * trade.size;
    trade.pnlPercent = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * multiplier * 100;
    
    if (!trade.status || trade.status === 'OPEN') {
      trade.status = 'CLOSED';
    }
  }
  
  journal.trades[tradeIndex] = trade;
  journal.stats = calculateStats(journal.trades);
  
  saveJournal(journal);
  return trade;
}

/**
 * Delete a trade
 */
export function deleteTrade(tradeId) {
  const journal = loadJournal();
  const initialLength = journal.trades.length;
  
  journal.trades = journal.trades.filter(t => t.id !== tradeId);
  
  if (journal.trades.length === initialLength) {
    throw new Error('Trade not found');
  }
  
  journal.stats = calculateStats(journal.trades);
  saveJournal(journal);
  
  return { deleted: true, remainingTrades: journal.trades.length };
}

/**
 * Get all trades with optional filters
 */
export function getTrades(filters = {}) {
  const journal = loadJournal();
  let trades = journal.trades;
  
  // Filter by ticker
  if (filters.ticker) {
    trades = trades.filter(t => t.ticker === filters.ticker);
  }
  
  // Filter by status
  if (filters.status) {
    trades = trades.filter(t => t.status === filters.status);
  }
  
  // Filter by direction
  if (filters.direction) {
    trades = trades.filter(t => t.direction === filters.direction);
  }
  
  // Filter by pattern
  if (filters.pattern) {
    trades = trades.filter(t => t.pattern === filters.pattern);
  }
  
  // Filter by date range
  if (filters.startDate) {
    trades = trades.filter(t => t.entryDate >= filters.startDate);
  }
  if (filters.endDate) {
    trades = trades.filter(t => t.entryDate <= filters.endDate);
  }
  
  // Filter by P&L (winners/losers)
  if (filters.outcome === 'winners') {
    trades = trades.filter(t => t.pnl > 0);
  } else if (filters.outcome === 'losers') {
    trades = trades.filter(t => t.pnl < 0);
  }
  
  // Sort by date (newest first)
  trades.sort((a, b) => b.entryDate - a.entryDate);
  
  // Limit results
  if (filters.limit) {
    trades = trades.slice(0, filters.limit);
  }
  
  return trades;
}

/**
 * Get a single trade by ID
 */
export function getTrade(tradeId) {
  const journal = loadJournal();
  const trade = journal.trades.find(t => t.id === tradeId);
  
  if (!trade) {
    throw new Error('Trade not found');
  }
  
  return trade;
}

/**
 * Calculate comprehensive journal statistics
 */
function calculateStats(trades) {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      openTrades: 0,
      closedTrades: 0,
      winRate: 0,
      avgReturn: 0,
      totalPnL: 0,
      bestTrade: null,
      worstTrade: null,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      expectancy: 0,
      avgHoldTime: 0,
      executionQuality: {
        avgSlippage: 0,
        avgTimingDelay: 0
      },
      byPattern: {},
      byTicker: {},
      recentStreak: { type: null, count: 0 }
    };
  }
  
  const closedTrades = trades.filter(t => t.status === 'CLOSED' || t.pnl !== null);
  const openTrades = trades.filter(t => t.status === 'OPEN' && !t.pnl);
  
  const winners = closedTrades.filter(t => t.pnl > 0);
  const losers = closedTrades.filter(t => t.pnl < 0);
  
  const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalWins = winners.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losers.reduce((sum, t) => sum + t.pnl, 0));
  
  const avgReturn = closedTrades.length > 0
    ? closedTrades.reduce((sum, t) => sum + (t.pnlPercent || 0), 0) / closedTrades.length
    : 0;
  
  const avgWin = winners.length > 0 ? totalWins / winners.length : 0;
  const avgLoss = losers.length > 0 ? totalLosses / losers.length : 0;
  
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
  const expectancy = avgWin * (winners.length / closedTrades.length) - avgLoss * (losers.length / closedTrades.length);
  
  // Calculate average hold time
  const tradesWithHoldTime = closedTrades.filter(t => t.exitDate && t.entryDate);
  const avgHoldTime = tradesWithHoldTime.length > 0
    ? tradesWithHoldTime.reduce((sum, t) => sum + (t.exitDate - t.entryDate), 0) / tradesWithHoldTime.length
    : 0;
  
  // Execution quality metrics
  const tradesWithSlippage = trades.filter(t => t.executionQuality && t.executionQuality.slippage !== undefined);
  const avgSlippage = tradesWithSlippage.length > 0
    ? tradesWithSlippage.reduce((sum, t) => sum + Math.abs(t.executionQuality.slippage), 0) / tradesWithSlippage.length
    : 0;
  
  const tradesWithTiming = trades.filter(t => t.executionQuality && t.executionQuality.timingDelay !== undefined);
  const avgTimingDelay = tradesWithTiming.length > 0
    ? tradesWithTiming.reduce((sum, t) => sum + t.executionQuality.timingDelay, 0) / tradesWithTiming.length
    : 0;
  
  // Best and worst trades
  const bestTrade = closedTrades.reduce((best, trade) => 
    !best || (trade.pnl > best.pnl) ? trade : best, null);
  
  const worstTrade = closedTrades.reduce((worst, trade) => 
    !worst || (trade.pnl < worst.pnl) ? trade : worst, null);
  
  // Calculate recent streak
  const recentStreak = calculateStreak(closedTrades);
  
  // Stats by pattern
  const byPattern = {};
  closedTrades.forEach(trade => {
    const pattern = trade.pattern || 'Unknown';
    if (!byPattern[pattern]) {
      byPattern[pattern] = { trades: 0, wins: 0, totalPnL: 0 };
    }
    byPattern[pattern].trades++;
    if (trade.pnl > 0) byPattern[pattern].wins++;
    byPattern[pattern].totalPnL += trade.pnl;
  });
  
  // Stats by ticker
  const byTicker = {};
  closedTrades.forEach(trade => {
    const ticker = trade.ticker;
    if (!byTicker[ticker]) {
      byTicker[ticker] = { trades: 0, wins: 0, totalPnL: 0 };
    }
    byTicker[ticker].trades++;
    if (trade.pnl > 0) byTicker[ticker].wins++;
    byTicker[ticker].totalPnL += trade.pnl;
  });
  
  return {
    totalTrades: trades.length,
    openTrades: openTrades.length,
    closedTrades: closedTrades.length,
    winRate: closedTrades.length > 0 ? (winners.length / closedTrades.length * 100) : 0,
    avgReturn,
    totalPnL,
    bestTrade: bestTrade ? {
      id: bestTrade.id,
      ticker: bestTrade.ticker,
      pnl: bestTrade.pnl,
      pnlPercent: bestTrade.pnlPercent
    } : null,
    worstTrade: worstTrade ? {
      id: worstTrade.id,
      ticker: worstTrade.ticker,
      pnl: worstTrade.pnl,
      pnlPercent: worstTrade.pnlPercent
    } : null,
    avgWin,
    avgLoss,
    profitFactor,
    expectancy,
    avgHoldTime,
    executionQuality: {
      avgSlippage,
      avgTimingDelay
    },
    byPattern,
    byTicker,
    recentStreak
  };
}

/**
 * Calculate current win/loss streak
 */
function calculateStreak(closedTrades) {
  if (closedTrades.length === 0) {
    return { type: null, count: 0 };
  }
  
  // Sort by entry date (most recent first)
  const sorted = [...closedTrades].sort((a, b) => b.entryDate - a.entryDate);
  
  const isWin = sorted[0].pnl > 0;
  let count = 0;
  
  for (const trade of sorted) {
    if ((isWin && trade.pnl > 0) || (!isWin && trade.pnl <= 0)) {
      count++;
    } else {
      break;
    }
  }
  
  return {
    type: isWin ? 'WIN' : 'LOSS',
    count
  };
}

/**
 * Get journal statistics
 */
export function getStats() {
  const journal = loadJournal();
  return journal.stats || calculateStats(journal.trades);
}

/**
 * Export journal to CSV format
 */
export function exportToCSV() {
  const journal = loadJournal();
  
  const headers = [
    'ID', 'Date', 'Ticker', 'Direction', 'Entry', 'Exit', 'Size',
    'Status', 'P&L', 'P&L%', 'Stop Loss', 'Target Hit',
    'Signal Confidence', 'Pattern', 'Timeframe',
    'Slippage', 'Timing Delay', 'Notes', 'Tags', 'Lessons'
  ];
  
  const rows = journal.trades.map(t => [
    t.id,
    new Date(t.entryDate).toISOString(),
    t.ticker,
    t.direction,
    t.entryPrice?.toFixed(2) || '',
    t.exitPrice?.toFixed(2) || '',
    t.size || '',
    t.status,
    t.pnl?.toFixed(2) || '',
    t.pnlPercent?.toFixed(2) || '',
    t.stopLoss?.toFixed(2) || '',
    t.executionQuality?.targetHit || '',
    t.signalConfidence || '',
    t.pattern || '',
    t.timeframe || '',
    t.executionQuality?.slippage?.toFixed(2) || '',
    t.executionQuality?.timingDelay || '',
    t.notes || '',
    t.tags?.join(';') || '',
    t.lessons || ''
  ]);
  
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
  
  return csv;
}
