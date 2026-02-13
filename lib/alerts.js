// Price Alert Management
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALERTS_FILE = join(__dirname, '..', 'data', 'alerts.json');

/**
 * Load all price alerts
 */
export function loadAlerts() {
  try {
    if (!existsSync(ALERTS_FILE)) {
      return [];
    }
    const data = readFileSync(ALERTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading alerts:', error.message);
    return [];
  }
}

/**
 * Save alerts to file
 */
export function saveAlerts(alerts) {
  try {
    writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving alerts:', error.message);
    return false;
  }
}

/**
 * Add a new price alert
 */
export function addAlert(ticker, price, condition, note = '') {
  const alerts = loadAlerts();
  
  const newAlert = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    ticker: ticker.toUpperCase(),
    price: parseFloat(price),
    condition, // 'above' or 'below'
    note,
    createdAt: Date.now(),
    triggered: false
  };
  
  alerts.push(newAlert);
  saveAlerts(alerts);
  
  return newAlert;
}

/**
 * Remove an alert by ID
 */
export function removeAlert(alertId) {
  const alerts = loadAlerts();
  const filtered = alerts.filter(a => a.id !== alertId);
  
  if (filtered.length < alerts.length) {
    saveAlerts(filtered);
    return true;
  }
  
  return false;
}

/**
 * Get active (non-triggered) alerts
 */
export function getActiveAlerts() {
  const alerts = loadAlerts();
  return alerts.filter(a => !a.triggered);
}

/**
 * Get triggered alerts
 */
export function getTriggeredAlerts(limit = 50) {
  const alerts = loadAlerts();
  return alerts
    .filter(a => a.triggered)
    .sort((a, b) => b.triggeredAt - a.triggeredAt)
    .slice(0, limit);
}

/**
 * Check market data against active alerts
 * Returns array of triggered alerts
 */
export function checkAlerts(marketData) {
  const alerts = loadAlerts();
  const triggered = [];
  
  for (const alert of alerts) {
    if (alert.triggered) continue;
    
    const tickerData = marketData[alert.ticker];
    if (!tickerData || !tickerData.price) continue;
    
    const currentPrice = tickerData.price;
    let isTriggered = false;
    
    if (alert.condition === 'above' && currentPrice >= alert.price) {
      isTriggered = true;
    } else if (alert.condition === 'below' && currentPrice <= alert.price) {
      isTriggered = true;
    }
    
    if (isTriggered) {
      alert.triggered = true;
      alert.triggeredAt = Date.now();
      alert.triggeredPrice = currentPrice;
      triggered.push(alert);
    }
  }
  
  if (triggered.length > 0) {
    saveAlerts(alerts);
  }
  
  return triggered;
}

/**
 * Clear all triggered alerts older than X days
 */
export function clearOldTriggeredAlerts(daysOld = 7) {
  const alerts = loadAlerts();
  const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
  
  const filtered = alerts.filter(a => {
    if (!a.triggered) return true;
    return a.triggeredAt > cutoff;
  });
  
  const removed = alerts.length - filtered.length;
  
  if (removed > 0) {
    saveAlerts(filtered);
  }
  
  return removed;
}

/**
 * Get alerts for a specific ticker
 */
export function getAlertsForTicker(ticker) {
  const alerts = loadAlerts();
  return alerts.filter(a => a.ticker === ticker.toUpperCase());
}
