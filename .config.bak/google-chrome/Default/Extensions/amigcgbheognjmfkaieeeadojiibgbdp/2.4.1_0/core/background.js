// too trouble to listen to this event, forget it
// chrome.tabs.onActivated.addListener(function (activeInfo) {
//     console.log("OnTabActivated", activeInfo);
//     OnTabActivated(activeInfo);
// });

// sometimes users might closed the tab before it is fully loaded
chrome.tabs.onCreated.addListener(reportNumTabs);
chrome.tabs.onUpdated.addListener(captureTabPreview);
// always load, since it would be out of sync from TMT popup changes
async function LoadColumns() {
    const data = await chrome.storage.local.get(["rowDataMap", "currentRowId", "usageMode"]);
    columns = new TMTColumns(data);
}

async function captureTabPreview(tabId, changeInfo, tab) {

    try {
        if (!tab || !tab.id || !tab.windowId || tab.url == "" || tab.status != 'complete') {
            //console.log("not a valid", tab);
            return;
        }
        if (tab.url.indexOf('chrome://') == 0 || tab.url.indexOf('chrome-extension://') == 0 || tab.url.indexOf('chrome-devtools://') == 0)
            return;

        // always replace the data for any change
        if (changeInfo.status != "complete")
            return;
        //if (tab.status == 'complete') {
        if (tab.active || tab.selected) {
            chrome.permissions.contains({
                //permissions:["<all_urls>"]
                origins: ['<all_urls>']
            }, function (hasPermission) {
                if (hasPermission) {
                    setTimeout(() => captureTab(tabId, changeInfo, tab), 400);
                }
                // else {
                //     console.log("no permission");
                // }
            });
        }
    } catch (e) {
        console.error(e);
    }
}
// need to retry with a timeout
function captureTab(tabId, changeInfo, tab) {
    chrome.tabs.captureVisibleTab(tab.windowId,
        {
            format: "jpeg",
            quality: 5
        }, function (dataURL) {
            if (dataURL) {
                // console.log('captureTabPreview end', tabId);
                chrome.storage.session.set({ ["Preview" + tabId]: dataURL });
                // prevent race condition???
            } else {
                console.log('captureTabPreview failed', tabId);
            }
        });
}

chrome.tabs.onRemoved.addListener(function (tabId) {
    reportNumTabs();
    chrome.storage.session.remove("Preview" + tabId);
    // , function () {
    //     console.log("removed preview " + tabId);
    // });
});

chrome.contextMenus.onClicked.addListener(onContextMenuClicked);
/// call by context menu
async function onContextMenuClicked(info, tab)//, rowId)
{
    await LoadColumns();
    let rowId = 0;
    // Columns.sendTabDataCM(info, tab, rowId);
    if (info.menuItemId == "Root") {
        rowId = 0;
    }
    else {
        let parsedValue = parseInt(info.menuItemId.replace("Row", ""));
        if (!isNaN(parsedValue)) {
            rowId = parsedValue;
        }
    }
    let selectedCol = columns.rowDataMap[rowId];
    if (!selectedCol)
        return;

    if (selectedCol.id == 3) {
        // recently closed, next column
        columns.nextRow();
        selectedCol = columns.getCurrentRow();
    }
    if (info.linkUrl) {
        // it is a link
        var linkData = {
            URL: [info.linkUrl],
            title: info.selectionText || info.linkUrl
        };
        // if the link is from merge
        if (info.pinned)
            linkData.pinned = info.pinned;

        if (info.favIconURL)
            linkData.favIconURL = info.favIconURL;

        selectedCol.tabs.push(linkData);
        columns.save();

        // refresh views
        // chrome.runtime.sendMessage({ "refresh": true });

    } else {
        // send tab
        var _tab = new tabData(tab);
        if (tab.url)
            _tab.url = [tab.url];

        selectedCol.tabs.push(_tab);
        columns.save();
        chrome.tabs.remove(tab.id, function () {
            // refresh views
            // chrome.runtime.sendMessage({ "refresh": true });
        });
    }
}
// Chrome 25+
if (chrome.commands) {
    chrome.commands.onCommand.addListener(function (command) {
        //log('Command:', command);
        switch (command) {
            case 'open-tmt-window':
                chrome.windows.getCurrent({}, function (win) {
                    // console.log("open tmt window ", win);
                    openTMTWin(win.id);
                });
                break;
            case "send-active-tmt":
                chrome.tabs.query({
                    active: true,
                    currentWindow: true
                }, function (tabs) {
                    if (tabs.length == 1) {
                        SendActiveTabTMT(tabs[0]);
                    }
                });
                break;
        }
    });
}

async function SendActiveTabTMT(tab) {
    await LoadColumns();
    // only one tab should return
    var tabId = tab.id;
    var rowId = columns.getCurrentRowId();
    // Cannot pop to recently closed columns
    if (rowId == 3) {
        // switch to a pop'able row; usually warps to 0
        // this will change localStorage["currentRowId"]
        columns.nextRow();
    }
    // return data of the poped tab
    columns.popTab(new tabData(tab));
    // discard data of the tab
    // delete allTabs[tabId];
    chrome.tabs.remove(tabId);
}

function openTMTWin(winId) {
    try {
        // open the tmt popup
        // the sender has the windowid that trigger the shortcut
        // lastFocusId = sender.tab.windowId;
        chrome.storage.session.set({ "lastFocusId": winId }).then(() => {
            chrome.storage.local.get("winpopupWidth").then((result) => {
                let width = 800;
                if (result.hasOwnProperty("winpopupWidth")) {
                    width = result.winpopupWidth;
                }
                chrome.windows.create({
                    url: '/core/popup.html?tmtwindow',
                    height: 636,
                    width: width,
                    focused: true,
                    type: 'popup'
                });
            });
        });
    } catch (e) {
        console.error('opentmtwindow', e);
    }
}

// use the storage directly but we have no access to options at the moment
async function init() {
    reportNumTabs();
    await LoadColumns();
    prepareContextMenu();
}

init();

