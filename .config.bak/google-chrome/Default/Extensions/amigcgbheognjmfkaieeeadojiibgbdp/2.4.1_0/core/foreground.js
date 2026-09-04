


/*  "migratedV3",
    "welcomeshown",
    "updateread",
    "showcount",
    "popupsize",
    "hidePinTab",
    "crosswindow",
    "themeColor",
    "customThemeColor1",
    "customThemeColor2",
    "winpopupWidth",
    "disableContextMenu",
    "recentlyClosedMax"];
 "rowDataMap", "currentRowId",


function InitOptions(allKeys, isLocalStorage, callback) {
    if (isLocalStorage) {
        let config = {};
        for (const key in allKeys) {
            if (localStorage.hasOwnProperty.call(object, key)) {
                const element = object[key];
                config[key] = object;
            }
        }
        callback(config);
    }
    else {
        chrome.storage.local.get(allKeys).then((data) => {
            callback(data);
        });
    }
}*/

function InitOptions(allKeys, result, isLocalStorage) {
    let config = {};

    // vales from the allKeys are included in the config
    for (let i = 0; i < allKeys.length; i++) {
        switch (allKeys[i]) {
            case "usageMode":
                config.usageMode = 0;
                if (result.hasOwnProperty(allKeys[i])) {
                    config.usageMode = result.usageMode;
                }
                break;
            case "welcomeshown":
                // boolean
                config.welcomeshown = false;
                if (result.hasOwnProperty(allKeys[i])) {
                    if (isLocalStorage) {
                        config.welcomeshown = result.welcomeshown != "false";
                    } else
                        config.welcomeshown = result.welcomeshown;
                }
                break;
            case "updateread":
                config.updateread = "";
                // string
                if (result.hasOwnProperty(allKeys[i])) {
                    config.welcomeshown = true;
                    config.updateread = result.updateread;
                }
                break;
            case "popupsize":
                config.popupsize = "wide";
                // a string value
                if (result.hasOwnProperty(allKeys[i])) {
                    config.popupsize = result.popupsize;
                }
                break;
            case "hidePinTab":
                //  bool
                config.hidePinTab = false;
                if (result.hasOwnProperty(allKeys[i])) {
                    if (isLocalStorage) {
                        config.hidePinTab = result.hidePinTab != "false";
                    } else
                        config.hidePinTab = result.hidePinTab;
                }
                break;
            // bool
            case "crosswindow":
                config.crosswindow = false;
                if (result.hasOwnProperty(allKeys[i])) {
                    if (isLocalStorage) {
                        config.crosswindow = result.crosswindow != "false";
                    } else
                        config.crosswindow = result.crosswindow;
                }
                break;
            case "themeColor":

                // integer
                config.themeColor = 0;
                if (result.hasOwnProperty(allKeys[i])) {
                    if (isLocalStorage) {
                        config.themeColor = parseInt(result.themeColor);
                    } else
                        config.themeColor = result.themeColor;
                }
                break;
            case "customThemeColor1":

                config.customThemeColor1 = "ffffff";
                if (result.hasOwnProperty(allKeys[i])) {
                    config.customThemeColor1 = result.customThemeColor1;
                }
                break;
            case "customThemeColor2":
                config.customThemeColor2 = "7777ff";
                if (result.hasOwnProperty(allKeys[i])) {
                    config.customThemeColor2 = result.customThemeColor2;
                }
                break;

            case "MAX_RECENT_TABS":
                config.MAX_RECENT_TABS = 11;
                if (result.hasOwnProperty(allKeys[i])) {
                    let value = result.MAX_RECENT_TABS;
                    if (!isNaN(value)) {
                        config.MAX_RECENT_TABS = value;
                    }
                }
                break;
            case "disableContextMenu":

                config.disableContextMenu = false;
                if (result.hasOwnProperty(allKeys[i])) {
                    config.disableContextMenu = result.disableContextMenu;
                }
                break;
            case "winpopupWidth":
                config.winpopupWidth = 800;
                if (result.hasOwnProperty(allKeys[i])) {

                    let value = result.winpopupWidth;
                    if (!isNaN(value)) {
                        config.winpopupWidth = value;
                    }
                }
                break;
            case "showcount":
                config.showcount = true;
                if (result.hasOwnProperty(allKeys[i])) {

                    config.showcount = result.showcount;
                }
                break;
        }
    }
    return config;
}
/// included in options and popup only, not in background.js
/*function migrateLocalstorage(callback) {
    // mirgate now
    console.log("Copy data to the chrome storage");
    let json = localStorage["rowDataMap"];
    if (!json) {
        console.log("no json found");
        chrome.storage.local.set({ "migratedV3": "nojson" }).then(() => {
            //if no row data, nothing is migrated
            callback(false);
        });
        return;
    }

    let rowDataMap = JSON.parse(json);
    if (!rowDataMap) {
        console.log("Parse json failed");
        chrome.storage.local.set({ "migratedV3": "jsonfailed" }).then(() => {
            callback(false);
        });
        return;
    }

    let importOptions = InitOptions(localStorage, includeDefaults);
    importOptions.rowDataMap = rowDataMap;
    importOptions.migratedV3 = "Success";

    console.log("Imported data", importOptions);
    chrome.storage.local.set(importOptions).then(() => {
        callback(true);
    });
}*/
