(() => {
  // lib/environment/utils/api.js
  function apiToPromise(func) {
    return (...args) => new Promise((resolve, reject) => {
      func(...args, (...results) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(results.length > 1 ? results : results[0]);
        }
      });
    });
  }

  // lib/environment/utils/messaging.js
  var MessageHandlerError = class extends Error {
    constructor(message, stack) {
      super();
      this.message = message;
      this.stack = stack;
    }
  };
  function createMessageHandler(_sendMessage2, errorOnUnrecognizedTypes = false) {
    const listeners = /* @__PURE__ */ new Map();
    function addListener2(type, callback) {
      if (listeners.has(type)) {
        throw new Error(`Listener for "${type}" already exists.`);
      }
      listeners.set(type, callback);
    }
    async function sendMessage2(type, data, context) {
      const { data: newData, error } = await _sendMessage2({ type, data }, context);
      if (error) {
        throw new MessageHandlerError(error.message, `${error.stack}
    at target's "${type}" handler`);
      } else {
        return newData;
      }
    }
    function _handleMessage2({ type, data }, sendResponse, context) {
      const listener = listeners.get(type);
      if (!listener) {
        if (errorOnUnrecognizedTypes) {
          sendResponse({ error: { message: `Unrecognised message type: ${type}`, stack: "" } });
        }
        return false;
      }
      let response;
      try {
        response = listener(data, context);
      } catch (e) {
        console.error(e);
        sendResponse({ error: { message: e.message, stack: e.stack } });
        return false;
      }
      if (response instanceof Promise) {
        response.then(
          (data2) => sendResponse({ data: data2 }),
          (e) => {
            console.error(e);
            sendResponse({ error: { message: e.message, stack: e.stack } });
          }
        );
        return true;
      } else {
        sendResponse({ data: response });
        return false;
      }
    }
    return {
      _handleMessage: _handleMessage2,
      sendMessage: sendMessage2,
      addListener: addListener2
    };
  }

  // lib/environment/background/messaging.js
  var _sendMessage = apiToPromise(chrome.tabs.sendMessage);
  var {
    _handleMessage,
    sendMessage,
    addListener
  } = createMessageHandler((obj, tabId) => _sendMessage(tabId, obj));
  chrome.runtime.onMessage.addListener((obj, sender, sendResponse) => _handleMessage(obj, sendResponse, sender));

  // lib/environment/background/permissions.js
  addListener("permissions", handleMessage);
  function handleMessage({ operation, permissions, origins }) {
    switch (operation) {
      case "contains":
        return apiToPromise(chrome.permissions.contains)({ permissions, origins });
      case "request":
        return apiToPromise(chrome.permissions.request)({ permissions, origins }).catch(() => makePromptWindow({ permissions, origins }));
      default:
        throw new Error(`Invalid permissions operation: ${operation}`);
    }
  }
  async function makePromptWindow({ permissions, origins }) {
    const url2 = new URL("prompt.html", location.origin);
    url2.searchParams.set("permissions", JSON.stringify(permissions));
    url2.searchParams.set("origins", JSON.stringify(origins));
    const width = 630;
    const height = 255;
    const { width: screenWidth, height: screenHeight } = await chrome.windows.getCurrent() || { width: 1920, height: 1080 };
    const left = Math.floor(screenWidth / 2 - width / 2);
    const top = Math.floor(screenHeight / 2 - height / 2);
    const { tabs: [{ id }] } = await apiToPromise(chrome.windows.create)({ url: url2.href, type: "popup", width, height, left, top });
    return new Promise((resolve) => {
      function updateListener(tabId, updates) {
        if (tabId !== id) return;
        const url3 = updates.url && new URL(updates.url);
        if (url3 && url3.searchParams.has("result")) {
          stopListening();
          const result = url3.searchParams.get("result");
          if (!result) return;
          resolve(JSON.parse(result));
          apiToPromise(chrome.tabs.remove)(id);
        }
      }
      function removeListener(tabId) {
        if (tabId !== id) return;
        stopListening();
        resolve(false);
      }
      function stopListening() {
        chrome.tabs.onUpdated.removeListener(updateListener);
        chrome.tabs.onRemoved.removeListener(removeListener);
      }
      chrome.tabs.onUpdated.addListener(updateListener);
      chrome.tabs.onRemoved.addListener(removeListener);
    });
  }

  // lib/environment/background/permissions/prompt.entry.js
  var url = new URL(location.href);
  var button = document.body.querySelector("#request");
  button.addEventListener("click", async () => {
    try {
      const result = await handleMessage({
        operation: "request",
        permissions: JSON.parse(url.searchParams.get("permissions") || "[]"),
        origins: JSON.parse(url.searchParams.get("origins") || "[]")
      });
      url.searchParams.set("result", JSON.stringify(result));
      location.href = url.href;
    } catch (e) {
      alert(`An error occured: ${e.message}`);
    }
  });
  button.focus();
})();
//# sourceMappingURL=prompt.entry.js.map
