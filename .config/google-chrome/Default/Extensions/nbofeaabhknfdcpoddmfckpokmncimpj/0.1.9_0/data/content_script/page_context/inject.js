{
  const OriginalDate = Date;
  const options = JSON.parse(timeZoneStorage);
  const originalToString = Function.prototype.toString;
  const getTimezoneOffset = Date.prototype.getTimezoneOffset;
  //
  const processedNames = [
    "_date",
    "_offset",
    "getTime",
    "setTime",
    "getTimezoneOffset",
    //
    "toJSON",
    "valueOf",
    "constructor",
    //
    "toString",
    "toGMTString",
    "toISOString",
    //
    "getUTCDay",
    "getUTCDate",
    "getUTCMonth",
    "getUTCHours",
    "getUTCMinutes",
    "getUTCSeconds",
    "getUTCFullYear",
    "getUTCMilliseconds",
    //
    "toTimeString",
    "toLocaleString",
    "toLocaleTimeString",
    "toLocaleDateString"
  ];
  //
  const propertyNames = Object.getOwnPropertyNames(Date.prototype).filter(function (item) {
    return processedNames.indexOf(item) === -1;
  });
  //
  const convertToGMT = function (n) {
    const format = function (v) {return (v < 10 ? '0' : '') + v};
    return (n <= 0 ? '+' : '-') + format(Math.abs(n) / 60 | 0) + format(Math.abs(n) % 60);
  };
  //
  const maskProxy = function (fn, original) {
    try {
      Object.defineProperty(fn, "toString", {
        "configurable": true,
        "value": function () {
          return originalToString.call(original);
        }
      });
    } catch (e) {}
  };
  //
  Object.defineProperty(Date.prototype, "_offset", {
    "configurable": true,
    get() {
      return getTimezoneOffset.call(this);
    }
  });
  //
  Object.defineProperty(Date.prototype, "_date", {
    "configurable": true,
    get() {
      const base = this._newdate !== undefined ? this._newdate : new OriginalDate(this.getTime());
      const diff = (this._offset - options.timezone.value) * 60 * 1000;
      return new OriginalDate(base.getTime() + diff);
    }
  });
  //
  Date.prototype.getTimezoneOffset = new Proxy(Date.prototype.getTimezoneOffset, {
    apply(target, self, args) {
      return isNaN(self) ? Reflect.apply(target, self, args) : options.timezone.value;
    }
  });
  //
  maskProxy(Date.prototype.getTimezoneOffset, getTimezoneOffset);
  //
  Date.now = new Proxy(Date.now, {
    apply(target, self, args) {
      return Reflect.apply(target, self, args);
    }
  });
  //
  maskProxy(Date.now, OriginalDate.now);
  //
  Date.prototype.toString = new Proxy(Date.prototype.toString, {
    apply(target, self, args) {
      return isNaN(self) ? Reflect.apply(target, self, args) : Reflect.apply(target, self._date, args);
    }
  });
  //
  Date.prototype.toLocaleString = new Proxy(Date.prototype.toLocaleString, {
    apply(target, self, args) {
      args[1] = args[1] !== undefined ? args[1] : {};
      args[1].timeZone = options.timezone.name;
      return Reflect.apply(target, self, args);
    }
  });
  //
  Date.prototype.toLocaleDateString = new Proxy(Date.prototype.toLocaleDateString, {
    apply(target, self, args) {
      args[1] = args[1] !== undefined ? args[1] : {};
      args[1].timeZone = options.timezone.name;
      return Reflect.apply(target, self, args);
    }
  });
  //
  Date.prototype.toLocaleTimeString = new Proxy(Date.prototype.toLocaleTimeString, {
    apply(target, self, args) {
      args[1] = args[1] !== undefined ? args[1] : {};
      args[1].timeZone = options.timezone.name;
      return Reflect.apply(target, self, args);
    }
  });
  //
  Date.prototype.toTimeString = new Proxy(Date.prototype.toTimeString, {
    apply(target, self, args) {
      const result = Reflect.apply(target, self._date, args);
      //
      const replace_1 = convertToGMT(self._offset);
      const replace_2 = convertToGMT(options.timezone.value);
      const replace_3 = "(" + options.timezone.name.replace(/\//g, " ") + " Standard Time)";
      return isNaN(self) ? Reflect.apply(target, self, args) : result.replace(replace_1, replace_2).replace(/\(.*\)/, replace_3);
    }
  });
  //
  propertyNames.forEach(function (name) {
    if (["setHours", "setMinutes", "setMonth", "setDate", "setYear", "setFullYear"].indexOf(name) !== -1) {
      Date.prototype[name] = new Proxy(Date.prototype[name], {
        apply(target, self, args) {
          if (isNaN(self)) {
            return Reflect.apply(target, self, args);
          } else {
            const adjusted = self._date.getTime();
            const current = Reflect.apply(target, self._date, args);
            const result = self.setTime(self.getTime() + current - adjusted);
            return result;
          }
        }
      });
    } else {
      Date.prototype[name] = new Proxy(Date.prototype[name], {
        apply(target, self, args) {
          return isNaN(self) ? Reflect.apply(target, self, args) : Reflect.apply(target, self._date, args);
        }
      });
    }
  });
  //
  Intl.DateTimeFormat.prototype.resolvedOptions = new Proxy(Intl.DateTimeFormat.prototype.resolvedOptions, {
    apply(target, self, args) {
      const result = Reflect.apply(target, self, args);
      result.timeZone = options.timezone.name;
      return result;
    }
  });
  //
  Intl.DateTimeFormat = new Proxy(Intl.DateTimeFormat, {
    apply(target, self, args) {
      args[1] = args[1] !== undefined ? args[1] : {};
      args[1].timeZone = options.timezone.name;
      return Reflect.apply(target, self, args);
    },
    construct(target, args, newTarget) {
      args[1] = args[1] !== undefined ? args[1] : {};
      args[1].timeZone = options.timezone.name;
      return Reflect.construct(target, args, newTarget);
    }
  });
  //
  if (Intl.supportedValuesOf) {
    Intl.supportedValuesOf = new Proxy(Intl.supportedValuesOf, {
      apply(target, self, args) {
        const result = Reflect.apply(target, self, args);
        return result;
      }
    });
  }
  //
  if (globalThis.Temporal?.Now?.timeZoneId) {
    try {
      Temporal.Now.timeZoneId = function () {
        return options.timezone.name;
      };
    } catch (e) {}
  }
  //
  if (performance?.timeOrigin) {
    try {
      Object.defineProperty(performance, "timeOrigin", {
        get() {
          return Reflect.get(performance, "timeOrigin");
        }
      });
    } catch (e) {}
  }
  //
  Date = new Proxy(OriginalDate, {
    apply(target, self, args) {
      return Reflect.apply(target, self, args);
    },
    construct(target, args, newTarget) {
      const instance = Reflect.construct(target, args, newTarget);
      return instance;
    }
  });
  //
  maskProxy(Date, OriginalDate);
}

// Extra Protection Methods

{
  const options = JSON.parse(timeZoneStorage);
  //
  const markNative = function (fn, source) {
    try {
      Object.defineProperty(fn, "__native", {
        "configurable": true,
        "value": source || "function () { [native code] }"
      });
    } catch (e) {}
  };
  //
  if (options.extra.nativeFunctionIntegrity) {
    try {
      const original = Function.prototype.toString;
      Function.prototype.toString = new Proxy(original, {
        apply(target, self, args) {
          if (self && self.__native) {
            return self.__native;
          }
          //
          return Reflect.apply(target, self, args);
        }
      });
    } catch (e) {}
  }
  //
  if (options.extra.dateParsingStealth) {
    try {
      const original = Date.parse;
      Date.parse = new Proxy(original, {
        apply(target, self, args) {
          return Reflect.apply(target, self, args);
        }
      });
      //
      markNative(Date.parse, original.toString());
    } catch (e) {}
  }
  //
  if (options.extra.stealthStackTrace) {
    try {
      const original = Error.prepareStackTrace;
      Error.prepareStackTrace = function (error, stack) {
        return original ? original(error, stack) : stack;
      };
    } catch (e) {}
  }
  //
  if (options.extra.timezoneNameAlignment) {
    try {
      const original = Date.prototype.toTimeString;
      Date.prototype.toTimeString = new Proxy(original, {
        apply(target, self, args) {
          const result = Reflect.apply(target, self, args);
          return result.replace(/\((.*?)\)/, "(" + options.name.replace(/\//g, " ") + " Standard Time)");
        }
      });
      //
      markNative(Date.prototype.toTimeString, original.toString());
    } catch (e) {}
  }
  //
  if (options.extra.workerContextProtection) {
    try {
      const OriginalWorker = Worker;
      Worker = new Proxy(OriginalWorker, {
        construct(target, args) {
          const worker = new target(...args);
          return worker;
        }
      });
      //
      markNative(Worker, OriginalWorker.toString());
    } catch (e) {}
  }
  //
  if (options.extra.crossRealmProtection) {
    try {
      const appendChild = Element.prototype.appendChild;
      Element.prototype.appendChild = new Proxy(appendChild, {
        apply(target, self, args) {
          const node = args[0];
          if (node && node.tagName === "IFRAME") {
            try {
              node.addEventListener("load", function () {
                try {
                  const w = node.contentWindow;
                  if (w && w.Intl && w.Intl.DateTimeFormat) {
                    const resolved = w.Intl.DateTimeFormat.prototype.resolvedOptions;
                    w.Intl.DateTimeFormat.prototype.resolvedOptions = new Proxy(resolved, {
                      apply(target, self2, args2) {
                        const result = Reflect.apply(target, self2, args2);
                        result.timeZone = options.name;
                        return result;
                      }
                    });
                  }
                } catch (e) {}
              });
            } catch (e) {}
          }
          return Reflect.apply(target, self, args);
        }
      });
      //
      markNative(Element.prototype.appendChild, appendChild.toString());
    } catch (e) {}
  }
  //
  if (options.extra.intlConsistencyPatch) {
    try {
      const original = Intl.DateTimeFormat.prototype.formatToParts;
      Intl.DateTimeFormat.prototype.formatToParts = new Proxy(original, {
        apply(target, self, args) {
          return Reflect.apply(target, self, args);
        }
      });
      //
      markNative(Intl.DateTimeFormat.prototype.formatToParts, original.toString());
    } catch (e) {}
  }
}
