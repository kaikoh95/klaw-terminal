// Klaw Terminal - Frontend JavaScript

// WebSocket connection for real-time updates
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

// Price tracking for animations
const previousPrices = {};

// Initialize WebSocket connection
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  try {
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttempts = 0;
      updateConnectionStatus('connected');
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'market-update') {
          handleMarketUpdate(message.data, message.timestamp);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      updateConnectionStatus('error');
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      updateConnectionStatus('disconnected');
      
      // Attempt reconnection
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`Reconnecting... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(initWebSocket, RECONNECT_DELAY);
      } else {
        console.log('Max reconnection attempts reached. Falling back to polling.');
        // Fall back to polling
        setInterval(loadWatchlist, 30000);
      }
    };
  } catch (error) {
    console.error('Failed to initialize WebSocket:', error);
    updateConnectionStatus('error');
  }
}

// Handle real-time market data update
function handleMarketUpdate(marketData, timestamp) {
  // Update watchlist with new data
  const container = document.getElementById('watchlist');
  if (!container || !marketData) return;
  
  let html = '';
  
  for (const [ticker, data] of Object.entries(marketData)) {
    if (!data) continue;
    
    const changeClass = data.change >= 0 ? 'positive' : 'negative';
    const changeSymbol = data.change >= 0 ? '+' : '';
    const volumeIndicator = data.volumeRatio >= 1.5 ? ' 📊' : '';
    
    // Determine if price increased or decreased for animation
    let flashClass = '';
    let priceAnimClass = '';
    
    if (previousPrices[ticker] !== undefined && previousPrices[ticker] !== data.price) {
      if (data.price > previousPrices[ticker]) {
        flashClass = 'flash-up';
        priceAnimClass = 'animate-up';
      } else {
        flashClass = 'flash-down';
        priceAnimClass = 'animate-down';
      }
    }
    
    // Store current price for next comparison
    previousPrices[ticker] = data.price;
    
    // Add high-volume class if volume is elevated
    const volumeClass = data.volumeRatio >= 1.5 ? 'high-volume' : '';
    
    html += `
      <div class="watchlist-item ${flashClass}" data-ticker="${ticker}">
        <div class="ticker-info">
          <h3>${ticker}</h3>
          <div class="ticker-volume ${volumeClass}">
            Vol: ${formatVolume(data.volume)}${volumeIndicator}
          </div>
        </div>
        <div class="ticker-price ${changeClass}">
          <div class="price ${priceAnimClass}">$${data.price.toFixed(2)}</div>
          <div class="change">${changeSymbol}${data.changePercent.toFixed(2)}%</div>
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
  
  // Clean up animation classes after animation completes
  setTimeout(() => {
    const items = container.querySelectorAll('.watchlist-item');
    items.forEach(item => {
      item.classList.remove('flash-up', 'flash-down');
      const priceEl = item.querySelector('.price');
      if (priceEl) {
        priceEl.classList.remove('animate-up', 'animate-down');
      }
    });
  }, 1000);
  
  // Update timestamp
  const timestampEl = document.getElementById('lastUpdate');
  if (timestampEl) {
    const date = new Date(timestamp);
    timestampEl.textContent = date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}

// Update connection status indicator
function updateConnectionStatus(status) {
  let statusIndicator = document.getElementById('connectionStatus');
  
  // Create status indicator if it doesn't exist
  if (!statusIndicator) {
    const header = document.querySelector('header h1');
    if (header) {
      statusIndicator = document.createElement('span');
      statusIndicator.id = 'connectionStatus';
      statusIndicator.className = 'connection-status';
      header.appendChild(statusIndicator);
    } else {
      return;
    }
  }
  
  statusIndicator.className = `connection-status ${status}`;
  
  switch (status) {
    case 'connected':
      statusIndicator.textContent = '🟢 LIVE';
      statusIndicator.title = 'Real-time updates active';
      break;
    case 'disconnected':
      statusIndicator.textContent = '🟡 RECONNECTING';
      statusIndicator.title = 'Attempting to reconnect...';
      break;
    case 'error':
      statusIndicator.textContent = '🔴 OFFLINE';
      statusIndicator.title = 'Connection error';
      break;
  }
}

// Update timestamp display
function updateTimestamp() {
  const now = new Date();
  const formatted = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  const timestampEl = document.getElementById('lastUpdate');
  if (timestampEl) {
    timestampEl.textContent = formatted;
  }
}

// Load dashboard data
async function loadDashboard() {
  await Promise.all([
    loadPerformance(),
    loadWatchlist(),
    loadActiveSignals(),
    loadRecentSignals()
  ]);
  updateTimestamp();
}

// Load performance stats
async function loadPerformance() {
  try {
    const response = await fetch('/api/performance/summary');
    const result = await response.json();
    
    if (result.success && result.data.overview) {
      const { overview, streaks } = result.data;
      
      document.getElementById('hitRate').textContent = overview.hitRate || '--';
      document.getElementById('totalReturn').textContent = overview.totalReturn || '--';
      document.getElementById('avgReturn').textContent = overview.avgReturn || '--';
      document.getElementById('winStreak').textContent = streaks.bestWin || '--';
      
      // Color code returns
      const totalReturnEl = document.getElementById('totalReturn');
      if (overview.totalReturn && overview.totalReturn.includes('+')) {
        totalReturnEl.classList.add('positive');
      } else if (overview.totalReturn && overview.totalReturn.includes('-')) {
        totalReturnEl.classList.add('negative');
      }
      
      const avgReturnEl = document.getElementById('avgReturn');
      if (overview.avgReturn && overview.avgReturn.includes('+')) {
        avgReturnEl.classList.add('positive');
      } else if (overview.avgReturn && overview.avgReturn.includes('-')) {
        avgReturnEl.classList.add('negative');
      }
    }
  } catch (error) {
    console.error('Failed to load performance:', error);
  }
}

// Load watchlist
async function loadWatchlist() {
  const container = document.getElementById('watchlist');
  if (!container) return;
  
  try {
    const response = await fetch('/api/market-data');
    const result = await response.json();
    
    if (result.success && result.data) {
      const marketData = result.data;
      let html = '';
      
      for (const [ticker, data] of Object.entries(marketData)) {
        if (!data) continue;
        
        // Store initial prices (no animation on first load)
        if (previousPrices[ticker] === undefined) {
          previousPrices[ticker] = data.price;
        }
        
        const changeClass = data.change >= 0 ? 'positive' : 'negative';
        const changeSymbol = data.change >= 0 ? '+' : '';
        const volumeIndicator = data.volumeRatio >= 1.5 ? ' 📊' : '';
        const volumeClass = data.volumeRatio >= 1.5 ? 'high-volume' : '';
        
        html += `
          <div class="watchlist-item" data-ticker="${ticker}">
            <div class="ticker-info">
              <h3>${ticker}</h3>
              <div class="ticker-volume ${volumeClass}">
                Vol: ${formatVolume(data.volume)}${volumeIndicator}
              </div>
            </div>
            <div class="ticker-price ${changeClass}">
              <div class="price">$${data.price.toFixed(2)}</div>
              <div class="change">${changeSymbol}${data.changePercent.toFixed(2)}%</div>
            </div>
          </div>
        `;
      }
      
      container.innerHTML = html;
    }
  } catch (error) {
    console.error('Failed to load watchlist:', error);
    container.innerHTML = '<div class="empty-state">Failed to load market data</div>';
  }
}

// Load active signals
async function loadActiveSignals() {
  const container = document.getElementById('activeSignals');
  const countEl = document.getElementById('activeCount');
  if (!container) return;
  
  try {
    const response = await fetch('/api/signals');
    const result = await response.json();
    
    if (result.success && result.data.openSignals) {
      const signals = result.data.openSignals;
      
      if (countEl) {
        countEl.textContent = signals.length;
      }
      
      if (signals.length === 0) {
        container.innerHTML = '<div class="empty-state">No active signals</div>';
        return;
      }
      
      let html = '';
      
      signals.slice(0, 5).forEach(signal => {
        const directionClass = signal.direction === 'LONG' ? 'long' : 'short';
        
        html += `
          <div class="signal-item ${directionClass}">
            <div class="signal-header">
              <div>
                <strong>${signal.ticker}</strong>
                <span class="badge ${directionClass}">${signal.direction}</span>
              </div>
              <div class="signal-meta">
                Confidence: ${signal.confidence}/10
              </div>
            </div>
            <div class="signal-body">
              Entry: $${signal.entry.toFixed(2)} | 
              Target: $${signal.targets.t1.toFixed(2)} | 
              Stop: $${signal.stopLoss.toFixed(2)}
            </div>
          </div>
        `;
      });
      
      container.innerHTML = html;
    }
  } catch (error) {
    console.error('Failed to load active signals:', error);
  }
}

// Load recent signals
async function loadRecentSignals() {
  const container = document.getElementById('recentSignals');
  if (!container) return;
  
  try {
    const response = await fetch('/api/signals/recent?count=5');
    const result = await response.json();
    
    if (result.success && result.data) {
      const signals = result.data;
      
      if (signals.length === 0) {
        container.innerHTML = '<div class="empty-state">No signals yet</div>';
        return;
      }
      
      let html = '';
      
      signals.forEach(signal => {
        const directionClass = signal.direction === 'LONG' ? 'long' : 'short';
        const statusBadge = signal.status === 'OPEN' ? 
          '<span class="badge open">OPEN</span>' : 
          `<span class="badge closed">${signal.result}</span>`;
        
        const pnlText = signal.pnlPercent !== null ? 
          `<span class="${signal.pnlPercent > 0 ? 'positive' : 'negative'}">
            ${signal.pnlPercent > 0 ? '+' : ''}${signal.pnlPercent.toFixed(2)}%
          </span>` : 
          '';
        
        html += `
          <div class="signal-item ${directionClass}">
            <div class="signal-header">
              <div>
                <strong>${signal.ticker}</strong>
                <span class="badge ${directionClass}">${signal.direction}</span>
                ${statusBadge}
              </div>
              <div class="signal-meta">
                ${pnlText}
              </div>
            </div>
            <div class="signal-body">
              ${signal.reasoning}
            </div>
          </div>
        `;
      });
      
      container.innerHTML = html;
    }
  } catch (error) {
    console.error('Failed to load recent signals:', error);
  }
}

// Refresh market data
async function refreshMarket() {
  await loadWatchlist();
  updateTimestamp();
}

// Format volume
function formatVolume(volume) {
  if (volume >= 1000000) {
    return (volume / 1000000).toFixed(2) + 'M';
  } else if (volume >= 1000) {
    return (volume / 1000).toFixed(2) + 'K';
  }
  return volume.toString();
}

// Export functions for use in HTML
window.loadDashboard = loadDashboard;
window.refreshMarket = refreshMarket;
window.updateTimestamp = updateTimestamp;
