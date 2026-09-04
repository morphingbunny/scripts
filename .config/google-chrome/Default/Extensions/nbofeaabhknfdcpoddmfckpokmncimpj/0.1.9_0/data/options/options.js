var background = (function () {
  let tmp = {};
  chrome.runtime.onMessage.addListener(function (request) {
    for (let id in tmp) {
      if (tmp[id] && (typeof tmp[id] === "function")) {
        if (request.path === "background-to-options") {
          if (request.method === id) {
            tmp[id](request.data);
          }
        }
      }
    }
  });
  /*  */
  return {
    "receive": function (id, callback) {
      tmp[id] = callback;
    },
    "send": function (id, data) {
      chrome.runtime.sendMessage({
        "method": id, 
        "data": data,
        "path": "options-to-background"
      }, function () {
        return chrome.runtime.lastError;
      });
    }
  }
})();

var config = {
  "reload": function () {
    document.location.reload();
  },
  "store": function (n) {
    const name = document.querySelector("input[data-pref='options.timezone.name']");
    const offset = document.querySelector("input[data-pref='options.timezone.value']");
    const select = document.querySelector("select[data-pref='options.timezone.index']");
    const target = select[select.selectedIndex];
    /*  */
    name.value = target.value;
    offset.value = n ? n + Number(offset.value) : -1 * Number(target.dataset.value);
    /*  */
    background.send("changed", {"pref": "options.timezone.name", "value": name.value});
    background.send("changed", {"pref": "options.timezone.value", "value": offset.value});
    background.send("changed", {"pref": "options.timezone.index", "value": select.selectedIndex});
  },
  "set": function (o) {
    if (window[o.pref]) {
      window[o.pref].value = o.value;
    }
  },
  "load": function () {
    const plus = document.querySelector("#plus");
    const test = document.querySelector("#test");
    const minus = document.querySelector("#minus");
    const support = document.querySelector("#support");
    const donation = document.querySelector("#donation");
    const select = document.querySelector("select[data-pref='options.timezone.index']");
    /*  */
    plus.addEventListener("click", function () {config.store(30)});
    minus.addEventListener("click", function () {config.store(-30)});
    select.addEventListener("change", function () {config.store(0)});
    test.addEventListener("click", function () {background.send("test")});
    support.addEventListener("click", function () {background.send("support")});
    donation.addEventListener("click", function () {background.send("donation")});
    /*  */
    background.send("load");
    window.removeEventListener("load", config.load, false);
  },
  "render": function (e) {
    if (e) {
      if (e.list) {
        const select = document.querySelector("select[data-pref='options.timezone.index']");
        select.textContent = '';
        /*  */
        for (let i = 0; i < e.list.length; i++) {
          const item = e.list[i];
          const option = document.createElement("option");
          /*  */
          option.textContent = item.name;
          option.setAttribute("value", item.name);
          option.setAttribute("data-value", item.offset);
          select.appendChild(option);
        }
      }
    }
    /*  */
    const prefs = [...document.querySelectorAll("*[data-pref]")];
    /*  */
    prefs.forEach(function (elem) {
      const pref = elem.getAttribute("data-pref");
      window[pref] = config.connect(elem, pref);
    });
  },
  "connect": function (elem) {
    let att = "value";
    let pref = elem.getAttribute("data-pref");
    if (elem) {
      if (elem.type === "checkbox") att = "checked";
      if (elem.localName === "textarea") att = "value";
      if (elem.localName === "span") att = "textContent";
      if (elem.localName === "select") att = "selectedIndex";
      /*  */
      background.send("get", pref);
      elem.addEventListener("change", function () {
        background.send("changed", {
          "pref": pref,
          "value": this[att]
        });
      });
    }
    /*  */
    return {
      get value () {
        return elem[att];
      },
      set value (val) {
        if (elem.type === "file") return;
        elem[att] = val;
      }
    }
  }
};

background.receive("set", config.set);
background.receive("reload", config.reload);
background.receive("storage", config.render);

window.addEventListener("load", config.load, false);
