app.webnavigation = {
  "on": {
    "committed": {
      "listener": null,
      "callback": function (callback) {
        app.webnavigation.on.committed.listener = callback;
      },
      "remove": function () {
        if (chrome.webNavigation) {
          chrome.webNavigation.onCommitted.removeListener(app.webnavigation.on.committed.listener);
        }
      },
      "add": function () {
        if (chrome.webNavigation) {
          chrome.webNavigation.onCommitted.removeListener(app.webnavigation.on.committed.listener);
          chrome.webNavigation.onCommitted.addListener(app.webnavigation.on.committed.listener);
        }
      }
    }
  }
};
