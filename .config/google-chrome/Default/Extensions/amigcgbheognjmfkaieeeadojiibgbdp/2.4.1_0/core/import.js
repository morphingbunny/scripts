var background = chrome.extension.getBackgroundPage();
var useStorage;

function OnStorageChange(value) {
    localStorage.useStorage = value;
    $('#storageState').val(value);
}

function getMessage(id, params) {
    try {
        var str = chrome.i18n.getMessage(id, params);
        if (str)
            return str;
    } catch (e) {

    }
    return null;
}

function loadTMTColumns() {
    var rowDataMap;
    try {
        var json = localStorage["rowDataMap"];
        if (json)
            rowDataMap = JSON.parse(localStorage["rowDataMap"]);

        if (!rowDataMap || !rowDataMap[0] || !rowDataMap[3])
            throw 1;

    } catch (e) {

        if (!rowDataMap)
            rowDataMap = {};

        if (!rowDataMap[0])
            rowDataMap[0] = {
                id: 0,
                name: getMessage("suspendedTabsTitle"),
                tip: getMessage("suspendedTabsTip"),
                tabs: []
            };

        if (!rowDataMap[3]) {
            rowDataMap[3] = {
                id: 3,
                name: getMessage("recentlyClosedTitle"),
                tip: getMessage("recentlyClosedTip"),
                tabs: []
            };
        }

        // should not exists
        delete rowDataMap[1];
        delete rowDataMap[2];
    }
    return rowDataMap;
}

function main() {

    $('input[type="button"]').addClass('button');
    //localization
    $("#importButton").val(getMessage("importButton"));
    $("#mergeButton").val(getMessage("mergeButton"));
    $("#import").text(getMessage("import"));
    $("#export").text(getMessage("export"));
    $("#importTextToggle").val(getMessage("import"));
    $("#exportBackup").val(getMessage("exportBackup"));
    $("#exportPrint").val(getMessage("exportPrint"));

    $("#importDescription").text(getMessage("importDescription"));
    $("#importHint").text(getMessage("importDescription2"));
    $("#mergeHint").text(getMessage("mergeHint"));
    $("#exportDescription").text(getMessage("exportDescription"));
    $("#pagetitle").text(getMessage("importPageTitle"));


    $('input[name="exportFormat"]').change(function () {
        if ($('input[name="exportFormat"]:checked').val() == 0) {
            $("#exportText").val(exportData.text);
        } else {
            $("#exportText").val(exportData.html);
        }
    });

    $("#exportText").click(function () {
        this.select();
    });
}

var exportData;

function getExportString(print) {

    $('#exportTextDiv').show();

    if (print)
        $(exportControls).show();
    else
        $(exportControls).hide();

    // trim the useless data, add a version number
    var rows = JSON.parse(localStorage.rowDataMap);
    for (var r in rows) {
        // legacy rows
        if (rows[r].id == 1 || rows[r].id == 2)
            continue;

        var tabsData = [];

        var tabs = rows[r].tabs;
        for (var t in tabs) {
            try {
                var tab = tabs[t];
                tabsData.push({
                    title: tab.title,
                    URL: [tab.URL.pop()], // remove useless history
                    pinned: tab.pinned,
                    favIconURL: tab.favIconURL
                });
            } catch (e) {
                console.error(e);
            }
        }
        rows[r].tabs = tabsData;
    }

    if (print) {
        // default text
        exportData = prettyPrint(rows);
        $("#exportText").val(exportData.text);
    } else {
        //export part
        $("#exportText").val(JSON.stringify({
            version: localStorage.majorVersion,
            rowDataMap: rows,
            usageMode: localStorage.usageMode,
            currentRowId: localStorage.currentRowId
        }));
    }
}


function prettyPrint(columns) {
    exportData = {};
    exportData.text = 'TooManyTabs Data (' + new Date().toDateString() + ')\n';
    var tmt = $('<DL>');
    for (var r in columns) {
        // column name
        $('<DT><H3 LAST_MODIFIED="'
            + Math.round(new Date().getTime() / 1000) + '">' + columns[r].name
            + ' (' + columns[r].tabs.length
            + ')</H3></DT>').appendTo(tmt);
        exportData.text += '\n' + columns[r].name + ' (' + columns[r].tabs.length + ') \n';

        var tabs = columns[r].tabs;
        var dl = $('<DL>').appendTo(tmt);
        for (var t in tabs) {
            try {
                var tab = tabs[t];
                var _dt = $('<DT>').appendTo(dl);
                $('<a/>', {
                    text: tab.title,
                    href: tab.URL[0],
                    icon: tab.favIconURL
                }).appendTo(_dt);

                exportData.text += "    " + tab.title + '\n';
                exportData.text += "        " + tab.URL[0] + '\n';
            } catch (e) {
                console.error(e);
            }
        }
    }
    exportData.html
        = '<!DOCTYPE NETSCAPE-Bookmark-file-1><META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">'
        + '<TITLE>TooManyTabs Data</TITLE><H1>TooManyTabs(' + new Date().toDateString() + ')</H1><DL></DL>' + tmt.html();
    return exportData;
}
// handle old and new format
function parseData(text) {
    try {
        var jsonData = JSON.parse(text);
        // new version of export
        if (!jsonData.version) {
            jsonData.rowDataMap = JSON.parse(jsonData.rowDataMap);
        }
        // legacy rows
        delete jsonData.rowDataMap[1];
        delete jsonData.rowDataMap[2];

        // some validations
        if (!jsonData.rowDataMap[0] || (jsonData.rowDataMap[0].id != 0) ||
            !jsonData.rowDataMap[3] || (jsonData.rowDataMap[3].id != 3)) {
            //console.log("Inconsistent column data");
            alert(getMessage("formatError"));
            return null;
        }
        return jsonData;
    } catch (e) {
        console.error(e);
        alert(getMessage("formatError"));
    }
    return null;
}


