// service_worker.js
// Chrome Extension Background Script for Farside Redirector
// Redirects popular domains to their privacy-focused alternatives via farside.link

let isRedirectionEnabled = true;

const DEFAULT_REDIRECT_MAP = {
  "www.reddit.com": "https://farside.link/libreddit",
  "twitter.com": "https://farside.link/nitter",
  "x.com": "https://farside.link/nitter",
  "www.youtube.com": "https://farside.link/invidious",
  "instagram.com": "https://farside.link/proxigram",
  "www.instagram.com": "https://farside.link/proxigram",
  "tiktok.com": "https://farside.link/proxitok",
  "www.tiktok.com": "https://farside.link/proxitok",
  "vm.tiktok.com": "https://farside.link/proxitok",
  "vt.tiktok.com": "https://farside.link/proxitok",
  "medium.com": "https://farside.link/scribe",
  "translate.google.com": "https://farside.link/simplytranslate",
  "imgur.com": "https://farside.link/rimgo",
  "en.wikipedia.org": "https://farside.link/wikiless",
  "www.imdb.com": "https://farside.link/libremdb",
  "quora.com": "https://farside.link/quetre",
  "stackoverflow.com": "https://farside.link/anonymousoverflow",
  "fandom.com": "https://farside.link/breezewiki",
  "www.fandom.com": "https://farside.link/breezewiki",
  "genius.com": "https://farside.link/dumb",
  "www.genius.com": "https://farside.link/dumb",
  "bandcamp.com": "https://farside.link/tent",
  "www.bandcamp.com": "https://farside.link/tent",
  "github.com": "https://farside.link/gothub",
  "www.github.com": "https://farside.link/gothub"
};

let userRedirectMap = { ...DEFAULT_REDIRECT_MAP };

// Block redirects until we've loaded saved settings (avoids redirecting with defaults when user had sites disabled).
// No added delay when redirect is on: we don't wait inside the listener; once settingsLoaded is true, redirect is immediate.
// Alternatives considered: (1) Async storage.get inside listener then redirect in callback → would cause visible flash/delay.
// (2) Synchronous storage → not available in Chrome APIs. (3) Warm-up (e.g. onStartup) → could load settings earlier so first nav is rarely missed.
let settingsLoaded = false;

function loadSettingsFromStorage() {
  chrome.storage.sync.get(["enabled", "customMap"], (res) => {
    isRedirectionEnabled = res.enabled ?? true;
    if (res.customMap) {
      userRedirectMap = { ...DEFAULT_REDIRECT_MAP, ...res.customMap };
    }
    settingsLoaded = true;
  });
}

loadSettingsFromStorage();

// Warm-up: if the worker runs at browser startup, load settings early so first navigation can redirect
chrome.runtime.onStartup.addListener(loadSettingsFromStorage);

// Listen for options updates from the options page
chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.type === "updateSettings") {
    isRedirectionEnabled = message.enabled !== false; // Default to true if not specified
    
    const updatedMap = message.updatedMap;
    if (typeof updatedMap === "object" && updatedMap !== null) {
      userRedirectMap = { ...DEFAULT_REDIRECT_MAP, ...updatedMap };
    }
    
    console.log("Settings updated:", { 
      isRedirectionEnabled, 
      domainCount: Object.keys(userRedirectMap).length,
      enabledDomains: Object.entries(userRedirectMap)
        .filter(([_, value]) => value !== "")
        .length
    });
    
    sendResponse({ status: "settings_updated" });
  }
  return true;
});

// Core redirection logic using webNavigation API for Manifest V3
chrome.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    // Only process main frame navigations (not iframes, etc)
    if (details.frameId !== 0) return;
    
    // Don't redirect until we've loaded saved settings (prevents redirect when site was disabled after cold start)
    if (!settingsLoaded) return;
    
    // Global redirect toggle check
    if (!isRedirectionEnabled) {
      console.log("Redirections globally disabled");
      return;
    }
    
    try {
      const url = new URL(details.url);
      let hostname = url.hostname;
      
      // Debug logging
      console.log("Navigation detected:", hostname, details.url);
      
      // Check for domain match
      let redirectBase = null;
      
      // Direct match check
      redirectBase = userRedirectMap[hostname];
      
      // If no match, try stripping 'www.' prefix
      if (!redirectBase && hostname.startsWith('www.')) {
        const nonWwwHostname = hostname.replace('www.', '');
        redirectBase = userRedirectMap[nonWwwHostname];
      }
      
      // If no match, try adding 'www.' prefix
      if (!redirectBase && !hostname.startsWith('www.')) {
        const wwwHostname = 'www.' + hostname;
        redirectBase = userRedirectMap[wwwHostname];
      }
      
      // Check for TikTok mobile or special domains
      if (!redirectBase && hostname.includes('tiktok')) {
        redirectBase = "https://farside.link/proxitok";
      }

      if (typeof redirectBase !== "string" || redirectBase.trim() === "") {
        console.log("No redirect found for:", hostname);
        return;
      }

      console.log("Redirecting:", hostname, "to", redirectBase);
      const redirectUrl = redirectBase + url.pathname + url.search;
      
      // Redirect the tab
      chrome.tabs.update(details.tabId, { url: redirectUrl });
    } catch (error) {
      console.error("Error in redirection logic:", error);
    }
  }
);

// Listen for storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    isRedirectionEnabled = changes.enabled.newValue;
    console.log("Global redirect setting changed:", isRedirectionEnabled);
  }
  if (changes.customMap) {
    const newMap = changes.customMap.newValue;
    userRedirectMap =
      typeof newMap === "object" && newMap !== null
        ? { ...DEFAULT_REDIRECT_MAP, ...newMap }
        : { ...DEFAULT_REDIRECT_MAP };
    console.log("Custom map updated, enabled domains:", 
      Object.entries(userRedirectMap)
        .filter(([_, value]) => value !== "" && value != null)
        .length
    );
  }
});
