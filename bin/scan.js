#!/usr/bin/env node
// Market Scanner CLI
import { fetchAllTickers, TICKERS } from '../lib/market-data.js';
import { analyzeMarketData } from '../lib/technicals.js';

console.log('🐾 Klaw Terminal - Market Scanner\n');
console.log('═══════════════════════════════════════');
console.log(`Scanning ${Object.keys(TICKERS).length} tickers...\n`);

// Fetch market data
const marketData = await fetchAllTickers();

console.log('\n═══════════════════════════════════════');
console.log('MARKET SNAPSHOT');
console.log('═══════════════════════════════════════\n');

// Display market data
for (const [ticker, data] of Object.entries(marketData)) {
  if (!data) continue;
  
  const changeSymbol = data.change >= 0 ? '+' : '';
  const changeColor = data.change >= 0 ? '🟢' : '🔴';
  
  console.log(`${ticker.padEnd(6)} ${changeColor} $${data.price.toFixed(2).padStart(8)} ${changeSymbol}${data.changePercent.toFixed(2)}%`);
  
  if (data.volumeRatio >= 1.5) {
    console.log(`       📊 Volume: ${data.volumeRatio.toFixed(2)}x avg (UNUSUAL)`);
  }
  
  if (data.dayRange) {
    console.log(`       Range: $${data.dayRange.low.toFixed(2)} - $${data.dayRange.high.toFixed(2)}`);
  }
  
  console.log('');
}

console.log('═══════════════════════════════════════');
console.log('TECHNICAL ANALYSIS');
console.log('═══════════════════════════════════════\n');

// Perform technical analysis
const technicals = {};

for (const [ticker, data] of Object.entries(marketData)) {
  if (!data || !data.historicalData) {
    console.log(`${ticker}: Skipped (insufficient data)\n`);
    continue;
  }
  
  const analysis = analyzeMarketData(data);
  technicals[ticker] = analysis;
  
  console.log(`${ticker} - ${analysis.trend.toUpperCase()}`);
  console.log(`  Price: $${analysis.price.toFixed(2)}`);
  
  if (analysis.rsi) {
    let rsiStatus = '';
    if (analysis.rsi > 70) rsiStatus = ' (OVERBOUGHT 🔥)';
    else if (analysis.rsi < 30) rsiStatus = ' (OVERSOLD ❄️)';
    console.log(`  RSI: ${analysis.rsi.toFixed(2)}${rsiStatus}`);
  }
  
  if (analysis.macd) {
    const macdSignal = analysis.macd.histogram > 0 ? '🟢 Bullish' : '🔴 Bearish';
    console.log(`  MACD: ${macdSignal} (${analysis.macd.histogram.toFixed(2)})`);
  }
  
  if (analysis.vwap) {
    const vwapPosition = analysis.price > analysis.vwap ? 'above' : 'below';
    console.log(`  VWAP: $${analysis.vwap.toFixed(2)} (price ${vwapPosition})`);
  }
  
  if (analysis.bollingerBands) {
    const bb = analysis.bollingerBands;
    let bbPosition = '';
    if (analysis.price >= bb.upper) bbPosition = ' 🔴 Upper band';
    else if (analysis.price <= bb.lower) bbPosition = ' 🟢 Lower band';
    console.log(`  Bollinger: $${bb.lower.toFixed(2)} - $${bb.upper.toFixed(2)}${bbPosition}`);
  }
  
  if (analysis.supportResistance.resistance.length > 0) {
    console.log(`  Resistance: ${analysis.supportResistance.resistance.map(r => '$' + r.toFixed(2)).join(', ')}`);
  }
  
  if (analysis.supportResistance.support.length > 0) {
    console.log(`  Support: ${analysis.supportResistance.support.map(s => '$' + s.toFixed(2)).join(', ')}`);
  }
  
  if (analysis.volume.unusual) {
    console.log(`  📊 Volume: ${analysis.volume.ratio.toFixed(2)}x (${analysis.volume.level.toUpperCase()})`);
  }
  
  console.log('');
}

// Save results to temp file for analysis step
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

writeFileSync(join(dataDir, 'latest-scan.json'), JSON.stringify({
  marketData,
  technicals,
  timestamp: Date.now()
}, null, 2));

console.log('═══════════════════════════════════════');
console.log('✅ Scan complete! Run `node bin/analyze.js` for AI analysis');
console.log('═══════════════════════════════════════\n');
