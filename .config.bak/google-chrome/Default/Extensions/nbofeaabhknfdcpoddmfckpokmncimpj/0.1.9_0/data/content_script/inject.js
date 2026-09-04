// receive configuration (timezone) from https://webbrowsertools.com/timezone/

window.addEventListener("message", function (e) {
  if (e) {
    if (e.data) {
      if (e.data.method === "configure-timezone") {
        if (e.data.timezone) {
          const timezone = e.data.timezone.split(',');
          /*  */
          if (timezone && timezone.length) {
            const name = timezone[0].indexOf('/') !== -1 ? timezone[0].trim() : '';
            if (name) {
              chrome.runtime.sendMessage({
                "method": e.data.method,
                "data": {
                  "name": name
                },
              }, function () {
                return chrome.runtime.lastError;
              });
              /*  */
              window.setTimeout(function () {
                window.top.postMessage({
                  "method": "configuration-accepted"
                }, '*');
              }, 750);
            }
          }
        }
      }
    }
  }
});
