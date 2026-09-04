var core = {
  "start": function () {
    core.load();
  },
  "install": function () {
    core.load();
  },
  "load": function () {
    app.contextmenu.create({
      "contexts": ["action"],
      "title": "What is my Timezone?", 
      "id": "change-timezone-test-page"
    }, app.error);
  },
  "find": {
    "timezone": {
      "index": function (name) {
        try {
          const item = config.default.list.find(e => e.name === name);
          return item ? item.index : null;
        } catch (e) {
          return null;
        }
      },
      "offset": function (e) {
        try {
          const date = new Date();
          const parts = date.toLocaleString("en-US", {
            "timeZone": e,
            "timeZoneName": "longOffset"
          });
          /*  */
          const match = parts.match(/GMT(?<sign>[+-])(?<hh>\d{2}):(?<mm>\d{2})/);
          if (!match || !match.groups) return 0;
          /*  */
          const {sign, hh, mm} = match.groups;
          const offset = parseInt(hh, 10) * 60 + parseInt(mm, 10);
          return sign === '+' ? offset : -offset;
        } catch (e) {
          return 0;
        }
      }
    }
  },
  "action": {
    "storage": function (changes, namespace) {
      /*  */
    },
    "load": function () {
      app.button.icon(null, config.addon.state);
      app.button.title(null, "Change Timezone: " + config.addon.state);
      /*  */
      app.webnavigation.on.committed.add();
    },
    "button": function () {
      config.addon.state = config.addon.state === "ON" ? "OFF" : "ON";
      /*  */
      app.button.icon(null, config.addon.state);
      app.button.title(null, "Change Timezone: " + config.addon.state);
    },
    "contextmenu": function (e) {
      if (e) {
        if (e.menuItemId === "change-timezone-test-page") {
          app.tab.open(config.test.page);
        }
      }
    },
    "options": {
      "load": function () {
        app.options.send("storage", {
          "list": config.default.list
        });
      },
      "get": function (pref) {
        app.options.send("set", {
          "pref": pref,
          "value": config.get(pref)
        });
      },
      "set": function (o) {
        config.set(o.pref, o.value);
        app.options.send("set", {
          "pref": o.pref,
          "value": config.get(o.pref)
        });
      }
    },
    "inject": function (e) {
      if (config.addon.state === "ON") {
        const code = config.options;
        const arg = JSON.stringify(code);
        /*  */
        app.tab.inject.js({
          "args": [arg],
          "world": "MAIN",
          "injectImmediately": true,
          "target": {
            "tabId": e.tabId,
            "frameIds": [e.frameId]
          },
          "func": function (q) {
            window.timeZoneStorage = q;
          }
        }, function () {
          app.tab.inject.js({
            "world": "MAIN",
            "injectImmediately": true,
            "target": {
              "tabId": e.tabId,
              "frameIds": [e.frameId]
            },
            "files": [
              "/data/content_script/page_context/inject.js"
            ]
          });
        });
      }
    },
    "message": function (request) {
      if (request) {
        if (request.method === "configure-timezone") {
          if (request.data) {
            const name = request.data.name;
            const index = core.find.timezone.index(name);
            const offset = core.find.timezone.offset(name);
            /*  */
            config.options.timezone.name = name;
            config.options.timezone.value = offset;
            if (index) config.options.timezone.index = index;
            /*  */
            setTimeout(function () {
              app.options.send("reload");
            }, 300);
          }
        }
      }
    }
  }
};

app.storage.load(core.action.load);

app.button.on.clicked(core.action.button);
app.contextmenu.on.clicked(core.action.contextmenu);
app.webnavigation.on.committed.callback(core.action.inject);

app.options.receive("get", core.action.options.get);
app.options.receive("load", core.action.options.load);
app.options.receive("changed", core.action.options.set);
app.options.receive("test", function () {app.tab.open(config.test.page)});
app.options.receive("support", function () {app.tab.open(app.homepage())});
app.options.receive("donation", function () {app.tab.open(app.homepage() + "?reason=support")});

app.on.startup(core.start);
app.on.installed(core.install);
app.on.storage(core.action.storage);
app.on.message(core.action.message);
