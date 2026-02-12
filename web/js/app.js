// Klaw Terminal - Frontend JavaScript

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
        
        const changeClass = data.change >= 0 ? 'positive' : 'negative';
        const changeSymbol = data.change >= 0 ? '+' : '';
        const volumeIndicator = data.volumeRatio >= 1.5 ? ' 📊' : '';
        
        html += `
          <div class="watchlist-item">
            <div class="ticker-info">
              <h3>${ticker}</h3>
              <div class="ticker-volume">
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
