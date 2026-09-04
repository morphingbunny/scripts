var columns;

function getMessage(id, params) {
    try {
        var str = chrome.i18n.getMessage(id, params);
        if (str)
            return str;
    } catch (e) {
    }
}
// descending sort
function compareNumbers(a, b) { return a - b; }

// if it is not found, return false too
function IsFalseOrNull(owner, key) {
    return owner[key] === false || !test.hasOwnProperty(key);
}

async function GetStorageLocalBool(key, defaultBool) {
    const data = await chrome.storage.local.get(key);
    if (!data.hasOwnProperty(key))
        return defaultBool;
    if (data[key] === true)
        return true;
    return false;
}

async function GetStorageSessionBool(key, defaultBool) {
    const data = await chrome.storage.session.get(key);
    if (!data.hasOwnProperty(key))
        return defaultBool;
    if (data[key] === true)
        return true;
    return false;
}

async function GetStorageLocalValue(key) {
    const data = await chrome.storage.local.get(key);
    console.log(data);
    return data;
}
async function GetStorageSessionValue(key) {
    const data = await chrome.storage.session.get(key);
    console.log(data);
    return data;
}

/// if player has not migrate the tabs from localstorge
/// all tabs will be sent to the context menu default row
/// just like a fresh installation
async function prepareContextMenu() {

    const disableContextMenu = await GetStorageLocalBool("disableContextMenu", false);

    // clear all for all cases
    chrome.contextMenus.removeAll();

    if (disableContextMenu)
        return;

    // a preference
    // add the root of context menu
    chrome.contextMenus.create({
        "title": getMessage('sendToTMT'),
        "contexts": ["page", "link"],
        "id": "Root"
    });

    if (columns.usageMode == 1) {
        var colRegistry = columns.getRowRegistry();
        if (colRegistry.length <= 2)
            return;

        colRegistry.forEach(function (rowId) {
            if (rowId == 0 || rowId > 3) {
                var row = columns.getRow(rowId);
                if (row) {
                    if (!row.tabs)
                        row.tabs = [];
                    chrome.contextMenus.create({
                        "title": row.name,
                        "contexts": ["page", "link"],
                        "parentId": "Root",
                        "id": "Row" + rowId
                    });
                }
            }
        });
    }
}

class TMTColumns {

    constructor(data) {

        // if (data.hasOwnProperty("migratedV3")) {
        //     // no matter what result, migrate is performed
        //     this.migratedV3 = true;
        // } else
        //     this.migratedV3 = false;

        if (data.hasOwnProperty("rowDataMap")) {
            this.rowDataMap = data.rowDataMap;
        } else {
            this.rowDataMap = {};
        }
        if (data.hasOwnProperty("usageMode")) {
            this.usageMode = data.usageMode;
        } else {
            this.usageMode = 0;
        }

        if (data.hasOwnProperty("currentRowId")) {
            this.currentRowId = data.currentRowId;
        } else {
            this.currentRowId = 0;
        }

        let dirty = false;

        if (!this.rowDataMap[0]) {
            dirty = true;
            this.rowDataMap[0] = {
                id: 0,
                name: getMessage("suspendedTabsTitle"),
                //tip: getMessage("suspendedTabsTip"),
                tabs: []
            };
        }
        if (!this.rowDataMap[3]) {
            dirty = true;
            this.rowDataMap[3] = {
                id: 3,
                name: getMessage("recentlyClosedTitle"),
                //tip: getMessage("recentlyClosedTip"),
                tabs: []
            };
        }
        // obsolete rows id
        if (this.rowDataMap[1])
            delete this.rowDataMap[1];
        if (this.rowDataMap[2])
            delete this.rowDataMap[2];

        // update the data
        if (dirty)
            this.save();
    }

    getCurrentRowTip() {
        if (this.currentRowId == 0) {
            return getMessage("suspendedTabsTip");
        } else if (this.currentRowId == 3) {
            return getMessage("recentlyClosedTip");
        }
        return "";
    }
    // without recent saved
    GetTabCount() {
        let sorted = this.getRowRegistry();
        let count = 0;
        for (var i = 0; i < sorted.length; i++) {

            if (i != 3) {
                // recently closed skip;
                count += this.getRow(sorted[i]).tabs.length;
            }
        }
        return count;
    }

    //return the keys sorted
    getRowRegistry() {
        if (this.usageMode == 0) {
            return [0, 3];
        }
        var a = [];
        Object.keys(this.rowDataMap).forEach(function (e) { a.push(parseInt(e, 10)) });
        // sort
        return a.sort(compareNumbers);
        //return Object.keys(this.rowDataMap).sort(compareNumbers);
    }
    getCurrentRowId() {
        return this.currentRowId;
        // var id =  parseInt(localStorage["currentRowId"]);
        // if (id < 0 || isNaN(id))
        //     return 0;
        // return id;
    }
    setCurrentRowId(rowId) {
        this.currentRowId = rowId;
        chrome.storage.local.set({ "currentRowId": rowId });
    }
    getCurrentRow() {
        return this.getRow(this.getCurrentRowId());
    }
    // get and select
    getRow(rowId) {

        if (!rowId)
            return this.rowDataMap[0];
        var row = this.rowDataMap[rowId];
        //log('getRow',rowId,row);

        if (row) {
            // console.log('getRow save2',rowId);
            //localStorage["currentRowId"] = rowId;
            return row;
        }
        // suspended
        // localStorage["currentRowId"] = 0;
        return this.rowDataMap[0];
    }
    save() {
        chrome.storage.local.set({ "rowDataMap": this.rowDataMap }).then(() => {
            console.log("save rowDataMap", this.rowDataMap);
        });
        // localStorage["rowDataMap"] = JSON.stringify(this.rowDataMap);
    }