function beforeImport() {
    // close the popups to prevent data corruption
    try {
        // reload all views
        chrome.extension.getViews({ type: "tab" }).forEach(function (tab) {
            if (tab != window)
                tab.close();
        });
        chrome.extension.getViews({ type: "popup" }).forEach(function (popup) {
            popup.close();
        });
    } catch (e) {

    }
}

function LoadFromStorage() {
    chrome.storage.local.get(['rowDataMap', 'usageMode'],
        function (result) {
            if (result) {
                result.version = localStorage.majorVersion;
                $('#importText').val(JSON.stringify(result));
            }
        });

}
//Import tmt data from Chrome backup data

function importColumn() {
    //var importObj;
    var importText = $("#importText").val();
    if (!importText)
        return;

    beforeImport();

    var importData = parseData(importText);
    if (!importData)
        return;

    // format is ok
    localStorage["rowDataMap"] = JSON.stringify(importData.rowDataMap);
    // background.initializeRows();

    if (importData.currentRowId) {
        localStorage['currentRowId'] = importData.currentRowId;
    }
    // after import, reload background.Columns, usagemode, context menus
    background.afterImport(importData.usageMode);
    /* if (importData.usageMode) {
         background.setUsageMode(importData.usageMode);
     }   */
    alert(getMessage("importedSuccessfully"));
}

function showDiv(id) {
    $("#" + id + "Div").show();
    $("#" + id + "Toggle").hide();
}

// force custom mode and warn users to upgrade
/*function changeUsageMode(){    
    background.setUsageMode(1, true);    
}*/

// Import and merge TMT data
function mergeTMT() {

    var importText = $('#importText').val();
    if (!importText)
        return;
    var importData = parseData(importText);

    beforeImport();
    //console.log(importData);
    try {
        // load TMT rows from localstorage now
        var currentCols = loadTMTColumns();
        // var rowIds = [];
        // closed tabs column Id
        var maxId = 3;
        for (var i in currentCols) {
            if (i > maxId)
                maxId = i;
        }
        //Object.keys(currentCols).forEach(function(e){rowIds.push(parseInt(e,10))});
        //rowIds.sort(function(a,b){return a-b;});        
        //var maxId = parseInt(rowIds.pop());
        var nameMap = {};
        //var rowId;
        if ($('#mergeCheck').is(':checked')) {
            //console.log('mergeSameColumn');
            $.each(currentCols, function (index, col) {
                nameMap[col.name] = col;
            });
        }
        $.each(importData.rowDataMap, function (index, row) {
            //console.log('Merge:', row.id, row);
            var col = null;
            if (row.id == 0) {
                //console.log('Merged suspend column');
                // always merge the first row
                col = currentCols[0];
            } else if (row.id == 3) {
                // recently closed, skipped
                //console.log('Skip recently closed tabs');
                return;
            } else {
                // custom columns, if merge then it would be found
                col = nameMap[row.name];
                if (!col) {
                    // create new columns
                    maxId++;
                    col = {
                        id: maxId,
                        name: row.name,
                        tabs: []
                    };
                    currentCols[maxId] = col;
                }
            }
            //tabs from tmt backup, treat as link to add, only pinned state retained
            $.each(row.tabs, function (index, tab) {
                col.tabs.push({
                    title: tab.title,
                    URL: tab.URL[0],
                    pinned: tab.pinned
                });
            });
            //console.log('merge', col.name, col.tabs.length);
        });
        // save the merged columns
        localStorage["rowDataMap"] = JSON.stringify(currentCols);
        background.afterImport(1);
        // use custom mode once tab is imported, reload menu = true
        // background.setUsageMode(1, true);
        alert(getMessage("importedSuccessfully"));
    } catch (e) {
        console.error('Fail when import', e);
        alert(getMessage("formatError"));
        throw e;
    }
}

$(document).ready(function () {
    main();

    $(exportBackup).click(function () {
        getExportString();
    });

    $(exportPrint).click(function () {
        getExportString(true);
    });

    $(importTextToggle).click(function () {
        showDiv('importText');
    });

    $(importStorageToggle).click(function () {
        LoadFromStorage();
        showDiv('importText');
    });

    $(importButton).click(function () {
        importColumn();
    });

    $(mergeButton).click(function () {
        mergeTMT();
    });
});