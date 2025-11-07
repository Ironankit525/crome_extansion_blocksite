let timerInterval;

// Load saved data
chrome.storage.local.get(['blockedSites', 'workModeActive', 'timeRemaining'], (data) => {
  const sites = data.blockedSites || [];
  displaySites(sites);
  
  if (data.workModeActive) {
    document.getElementById('modeStatus').textContent = 'ACTIVE';
    document.getElementById('modeStatus').classList.add('active');
    if (data.timeRemaining) {
      updateTimerDisplay(data.timeRemaining);
    }
  }
});

// Add website
document.getElementById('addBtn').addEventListener('click', () => {
  const input = document.getElementById('websiteInput');
  let website = input.value.trim().toLowerCase();
  
  if (!website) return;
  
  // Clean up the URL
  website = website.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  
  chrome.storage.local.get(['blockedSites'], (data) => {
    const sites = data.blockedSites || [];
    if (!sites.includes(website)) {
      sites.push(website);
      chrome.storage.local.set({ blockedSites: sites }, () => {
        displaySites(sites);
        input.value = '';
        updateBlockingRules(sites);
      });
    }
  });
});

// Display blocked sites
function displaySites(sites) {
  const list = document.getElementById('sitesList');
  if (sites.length === 0) {
    list.innerHTML = '<div style="color: #666; padding: 10px; text-align: center;">No sites blocked</div>';
    return;
  }
  
  list.innerHTML = sites.map(site => `
    <div class="site-item">
      <span class="site-name">${site}</span>
      <button class="remove-btn" data-site="${site}">REMOVE</button>
    </div>
  `).join('');
  
  // Add remove listeners
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const site = e.target.getAttribute('data-site');
      removeSite(site);
    });
  });
}

// Remove site
function removeSite(site) {
  chrome.storage.local.get(['blockedSites'], (data) => {
    const sites = data.blockedSites || [];
    const index = sites.indexOf(site);
    if (index > -1) {
      sites.splice(index, 1);
      chrome.storage.local.set({ blockedSites: sites }, () => {
        displaySites(sites);
        updateBlockingRules(sites);
      });
    }
  });
}

// Update blocking rules
function updateBlockingRules(sites) {
  chrome.runtime.sendMessage({ 
    action: 'updateRules', 
    sites: sites 
  });
}

// Start timer
document.getElementById('startBtn').addEventListener('click', () => {
  const minutes = parseInt(document.getElementById('minutesInput').value) || 25;
  const seconds = minutes * 60;
  
  chrome.storage.local.set({ 
    workModeActive: true, 
    timeRemaining: seconds,
    endTime: Date.now() + (seconds * 1000)
  }, () => {
    document.getElementById('modeStatus').textContent = 'ACTIVE';
    document.getElementById('modeStatus').classList.add('active');
    chrome.runtime.sendMessage({ action: 'startWorkMode', duration: seconds });
  });
});

// Stop timer
document.getElementById('stopBtn').addEventListener('click', () => {
  chrome.storage.local.set({ 
    workModeActive: false, 
    timeRemaining: 0 
  }, () => {
    document.getElementById('modeStatus').textContent = 'INACTIVE';
    document.getElementById('modeStatus').classList.remove('active');
    document.getElementById('timerDisplay').textContent = '00:00';
    chrome.runtime.sendMessage({ action: 'stopWorkMode' });
  });
});

// Update timer display
function updateTimerDisplay(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  document.getElementById('timerDisplay').textContent = 
    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Listen for timer updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'timerUpdate') {
    updateTimerDisplay(message.timeRemaining);
  } else if (message.action === 'workModeEnded') {
    document.getElementById('modeStatus').textContent = 'INACTIVE';
    document.getElementById('modeStatus').classList.remove('active');
    document.getElementById('timerDisplay').textContent = '00:00';
  }
});