    addClosedTab(deleted) {
        //log('add recently closed',deleted);
        // an option value
        chrome.storage.local.get(["recentlyClosedMax"]).then((result) => {

            let MAX_RECENT_TABS = 11;

            if (result.hasOwnProperty("recentlyClosedMax")) {

                MAX_RECENT_TABS = parseInt(result['recentlyClosedMax']);
                if (isNaN(MAX_RECENT_TABS))
                    MAX_RECENT_TABS = 11;
            }
            var tabs = this.getRow(3).tabs;
            tabs.unshift(deleted);
            // console.log('add recently closed',tabs, tabs.length);

            while (tabs.length > MAX_RECENT_TABS)
                tabs.pop();

            this.save();
        });
    }
    // sent to current col
    popTab(tab) {
        if (!tab)
            return null;
        var col = this.getCurrentRow();
        col.tabs.push(tab);
        this.save();
        return tab;
    }

    addRow(name, tip, importing) {
        var nextId = 0;
        // calculate the next id based on rowsData not the registry
        for (var i in this.rowDataMap) {
            var index = parseInt(i);
            nextId = nextId > index ? nextId : index;
        }

        var rowId = nextId + 1; //parseInt(rows.rowRegistry[rows.rowRegistry.length-1]) + 1;
        this.rowDataMap[rowId] = {
            id: rowId,
            name: importing ? name : name + " " + (parseInt(rowId) - 3),
            tip: tip,
            tabs: []
        };
        this.setCurrentRowId(rowId);
        this.save();
        // update context menu
        prepareContextMenu();
        //updateUsageMode();
        return rowId;
    }
    importRow(name, tip) {
        var nextId = 0;
        // calculate the next id based on rowsData not the registry
        for (var i in this.rowDataMap) {
            var index = parseInt(i);
            nextId = nextId > index ? nextId : index;
        }
        var rowId = nextId + 1; //parseInt(rows.rowRegistry[rows.rowRegistry.length-1]) + 1;
        var row = {
            id: rowId,
            name: name,
            tip: tip,
            tabs: []
        };
        this.rowDataMap[rowId] = row;
        return row;
    }
    // find the next row in the map
    nextRow() {
        var currentRowId = this.getCurrentRowId();
        console.log("nextRow", currentRowId);
        var sorted = this.getRowRegistry();
        var index = 0;
        for (var i = 0; i < sorted.length; i++) {
            if (sorted[i] == currentRowId) {
                index = i + 1;
                break;
            }
        }
        let newId = index == sorted.length ? sorted[0] : sorted[index];
        this.setCurrentRowId(newId);
    }
    // find previous rowId
    prevRow() {
        var currentRowId = this.getCurrentRowId();
        console.log("prevRow", currentRowId);
        var sorted = this.getRowRegistry();
        var index = 0;
        for (var i = 0; i < sorted.length; i++) {
            if (sorted[i] == currentRowId) {
                index = i - 1;
                break;
            }
        }
        let newId = index < 0 ? sorted[sorted.length - 1] : sorted[index];
        this.setCurrentRowId(newId);
    }
    removeRow() {
        var rowId = this.getCurrentRowId();
        // cannot remove these two rows
        if (rowId == 0 || rowId == 3)
            return;

        var col = this.rowDataMap[rowId];
        if (col) {
            // select the next row first
            this.nextRow();

            delete this.rowDataMap[rowId];
            this.save();

            // remove menu
            chrome.contextMenus.remove("Row" + rowId);
        }
    }

    renameRow(rowId, name) {
        var col = this.rowDataMap[rowId];
        if (col) {

            col.name = name;
            this.save();
            chrome.contextMenus.update("Row" + rowId, {
                title: name
            });
        }
    }

    removeTabInRow(tabIndexInRow) {
        // instead of remember recently closed, used as trash bin for TMT rows
        var currentRow = this.getCurrentRow();
        if (currentRow.id != 3) {
            this.addClosedTab(currentRow.tabs[tabIndexInRow]);
        }
        currentRow.tabs.splice(tabIndexInRow, 1);
        this.save();
    }
}


// report how many tabs are there
function reportNumTabs() {

    chrome.storage.local.get(["showcount"]).then((result) => {

        if (result.hasOwnProperty("showcount")) {
            if (!result.showcount) {
                chrome.action.setBadgeText({
                    text: ""
                });
                return;
            }
        }
        chrome.tabs.query({ windowType: 'normal' }, function (tabs) {
            updateBadgeText(tabs.length);
        });
    });
}
function updateBadgeText(numTabs) {
    chrome.action.setBadgeText({
        text: ("" + numTabs)
    });

    var highlight = [0, 255, 0, 255];

    if (numTabs >= 45)
        highlight = [255, 0, 0, 255];
    else if (numTabs >= 30)
        highlight = [255, 145, 0, 255];
    else if (numTabs >= 20)
        highlight = [255, 220, 0, 255];
    else if (numTabs >= 10)
        highlight = [175, 230, 50, 255];

    chrome.action.setBadgeBackgroundColor({
        color: highlight
    });
}
//
// tabData stores a tab's recreated history
//
function tabData(tab) {
    this.id = tab.id;
    this.windowId = tab.windowId;
    this.title = tab.title;
    //this.favIconURL = tab.favIconUrl;
    this.URL = [tab.url];
    //this.screenCap = null;
    this.pinned = tab.pinned;
    // this.popped = false;
    this.isIncognitoTab = tab.incognito;
    // why? never used
    // this.parent = this.id;
}
