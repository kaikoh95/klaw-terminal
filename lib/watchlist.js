// Dynamic Watchlist Management
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const WATCHLIST_FILE = join(DATA_DIR, 'watchlist.json');

// Default tickers (initial watchlist)
const DEFAULT_TICKERS = {
  SPY: { yahoo: 'SPY', google: 'SPY:NYSEARCA', name: 'S&P 500 ETF', exchange: 'NYSEARCA' },
  QQQ: { yahoo: 'QQQ', google: 'QQQ:NASDAQ', name: 'Nasdaq-100 ETF', exchange: 'NASDAQ' },
  ONDS: { yahoo: 'ONDS', google: 'ONDS:NASDAQ', name: 'Ondas Holdings', exchange: 'NASDAQ' },
  USAR: { yahoo: 'USAR', google: 'USAR:NYSEARCA', name: 'American Century US Equity', exchange: 'NYSEARCA' },
  RDDT: { yahoo: 'RDDT', google: 'RDDT:NYSE', name: 'Reddit Inc', exchange: 'NYSE' },
  UUUU: { yahoo: 'UUUU', google: 'UUUU:NYSEAMERICAN', name: 'Energy Fuels Inc', exchange: 'NYSEAMERICAN' },
  HOVR: { yahoo: 'HOVR', google: 'HOVR:NYSEARCA', name: 'Innovator Premium Income 20', exchange: 'NYSEARCA' }
};

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Load watchlist from file (or create default)
 */
export function loadWatchlist() {
  ensureDataDir();
  
  if (!existsSync(WATCHLIST_FILE)) {
    // Create default watchlist
    saveWatchlist(DEFAULT_TICKERS);
    return DEFAULT_TICKERS;
  }
  
  try {
    const data = readFileSync(WATCHLIST_FILE, 'utf8');
    const watchlist = JSON.parse(data);
    
    // Validate structure
    if (!watchlist || typeof watchlist !== 'object') {
      console.warn('Invalid watchlist file, resetting to defaults');
      saveWatchlist(DEFAULT_TICKERS);
      return DEFAULT_TICKERS;
    }
    
    return watchlist;
  } catch (error) {
    console.error('Error loading watchlist:', error.message);
    saveWatchlist(DEFAULT_TICKERS);
    return DEFAULT_TICKERS;
  }
}

/**
 * Save watchlist to file
 */
export function saveWatchlist(watchlist) {
  ensureDataDir();
  
  try {
    const data = JSON.stringify(watchlist, null, 2);
    writeFileSync(WATCHLIST_FILE, data);
    return true;
  } catch (error) {
    console.error('Error saving watchlist:', error.message);
    return false;
  }
}

/**
 * Add ticker to watchlist
 */
export function addTicker(symbol, config) {
  const watchlist = loadWatchlist();
  
  // Validate symbol
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Invalid ticker symbol');
  }
  
  const upperSymbol = symbol.toUpperCase();
  
  // Check if already exists
  if (watchlist[upperSymbol]) {
    throw new Error(`Ticker ${upperSymbol} already in watchlist`);
  }
  
  // Validate config
  if (!config || !config.yahoo || !config.google) {
    throw new Error('Invalid ticker configuration (missing yahoo or google)');
  }
  
  // Add to watchlist
  watchlist[upperSymbol] = {
    yahoo: config.yahoo,
    google: config.google,
    name: config.name || upperSymbol,
    exchange: config.exchange || 'UNKNOWN',
    addedAt: Date.now()
  };
  
  saveWatchlist(watchlist);
  return watchlist[upperSymbol];
}

/**
 * Remove ticker from watchlist
 */
export function removeTicker(symbol) {
  const watchlist = loadWatchlist();
  
  const upperSymbol = symbol.toUpperCase();
  
  if (!watchlist[upperSymbol]) {
    throw new Error(`Ticker ${upperSymbol} not found in watchlist`);
  }
  
  delete watchlist[upperSymbol];
  saveWatchlist(watchlist);
  return true;
}

/**
 * Get all tickers in watchlist
 */
export function getWatchlist() {
  return loadWatchlist();
}

/**
 * Get ticker symbols only (array)
 */
export function getTickerSymbols() {
  return Object.keys(loadWatchlist());
}

/**
 * Reset watchlist to defaults
 */
export function resetWatchlist() {
  saveWatchlist(DEFAULT_TICKERS);
  return DEFAULT_TICKERS;
}

/**
 * Validate ticker format helper
 * Attempts to auto-detect exchange and build config
 */
export function detectTickerConfig(symbol, exchange = null) {
  const upperSymbol = symbol.toUpperCase();
  
  // Common exchange mappings
  const exchangeMap = {
    'NYSE': 'NYSE',
    'NASDAQ': 'NASDAQ',
    'NYSEARCA': 'NYSEARCA', // ETFs
    'NYSEAMERICAN': 'NYSEAMERICAN',
    'AMEX': 'NYSEAMERICAN'
  };
  
  // Auto-detect or use provided exchange
  const detectedExchange = exchange ? exchangeMap[exchange.toUpperCase()] || exchange : 'NASDAQ';
  
  // Build config
  return {
    yahoo: upperSymbol,
    google: `${upperSymbol}:${detectedExchange}`,
    name: upperSymbol,
    exchange: detectedExchange
  };
}
