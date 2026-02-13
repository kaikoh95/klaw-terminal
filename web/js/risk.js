// Risk Management Dashboard JavaScript

// Load settings from localStorage
let accountSize = parseFloat(localStorage.getItem('accountSize') || '10000');
let defaultRisk = parseFloat(localStorage.getItem('defaultRisk') || '1');
let trackedPositions = JSON.parse(localStorage.getItem('trackedPositions') || '[]');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  document.getElementById('accountSize').value = accountSize;
  document.getElementById('defaultRisk').value = defaultRisk;
  document.getElementById('riskPercent').value = defaultRisk;
  
  // Render tracked positions
  renderPositions();
  updatePortfolioHeat();
  
  // Event listeners
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('calculatePosition').addEventListener('click', calculatePosition);
  document.getElementById('calculateKelly').addEventListener('click', calculateKelly);
  document.getElementById('addPosition').addEventListener('click', addPosition);
  document.getElementById('loadCorrelation').addEventListener('click', loadCorrelation);
});

// Save account settings
function saveSettings() {
  accountSize = parseFloat(document.getElementById('accountSize').value);
  defaultRisk = parseFloat(document.getElementById('defaultRisk').value);
  
  localStorage.setItem('accountSize', accountSize);
  localStorage.setItem('defaultRisk', defaultRisk);
  
  document.getElementById('riskPercent').value = defaultRisk;
  
  showNotification('✅ Settings saved!', 'success');
  updatePortfolioHeat();
}

// Calculate position size
async function calculatePosition() {
  const entryPrice = parseFloat(document.getElementById('entryPrice').value);
  const stopLoss = parseFloat(document.getElementById('stopLoss').value);
  const riskPercent = parseFloat(document.getElementById('riskPercent').value);
  
  if (!entryPrice || !stopLoss || !riskPercent) {
    showNotification('❌ Please fill in all fields', 'error');
    return;
  }
  
  if (entryPrice === stopLoss) {
    showNotification('❌ Entry and stop loss cannot be equal', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/risk/position-size', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountSize, riskPercent, entryPrice, stopLoss })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      showNotification('❌ ' + result.error, 'error');
      return;
    }
    
    const data = result.data;
    
    // Display results
    document.getElementById('resultShares').textContent = data.shares.toLocaleString();
    document.getElementById('resultValue').textContent = '$' + data.positionValue.toFixed(2);
    document.getElementById('resultPercent').textContent = data.positionPercent.toFixed(2) + '%';
    document.getElementById('resultRisk').textContent = '$' + data.riskAmount.toFixed(2);
    document.getElementById('resultRiskPerShare').textContent = '$' + data.riskPerShare.toFixed(2);
    document.getElementById('resultMaxLoss').textContent = '$' + data.maxLoss.toFixed(2);
    
    document.getElementById('positionResult').style.display = 'block';
    
    // Color code based on validity
    const resultBox = document.getElementById('positionResult');
    if (!data.valid) {
      resultBox.style.borderColor = '#e74c3c';
      showNotification('⚠️ Position size exceeds account capacity', 'warning');
    } else if (data.positionPercent > 50) {
      resultBox.style.borderColor = '#f39c12';
      showNotification('⚠️ Large position relative to account size', 'warning');
    } else {
      resultBox.style.borderColor = '#2ecc71';
    }
    
  } catch (error) {
    console.error('Position calculation error:', error);
    showNotification('❌ Calculation failed', 'error');
  }
}

