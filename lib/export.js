// Data Export Utilities

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Convert array of objects to CSV format
 */
function toCSV(data, headers) {
  if (!data || data.length === 0) return '';
  
  // If headers not provided, use keys from first object
  if (!headers) {
    headers = Object.keys(data[0]);
  }
  
  // CSV header row
  const headerRow = headers.join(',');
  
  // CSV data rows
  const dataRows = data.map(row => {
    return headers.map(header => {
      let value = row[header];
      
      // Handle different types
      if (value === null || value === undefined) {
        value = '';
      } else if (typeof value === 'object') {
        value = JSON.stringify(value);
      } else if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        // Escape quotes and wrap in quotes
        value = `"${value.replace(/"/g, '""')}"`;
      }
      
      return value;
    }).join(',');
  });
  
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Export signals to CSV
 */
export function exportSignalsToCSV() {
  try {
    const signalsFile = join(__dirname, '..', 'data', 'signals.json');
    
    if (!existsSync(signalsFile)) {
      throw new Error('No signals data available');
    }
    
    const signals = JSON.parse(readFileSync(signalsFile, 'utf8'));
    
    if (!Array.isArray(signals) || signals.length === 0) {
      throw new Error('No signals to export');
    }
    
    // Flatten nested objects for CSV
    const flatSignals = signals.map(signal => ({
      ticker: signal.ticker,
      signal: signal.signal,
      confidence: signal.confidence,
      entry: signal.entry,
      target_1: signal.targets?.t1 || '',
      target_2: signal.targets?.t2 || '',
      target_3: signal.targets?.t3 || '',
      stop_loss: signal.stopLoss,
      risk_reward: signal.riskReward,
      pattern: signal.pattern,
      timeframe: signal.timeframe,
      reasoning: signal.reasoning,
      status: signal.status || 'active',
      timestamp: new Date(signal.timestamp).toISOString(),
      alerts: Array.isArray(signal.alerts) ? signal.alerts.join(' | ') : ''
    }));
    
    const headers = [
      'ticker', 'signal', 'confidence', 'entry', 
      'target_1', 'target_2', 'target_3', 'stop_loss', 
      'risk_reward', 'pattern', 'timeframe', 'reasoning', 
      'status', 'timestamp', 'alerts'
    ];
    
    return toCSV(flatSignals, headers);
  } catch (error) {
    throw new Error(`Failed to export signals: ${error.message}`);
  }
}

/**
 * Export performance data to CSV
 */
export function exportPerformanceToCSV() {
  try {
    const performanceFile = join(__dirname, '..', 'data', 'performance.json');
    
    if (!existsSync(performanceFile)) {
      throw new Error('No performance data available');
    }
    
    const performance = JSON.parse(readFileSync(performanceFile, 'utf8'));
    
    if (!performance.trades || performance.trades.length === 0) {
      throw new Error('No trade history to export');
    }
    
    // Flatten trades
    const flatTrades = performance.trades.map(trade => ({
      ticker: trade.ticker,
      signal: trade.signal,
      confidence: trade.confidence,
      entry: trade.entry,
      exit: trade.exit,
      return_percent: trade.return,
      profit_loss: trade.profitLoss || '',
      pattern: trade.pattern,
      timeframe: trade.timeframe,
      outcome: trade.outcome,
      entry_time: new Date(trade.entryTime).toISOString(),
      exit_time: trade.exitTime ? new Date(trade.exitTime).toISOString() : ''
    }));
    
    const headers = [
      'ticker', 'signal', 'confidence', 'entry', 'exit',
      'return_percent', 'profit_loss', 'pattern', 'timeframe',
      'outcome', 'entry_time', 'exit_time'
    ];
    
    return toCSV(flatTrades, headers);
  } catch (error) {
    throw new Error(`Failed to export performance: ${error.message}`);
  }
}

/**
 * Export technical analysis to CSV
 */
export function exportAnalysisToCSV() {
  try {
    const scanFile = join(__dirname, '..', 'data', 'latest-scan.json');
    
    if (!existsSync(scanFile)) {
      throw new Error('No scan data available');
    }
    
    const data = JSON.parse(readFileSync(scanFile, 'utf8'));
    
    if (!data.technicals || Object.keys(data.technicals).length === 0) {
      throw new Error('No technical analysis to export');
    }
    
    // Flatten technical analysis
    const flatAnalysis = Object.entries(data.technicals).map(([ticker, tech]) => ({
      ticker,
      price: data.marketData[ticker]?.price || '',
      change_percent: data.marketData[ticker]?.changePercent || '',
      volume_ratio: data.marketData[ticker]?.volumeRatio || '',
      trend: tech.trend,
      rsi: tech.rsi,
      mfi: tech.mfi?.value || '',
      mfi_signal: tech.mfi?.signal || '',
      macd: tech.macd?.macd || '',
      macd_signal: tech.macd?.signal || '',
      macd_histogram: tech.macd?.histogram || '',
      stochastic_k: tech.stochastic?.k || '',
      stochastic_d: tech.stochastic?.d || '',
      adx: tech.adx?.adx || '',
      adx_strength: tech.adx?.strength || '',
      atr: tech.atr,
      vwap: tech.vwap,
      bb_upper: tech.bollingerBands?.upper || '',
      bb_middle: tech.bollingerBands?.middle || '',
      bb_lower: tech.bollingerBands?.lower || '',
      bb_bandwidth: tech.bollingerBands?.bandwidth || '',
      sma_20: tech.movingAverages?.sma20 || '',
      sma_50: tech.movingAverages?.sma50 || '',
      sma_200: tech.movingAverages?.sma200 || '',
      ema_9: tech.movingAverages?.ema9 || '',
      ema_21: tech.movingAverages?.ema21 || '',
      support_levels: tech.supportResistance?.support?.join(';') || '',
      resistance_levels: tech.supportResistance?.resistance?.join(';') || ''
    }));
    
    const headers = [
      'ticker', 'price', 'change_percent', 'volume_ratio', 'trend',
      'rsi', 'mfi', 'mfi_signal', 'macd', 'macd_signal', 'macd_histogram',
      'stochastic_k', 'stochastic_d', 'adx', 'adx_strength', 'atr',
      'vwap', 'bb_upper', 'bb_middle', 'bb_lower', 'bb_bandwidth',
      'sma_20', 'sma_50', 'sma_200', 'ema_9', 'ema_21',
      'support_levels', 'resistance_levels'
    ];
    
    return toCSV(flatAnalysis, headers);
  } catch (error) {
    throw new Error(`Failed to export analysis: ${error.message}`);
  }
}
