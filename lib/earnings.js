// Earnings Calendar Integration
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Fetch earnings data for a ticker from Alpha Vantage
 */
export async function fetchEarningsCalendar(ticker) {
  const apiKey = loadAlphaVantageKey();
  
  if (!apiKey) {
    console.log('Alpha Vantage API key not found, using demo mode');
    return getDemoEarnings(ticker);
  }
  
  try {
    const url = `https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&symbol=${ticker}&apikey=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status}`);
    }
    
    const csvText = await response.text();
    
    // Parse CSV response
    const earnings = parseEarningsCSV(csvText, ticker);
    
    return earnings;
  } catch (error) {
    console.error(`Error fetching earnings for ${ticker}:`, error.message);
    return getDemoEarnings(ticker);
  }
}

/**
 * Load Alpha Vantage API key from environment or .env file
 */
function loadAlphaVantageKey() {
  if (process.env.ALPHA_VANTAGE_API_KEY) {
    return process.env.ALPHA_VANTAGE_API_KEY;
  }
  
  try {
    const envFile = readFileSync(join(__dirname, '..', '.env'), 'utf8');
    const match = envFile.match(/ALPHA_VANTAGE_API_KEY=(.+)/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

/**
 * Parse earnings CSV data from Alpha Vantage
 */
function parseEarningsCSV(csvText, ticker) {
  const lines = csvText.trim().split('\n');
  
  if (lines.length < 2) {
    return {
      ticker,
      upcoming: [],
      recent: [],
      nextEarnings: null
    };
  }
  
  // Skip header line
  const headers = lines[0].split(',');
  const earnings = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    
    if (values.length < 3) continue;
    
    const earningsDate = values[2]; // reportDate column
    const fiscalPeriod = values[3] || 'Q?';
    const estimatedEPS = parseFloat(values[4]) || null;
    
    if (!earningsDate) continue;
    
    earnings.push({
      date: earningsDate,
      fiscalPeriod,
      estimatedEPS,
      timestamp: new Date(earningsDate).getTime()
    });
  }
  
  const now = Date.now();
  const upcoming = earnings
    .filter(e => e.timestamp >= now)
    .sort((a, b) => a.timestamp - b.timestamp);
  
  const recent = earnings
    .filter(e => e.timestamp < now)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 4);
  
  const nextEarnings = upcoming.length > 0 ? upcoming[0] : null;
  
  // Calculate days until next earnings
  if (nextEarnings) {
    const daysUntil = Math.ceil((nextEarnings.timestamp - now) / (1000 * 60 * 60 * 24));
    nextEarnings.daysUntil = daysUntil;
    nextEarnings.alert = daysUntil <= 7 ? 'IMMINENT' :
                         daysUntil <= 14 ? 'SOON' :
                         daysUntil <= 30 ? 'UPCOMING' : 'SCHEDULED';
  }
  
  return {
    ticker,
    upcoming: upcoming.slice(0, 4),
    recent,
    nextEarnings,
    timestamp: Date.now()
  };
}

/**
 * Get demo earnings data when API is not available
 */
function getDemoEarnings(ticker) {
  const now = Date.now();
  const futureDate = new Date(now + (15 * 24 * 60 * 60 * 1000)); // 15 days from now
  const pastDate = new Date(now - (90 * 24 * 60 * 60 * 1000)); // 90 days ago
  
  const nextEarnings = {
    date: futureDate.toISOString().split('T')[0],
    fiscalPeriod: 'Q4',
    estimatedEPS: 0.85,
    timestamp: futureDate.getTime(),
    daysUntil: 15,
    alert: 'SOON'
  };
  
  return {
    ticker,
    upcoming: [nextEarnings],
    recent: [{
      date: pastDate.toISOString().split('T')[0],
      fiscalPeriod: 'Q3',
      estimatedEPS: 0.72,
      timestamp: pastDate.getTime()
    }],
    nextEarnings,
    timestamp: now,
    demo: true
  };
}

/**
 * Batch fetch earnings for multiple tickers
 */
export async function batchFetchEarnings(tickers) {
  const results = {};
  
  for (const ticker of tickers) {
    console.log(`Fetching earnings calendar for ${ticker}...`);
    
    try {
      const earnings = await fetchEarningsCalendar(ticker);
      results[ticker] = earnings;
      
      // Rate limiting (Alpha Vantage free tier: 25 calls/day, 5 calls/minute)
      await new Promise(resolve => setTimeout(resolve, 12000)); // 12s between calls = 5/min
    } catch (error) {
      console.error(`Failed to fetch earnings for ${ticker}:`, error.message);
      results[ticker] = {
        ticker,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
  
  return results;
}

/**
 * Get summary of upcoming earnings across all tickers
 */
export function getEarningsSummary(earningsData) {
  const now = Date.now();
  const upcoming = [];
  
  for (const [ticker, data] of Object.entries(earningsData)) {
    if (data.error || !data.nextEarnings) continue;
    
    upcoming.push({
      ticker,
      ...data.nextEarnings
    });
  }
  
  // Sort by date (soonest first)
  upcoming.sort((a, b) => a.timestamp - b.timestamp);
  
  const imminent = upcoming.filter(e => e.daysUntil <= 7);
  const thisWeek = upcoming.filter(e => e.daysUntil <= 7);
  const nextWeek = upcoming.filter(e => e.daysUntil > 7 && e.daysUntil <= 14);
  const thisMonth = upcoming.filter(e => e.daysUntil > 14 && e.daysUntil <= 30);
  
  return {
    total: upcoming.length,
    imminent: imminent.length,
    thisWeek: thisWeek.length,
    nextWeek: nextWeek.length,
    thisMonth: thisMonth.length,
    upcoming,
    alerts: imminent.map(e => ({
      ticker: e.ticker,
      message: `${e.ticker} earnings in ${e.daysUntil} day${e.daysUntil !== 1 ? 's' : ''} (${e.date})`,
      severity: e.daysUntil <= 3 ? 'CRITICAL' : 'WARNING'
    }))
  };
}
