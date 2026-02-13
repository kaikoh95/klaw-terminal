// Real-Time Signal Notifications System
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NOTIFICATIONS_FILE = join(__dirname, '..', 'data', 'notifications.json');

// In-memory WebSocket clients registry
let wsClients = new Set();

/**
 * Register a WebSocket client for notifications
 */
export function registerClient(ws) {
  wsClients.add(ws);
  console.log(`📡 Client registered for notifications (${wsClients.size} total)`);
  
  ws.on('close', () => {
    wsClients.delete(ws);
    console.log(`📡 Client unregistered (${wsClients.size} remaining)`);
  });
}

/**
 * Broadcast notification to all connected clients
 */
export function broadcastNotification(notification) {
  const message = JSON.stringify({
    type: 'signal-notification',
    data: notification,
    timestamp: Date.now()
  });
  
  let sent = 0;
  wsClients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
      sent++;
    }
  });
  
  if (sent > 0) {
    console.log(`🔔 Broadcast notification to ${sent} client(s): ${notification.title}`);
  }
  
  // Save to history
  saveNotification(notification);
}

/**
 * Create and broadcast a signal notification
 */
export function notifySignal(signal) {
  // Only notify for high-confidence signals (7+)
  if (signal.confidence < 7) {
    return;
  }
  
  const notification = {
    id: `signal-${Date.now()}-${signal.ticker}`,
    type: 'signal',
    priority: signal.confidence >= 9 ? 'critical' : signal.confidence >= 8 ? 'high' : 'medium',
    title: `🎯 ${signal.signal} Signal: ${signal.ticker}`,
    message: `${signal.reasoning}`,
    ticker: signal.ticker,
    signal: signal.signal,
    confidence: signal.confidence,
    entry: signal.entry,
    targets: signal.targets,
    stopLoss: signal.stopLoss,
    pattern: signal.pattern,
    timeframe: signal.timeframe,
    timestamp: Date.now(),
    read: false
  };
  
  broadcastNotification(notification);
}

/**
 * Create and broadcast a custom notification
 */
export function notify(title, message, type = 'info', priority = 'medium') {
  const notification = {
    id: `notify-${Date.now()}`,
    type,
    priority,
    title,
    message,
    timestamp: Date.now(),
    read: false
  };
  
  broadcastNotification(notification);
}

/**
 * Save notification to history
 */
function saveNotification(notification) {
  let notifications = loadNotifications();
  
  // Keep only last 100 notifications
  if (notifications.length >= 100) {
    notifications = notifications.slice(-99);
  }
  
  notifications.push(notification);
  
  writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2));
}

/**
 * Load notification history
 */
export function loadNotifications() {
  if (!existsSync(NOTIFICATIONS_FILE)) {
    return [];
  }
  
  try {
    return JSON.parse(readFileSync(NOTIFICATIONS_FILE, 'utf8'));
  } catch (error) {
    console.error('Failed to load notifications:', error);
    return [];
  }
}

/**
 * Get recent notifications
 */
export function getRecentNotifications(limit = 20) {
  const notifications = loadNotifications();
  return notifications.slice(-limit).reverse();
}

/**
 * Mark notification as read
 */
export function markAsRead(notificationId) {
  const notifications = loadNotifications();
  const notification = notifications.find(n => n.id === notificationId);
  
  if (notification) {
    notification.read = true;
    writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2));
    return true;
  }
  
  return false;
}

/**
 * Mark all notifications as read
 */
export function markAllAsRead() {
  const notifications = loadNotifications();
  notifications.forEach(n => n.read = true);
  writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2));
  return notifications.length;
}

/**
 * Clear old notifications (older than specified days)
 */
export function clearOldNotifications(daysOld = 7) {
  const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
  const notifications = loadNotifications();
  const filtered = notifications.filter(n => n.timestamp > cutoff);
  
  const removed = notifications.length - filtered.length;
  
  if (removed > 0) {
    writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(filtered, null, 2));
    console.log(`🗑️ Cleared ${removed} old notifications (older than ${daysOld} days)`);
  }
  
  return removed;
}

/**
 * Get notification statistics
 */
export function getNotificationStats() {
  const notifications = loadNotifications();
  const unread = notifications.filter(n => !n.read).length;
  const byPriority = {
    critical: notifications.filter(n => n.priority === 'critical').length,
    high: notifications.filter(n => n.priority === 'high').length,
    medium: notifications.filter(n => n.priority === 'medium').length,
    low: notifications.filter(n => n.priority === 'low').length
  };
  
  return {
    total: notifications.length,
    unread,
    byPriority,
    connectedClients: wsClients.size
  };
}