// Calculate Kelly Criterion
async function calculateKelly() {
  const winRate = parseFloat(document.getElementById('winRate').value);
  const avgWin = parseFloat(document.getElementById('avgWin').value);
  const avgLoss = parseFloat(document.getElementById('avgLoss').value);
  
  if (!winRate || !avgWin || !avgLoss) {
    showNotification('❌ Please fill in all fields', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/risk/kelly', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winRate, avgWin, avgLoss })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      showNotification('❌ ' + result.error, 'error');
      return;
    }
    
    const data = result.data;
    
    // Display results
    document.getElementById('fullKelly').textContent = data.fullKelly.toFixed(2) + '%';
    document.getElementById('halfKelly').textContent = data.halfKelly.toFixed(2) + '%';
    document.getElementById('quarterKelly').textContent = data.quarterKelly.toFixed(2) + '%';
    document.getElementById('payoffRatio').textContent = data.payoffRatio.toFixed(2) + ':1';
    
    document.getElementById('kellyRecommendation').textContent = data.recommendation;
    document.getElementById('kellyRecommendation').style.color = data.valid ? '#2ecc71' : '#e74c3c';
    
    document.getElementById('kellyResult').style.display = 'block';
    
  } catch (error) {
    console.error('Kelly calculation error:', error);
    showNotification('❌ Calculation failed', 'error');
  }
}

// Add position to tracking
function addPosition() {
  const ticker = document.getElementById('newTicker').value.toUpperCase().trim();
  const shares = parseInt(document.getElementById('newShares').value);
  const entry = parseFloat(document.getElementById('newEntry').value);
  const stopLoss = parseFloat(document.getElementById('newStop').value);
  
  if (!ticker || !shares || !entry || !stopLoss) {
    showNotification('❌ Please fill in all position fields', 'error');
    return;
  }
  
  const risk = shares * Math.abs(entry - stopLoss);
  
  trackedPositions.push({
    ticker,
    shares,
    entry,
    stopLoss,
    risk
  });
  
  localStorage.setItem('trackedPositions', JSON.stringify(trackedPositions));
  
  // Clear inputs
  document.getElementById('newTicker').value = '';
  document.getElementById('newShares').value = '';
  document.getElementById('newEntry').value = '';
  document.getElementById('newStop').value = '';
  
  renderPositions();
  updatePortfolioHeat();
  showNotification('✅ Position added', 'success');
}

// Remove position from tracking
function removePosition(index) {
  trackedPositions.splice(index, 1);
  localStorage.setItem('trackedPositions', JSON.stringify(trackedPositions));
  renderPositions();
  updatePortfolioHeat();
  showNotification('✅ Position removed', 'success');
}

