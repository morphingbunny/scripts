//googleclient/chrome/apps/user_agent_spoofer/offscreen.js
// ManifestV3 can only access localStorage from an Offscreen Document. This
// script is loaded by local_storage.html to perform a one-time migration from
// localStorage to chrome.storage.local on startup.

// TODO(b/486867886): Remove this file and offscreen.html, since ~everyone is on
// MV3 now.

/**
 * Returns localStorage values saved by the ManifestV2 extension, as an Object.
 * @return {null|{
 *   use_per_tab: boolean,
 *   permanent_override: boolean,
 *   use_sync: boolean,
 * }}
 */
function getLocalStorageValues() {
  const keys = ['use_per_tab', 'permanent_override', 'use_sync'];
  if (!keys.some(k => k in localStorage)) {
    // Already migrated, nothing to do.
    return null;
  }
  return Object.fromEntries(keys.flatMap(
      k => k in localStorage ? [[k, localStorage[k] === 'true']] : []));
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== 'offscreen_document') {
    return;
  }
  switch (msg.action) {
    case 'getLocalStorageValues':
      sendResponse(getLocalStorageValues());
      break;

    case 'getAllLocalStorageValuesForTesting':
      sendResponse({...localStorage});
      break;

    case 'setLocalStorageValuesForTesting':
      localStorage.clear();
      for (const [k, v] of Object.entries(msg.localStorage)) {
        localStorage[k] = v;
      }
      sendResponse();
      break;

    default:
      console.error('Unrecognized message', msg);
      break;
  }
});

