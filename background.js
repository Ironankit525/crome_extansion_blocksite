let timerInterval;

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ 
    blockedSites: [],
    workModeActive: false,
    timeRemaining: 0
  });
});

// Check on startup if work mode was active
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(['workModeActive', 'endTime'], (data) => {
    if (data.workModeActive && data.endTime) {
      const remaining = Math.floor((data.endTime - Date.now()) / 1000);
      if (remaining > 0) {
        startTimer(remaining);
      } else {
        stopWorkMode();
      }
    }
  });
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startWorkMode') {
    startTimer(message.duration);
  } else if (message.action === 'stopWorkMode') {
    stopWorkMode();
  } else if (message.action === 'updateRules') {
    updateBlockingRules(message.sites);
  }
});

// Start timer
function startTimer(seconds) {
  clearInterval(timerInterval);
  
  let timeRemaining = seconds;
  
  timerInterval = setInterval(() => {
    timeRemaining--;
    
    chrome.storage.local.set({ timeRemaining });
    
    // Notify popup
    chrome.runtime.sendMessage({ 
      action: 'timerUpdate', 
      timeRemaining 
    }).catch(() => {}); // Ignore errors if popup is closed
    
    if (timeRemaining <= 0) {
      stopWorkMode();
    }
  }, 1000);
}

// Stop work mode
function stopWorkMode() {
  clearInterval(timerInterval);
  chrome.storage.local.set({ 
    workModeActive: false, 
    timeRemaining: 0 
  });
  
  chrome.runtime.sendMessage({ 
    action: 'workModeEnded' 
  }).catch(() => {});
}

// Update blocking rules
function updateBlockingRules(sites) {
  const rules = sites.map((site, index) => ({
    id: index + 1,
    priority: 1,
    action: { 
      type: 'redirect',
      redirect: { 
        extensionPath: '/blocked.html'
      }
    },
    condition: {
      urlFilter: `*://*.${site}/*`,
      resourceTypes: ['main_frame']
    }
  }));
  
  // Write rules to rules.json would require file system access
  // Instead, we'll use webRequest blocking
  chrome.storage.local.set({ blockingRules: rules });
}

// Check if URL should be blocked
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    chrome.storage.local.get(['workModeActive', 'blockedSites'], (data) => {
      if (data.workModeActive && data.blockedSites) {
        const url = new URL(tab.url);
        const hostname = url.hostname.replace(/^www\./, '');
        
        const isBlocked = data.blockedSites.some(site => 
          hostname.includes(site) || hostname === site
        );
        
        if (isBlocked) {
          chrome.tabs.update(tabId, { 
            url: chrome.runtime.getURL('blocked.html') 
          });
        }
      }
    });
  }
});