// Render tracked positions
function renderPositions() {
  const container = document.getElementById('positionsList');
  
  if (trackedPositions.length === 0) {
    container.innerHTML = '<p class="info-text">No positions tracked. Add a position above to start tracking portfolio heat.</p>';
    return;
  }
  
  let html = '<table class="positions-table"><thead><tr><th>Ticker</th><th>Shares</th><th>Entry</th><th>Stop</th><th>Risk ($)</th><th>Risk %</th><th>Action</th></tr></thead><tbody>';
  
  trackedPositions.forEach((pos, index) => {
    const riskPercent = (pos.risk / accountSize * 100).toFixed(2);
    html += `
      <tr>
        <td><strong>${pos.ticker}</strong></td>
        <td>${pos.shares.toLocaleString()}</td>
        <td>$${pos.entry.toFixed(2)}</td>
        <td>$${pos.stopLoss.toFixed(2)}</td>
        <td>$${pos.risk.toFixed(2)}</td>
        <td>${riskPercent}%</td>
        <td><button class="btn-danger btn-small" onclick="removePosition(${index})">Remove</button></td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

// Update portfolio heat display
async function updatePortfolioHeat() {
  if (trackedPositions.length === 0) {
    document.getElementById('totalRisk').textContent = '$0.00';
    document.getElementById('totalRiskPercent').textContent = '0.00%';
    document.getElementById('positionCount').textContent = '0';
    document.getElementById('heatStatus').textContent = 'SAFE';
    document.getElementById('heatStatus').style.color = '#2ecc71';
    document.getElementById('heatRecommendation').textContent = 'No active positions tracked';
    return;
  }
  
  try {
    const response = await fetch('/api/risk/portfolio-heat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions: trackedPositions, accountSize })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      console.error('Portfolio heat error:', result.error);
      return;
    }
    
    const data = result.data;
    
    document.getElementById('totalRisk').textContent = '$' + data.totalRisk.toFixed(2);
    document.getElementById('totalRiskPercent').textContent = data.totalRiskPercent.toFixed(2) + '%';
    document.getElementById('positionCount').textContent = data.positionCount;
    document.getElementById('heatStatus').textContent = data.status;
    document.getElementById('heatRecommendation').textContent = data.recommendation;
    
    // Color code status
    const statusColors = {
      'SAFE': '#2ecc71',
      'HEALTHY': '#27ae60',
      'ELEVATED': '#f39c12',
      'WARNING': '#e67e22',
      'DANGER': '#e74c3c'
    };
    
    document.getElementById('heatStatus').style.color = statusColors[data.status] || '#95a5a6';
    
  } catch (error) {
    console.error('Portfolio heat error:', error);
  }
}

// Load correlation matrix
async function loadCorrelation() {
  const button = document.getElementById('loadCorrelation');
  button.textContent = 'Loading...';
  button.disabled = true;
  
  try {
    const response = await fetch('/api/risk/correlation');
    const result = await response.json();
    
    if (!result.success) {
      showNotification('❌ ' + result.error, 'error');
      return;
    }
    
    const data = result.data;
    renderCorrelationMatrix(data);
    renderHighCorrelations(data.highCorrelations);
    
    showNotification('✅ Correlation matrix loaded', 'success');
    
  } catch (error) {
    console.error('Correlation error:', error);
    showNotification('❌ Failed to load correlation data', 'error');
  } finally {
    button.textContent = 'Reload Correlation Matrix';
    button.disabled = false;
  }
}

// Render correlation matrix
function renderCorrelationMatrix(data) {
  const container = document.getElementById('correlationMatrix');
  const tickers = data.tickers;
  const matrix = data.matrix;
  
  if (tickers.length === 0) {
    container.innerHTML = '<p class="info-text">No market data available</p>';
    return;
  }
  
  let html = '<table class="correlation-table"><thead><tr><th></th>';
  tickers.forEach(ticker => {
    html += `<th>${ticker}</th>`;
  });
  html += '</tr></thead><tbody>';
  
  tickers.forEach(ticker1 => {
    html += `<tr><th>${ticker1}</th>`;
    tickers.forEach(ticker2 => {
      const corr = matrix[ticker1]?.[ticker2] || 0;
      const color = getCorrelationColor(corr);
      const displayValue = ticker1 === ticker2 ? '1.00' : corr.toFixed(2);
      html += `<td style="background-color: ${color}; color: ${Math.abs(corr) > 0.5 ? 'white' : 'inherit'}">${displayValue}</td>`;
    });
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

// Get correlation color (heatmap)
function getCorrelationColor(corr) {
  if (corr >= 0.9) return '#d32f2f';
  if (corr >= 0.7) return '#f57c00';
  if (corr >= 0.5) return '#fbc02d';
  if (corr >= 0.3) return '#c8e6c9';
  if (corr >= -0.3) return '#e8f5e9';
  if (corr >= -0.5) return '#bbdefb';
  if (corr >= -0.7) return '#64b5f6';
  return '#1976d2';
}

// Render high correlations warning
function renderHighCorrelations(highCorrs) {
  const container = document.getElementById('highCorrelations');
  
  if (!highCorrs || highCorrs.length === 0) {
    container.innerHTML = '<p class="info-text" style="color: #2ecc71;">✅ No high correlations detected. Portfolio is well diversified.</p>';
    return;
  }
  
  let html = '<div class="warning-box"><h3>⚠️ High Correlation Warnings</h3><ul>';
  
  highCorrs.forEach(corr => {
    const icon = corr.type === 'positive' ? '📈' : '📉';
    html += `<li>${icon} <strong>${corr.ticker1}</strong> & <strong>${corr.ticker2}</strong>: ${(corr.correlation * 100).toFixed(0)}% correlation (${corr.strength.replace('_', ' ')})</li>`;
  });
  
  html += '</ul><p>Holding highly correlated positions increases concentration risk. Consider reducing exposure or diversifying.</p></div>';
  container.innerHTML = html;
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Make removePosition available globally
window.removePosition = removePosition;
