#!/usr/bin/env node
// AI Analysis CLI
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { batchAnalyze } from '../lib/gemini.js';
import { processBatchAnalysis } from '../lib/signals.js';
import { generatePerformanceReport } from '../lib/performance.js';
import { batchAnalyzeMultiTimeframe } from '../lib/multi-timeframe.js';
import { notifySignal } from '../lib/notifications.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
const scanFile = join(dataDir, 'latest-scan.json');

console.log('🐾 Klaw Terminal - AI Analysis\n');
console.log('═══════════════════════════════════════');

// Load latest scan results
if (!existsSync(scanFile)) {
  console.error('❌ No scan data found. Run `node bin/scan.js` first.\n');
  process.exit(1);
}

const scanData = JSON.parse(readFileSync(scanFile, 'utf8'));
const { marketData, technicals } = scanData;

console.log(`Analyzing ${Object.keys(marketData).length} tickers with Gemini AI...\n`);

// Run AI analysis
try {
  // First, fetch multi-timeframe data for all tickers
  console.log('🔄 Fetching multi-timeframe data...\n');
  const tickers = Object.keys(marketData);
  const multiTimeframeData = await batchAnalyzeMultiTimeframe(tickers);
  
  const analysisResults = await batchAnalyze(marketData, technicals, multiTimeframeData);
  
  console.log('\n═══════════════════════════════════════');
  console.log('AI ANALYSIS RESULTS');
  console.log('═══════════════════════════════════════\n');
  
  // Display results
  for (const [ticker, analysis] of Object.entries(analysisResults)) {
    if (analysis.error) {
      console.log(`${ticker}: ❌ ${analysis.error}\n`);
      continue;
    }
    
    const signalEmoji = analysis.signal === 'LONG' ? '🟢' : analysis.signal === 'SHORT' ? '🔴' : '⚪';
    const confidenceBar = '█'.repeat(analysis.confidence) + '░'.repeat(10 - analysis.confidence);
    
    console.log(`${ticker} ${signalEmoji} ${analysis.signal}`);
    console.log(`  Confidence: ${confidenceBar} ${analysis.confidence}/10`);
    console.log(`  Pattern: ${analysis.pattern}`);
    console.log(`  Timeframe: ${analysis.timeframe}`);
    console.log(`  Entry: $${analysis.entry.toFixed(2)}`);
    
    if (analysis.targets) {
      console.log(`  Targets: T1 $${analysis.targets.t1.toFixed(2)} | T2 $${analysis.targets.t2.toFixed(2)} | T3 $${analysis.targets.t3.toFixed(2)}`);
    }
    
    if (analysis.stopLoss) {
      console.log(`  Stop Loss: $${analysis.stopLoss.toFixed(2)}`);
    }
    
    if (analysis.riskReward) {
      console.log(`  Risk/Reward: 1:${analysis.riskReward.toFixed(2)}`);
    }
    
    console.log(`  Reasoning: ${analysis.reasoning}`);
    
    if (analysis.alerts && analysis.alerts.length > 0) {
      console.log(`  Alerts:`);
      analysis.alerts.forEach(alert => console.log(`    • ${alert}`));
    }
    
    console.log('');
  }
  
  console.log('═══════════════════════════════════════');
  console.log('SIGNAL GENERATION');
  console.log('═══════════════════════════════════════\n');
  
  // Generate signals and send notifications
  const newSignals = processBatchAnalysis(analysisResults, marketData);
  
  // Send notifications for high-confidence signals
  let notificationsSent = 0;
  for (const [ticker, analysis] of Object.entries(analysisResults)) {
    if (analysis && !analysis.error && analysis.signal !== 'NEUTRAL' && analysis.confidence >= 7) {
      try {
        notifySignal(analysis);
        notificationsSent++;
      } catch (err) {
        // Notifications might fail if WebSocket server not running, that's OK
        console.warn(`⚠️ Failed to send notification for ${ticker}:`, err.message);
      }
    }
  }
  
  if (newSignals.length === 0) {
    console.log('No high-confidence signals generated.');
  } else {
    console.log(`\n${newSignals.length} signal(s) added to tracking.`);
    if (notificationsSent > 0) {
      console.log(`🔔 ${notificationsSent} notification(s) sent to connected clients.\n`);
    }
  }
  
  console.log('═══════════════════════════════════════');
  console.log('PERFORMANCE OVERVIEW');
  console.log('═══════════════════════════════════════\n');
  
  // Show performance
  const perfReport = generatePerformanceReport();
  console.log(perfReport);
  
} catch (error) {
  console.error('❌ Analysis failed:', error.message);
  
  if (error.message.includes('GEMINI_API_KEY')) {
    console.error('\n💡 Make sure GEMINI_API_KEY is set in your environment:');
    console.error('   export GEMINI_API_KEY="your-api-key"\n');
  }
  
  process.exit(1);
}

console.log('✅ Analysis complete! Start web UI with `node bin/server.js`\n');
