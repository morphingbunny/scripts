var TABAREA_WIDTH = 620;
var TMTAREA_HEIGHT = 430;

// var tabDataMapRef;	          // hashtable to all tab data
var tabRegistryRef;           // array of tab indices (may point to globalTabRegistry)
var currentTabRegistryRef;    // array of tab indices (always point to current window)
var windowRegistryRef;        // array of window indices
var currentWindowId;          // current window id
var currentRow;               // current TMT row

var maxTabIconOrder;          // highest attained by all displayed tabs now
var extraTabAreaNeeded = 0;   // higher when there's search results
var separatorTabIconOrder;    // beyond this order icons are automatically seprated by a column

var resizedTimes = 0;
var smallMode = false;
var tmtWindowId;
// all active tabs (either in one window or all windows, depends of settings)
// different from the allTabs in background
var allTabs = {};
var config;
//
// Render tab thumbnail,
// including TMT arrow, close arrow and 'you are here' icon
//
function createTabIcon(tabId) {

    let tabInfo = allTabs[tabId];
    let exterior = $("<div/>", {
        id: "tab" + tabId,
        "class": "tabexterior",
        tabId: tabId,
        title: tabInfo.discarded == true ? "Discarded" : "" // discarded tab can be reactivated when select
    });

    let interior = $("<div/>", {
        "class": "tabinterior"
    }).appendTo(exterior);

    let img = $("<img/>", {
        id: "tabimg" + tabId,
        "class": "tabimage",
        src: "/img/sample_screen.png",// new: just use default first to prevent loading
        title: tabInfo.URL[0],//tabInfo.URL.length-1],
        click: onTabSelect,
        tabId: tabId
    }).appendTo(interior);

    let titlebox = $("<div/>", {
        "class": "tabtitle",
        text: tabInfo.title,
        title: tabInfo.title,
        click: onTabSelect,
        tabId: tabId
    }).appendTo(exterior);

    //    console.log(tabInfo,tabInfo.favIconURL);
    // can no longer load chrome://.... favicon
    let faviconbox = $("<img/>", { "class": "tabfavicon" }).appendTo(exterior);
    try {

        faviconbox.attr('src', faviconURL(tabInfo.URL[0]));
        // tabInfo.favIconURL?tabInfo.favIconURL:chrome.extension.getURL('/img/tmtchrome_defaulticon.png'));
    } catch (e) {
        faviconbox.attr('src', faviconURL('/img/tmtchrome_defaulticon.png'));
    }
    let popiconbox = $("<div/>", {
        "class": "tabpopicon",
        click: onTabPop,
        title: getMessage("clickToPop"),
        tabId: tabId
    }).appendTo(exterior);

    if (tabInfo.pinned == true) {
        $("<div/>", {
            "class": "tabpinbutton",
            title: "pinned"
        }).appendTo(exterior);

    } else {
        $("<div/>", {
            "class": "tabclosebutton",
            click: onTabClose,
            title: getMessage("clickToClose"),
            tabId: tabId
        }).appendTo(exterior);

    }

    $("#innertabarea").append(exterior);

    // delete the preview here if option is disable
    if (disablePreview) {
        chrome.storage.session.remove(["Preview" + tabId]);
    } else {
        setTimeout(function () {
            loadScreenCap(tabId);
        }, Math.random() * 500);
    }
}

function loadScreenCap(tabId) {
    if (disablePreview)
        return;

    let tabimg = $("#tabimg" + tabId);
    if (tabimg.length > 0) {
        chrome.storage.session.get(["Preview" + tabId]).then((result) => {
            if (result.hasOwnProperty("Preview" + tabId))
                tabimg.attr("src", result["Preview" + tabId]);
        });
    }
}

// Use css to order the tab thumbnail by columns
function placeTabIcon(tabId) {
    let tabIcon = $("#tab" + tabId);
    let order = parseInt(tabIcon.attr("order"));
    let x = Math.floor(order / 5);
    let y = order % 5;

    if (order >= separatorTabIconOrder) {
        let newOrder = order + 5 + (4 - ((separatorTabIconOrder - 1) % 5));
        x = Math.floor(newOrder / 5);
        y = newOrder % 5;
    }

    let w = y % 2;
    let z = 100 + y;

    tabIcon.attr("style", "left:" + (20 + x * 185 + w * 20) + "px; top:" + (y * 100) + "px; z-index:" + z + ";");

    if (allTabs[tabId].discarded == true) {
        tabIcon.css('opacity', '0.5');
    }
}
/**
 * Click thumbnail to select a tab in same or different window
 * Many functions are deprecated, check carefully
 */
function onTabSelect(e) {

    if (e.ctrlKey || e.metaKey || e.button == 1) {
        //middle click and close tab
        onTabClose(e);
        return;
    }

    let selected = e.currentTarget;
    let tabId = parseInt($(selected).attr('tabId'));

    if (!allTabs[tabId])
        return;

    console.log(tabId, allTabs[tabId]);
    // should always work
    selectTab(allTabs[tabId], _focusedId);
}

// Close an active tab in TMT panel
function onTabClose(e) {

    cancelTMTContextMenu();

    let selected = e.currentTarget;
    let tabId = parseInt($(selected).attr('tabId'));

    // if closing the tab will close the current window, also close ourselves
    /*
    var closePopup = false;
    var closeWindowId = allTabs[tabId].windowId;
    if (closeWindowId == currentWindowId && currentTabRegistryRef.length <= 1)
        closePopup = true;*/

    if (allTabs[tabId])
        columns.addClosedTab(allTabs[tabId]);

    chrome.tabs.remove(tabId, function () {
        // close popup after removing the tab, not before
        if ($('.tabinterior').length == 1) {
            window.close();
            return;
        }
        // remove tab icon
        var tabIcon = $("#tab" + tabId);

        if (tabIcon.attr("order") == maxTabIconOrder)
            maxTabIconOrder--;//= maxTabIconOrder-1; // not a perfect solution, but better than not doing anything

        //var area = $("#innertabarea");
        //area.removeChild(tabIcon); // TODO: replace with animation
        tabIcon.remove();

        // recently closed column is visible, refresh
        if (columns.getCurrentRowId() == 3) {
            // wait till background saved the closed tabs data
            setTimeout(function () {
                //console.log('reload closed', currentRow.tabs.length);
                clearTMTArea();
                fillTMTArea();
            }, 1000);
        }
    });
}

//
// sort tabs by order and find tabs
//
var lastSortedOrder;
function sortTabs_old(orderType) {
    maxTabIconOrder = 0;
    let tabRegistryRefClone = [];

    if (orderType != "keyword") {
        // remove search result and separator for search result whenever it's sorting
        $("#numsearchresults").attr("style", "left: 0px; top: 600px;");
        $("#searchseparator").attr("style", "left: -10px;");
        $("#searchbox").val("");
        extraTabAreaNeeded = 0;
        adjustInnerArea();
    }
    if (orderType == "tabid") {
        for (var i = 0; i < tabRegistryRef.length; i++) {
            var tabIcon = $("#tab" + tabRegistryRef[i]);
            var order = tabRegistryRef.length - i - 1;
            tabIcon.attr("order", order);
            if (order > maxTabIconOrder)
                maxTabIconOrder = order;
        }
        for (var i = tabRegistryRef.length - 1; i >= 0; i--) {   // still need to update the clone so others can know last sorted order
            tabRegistryRefClone.push(tabRegistryRef[i]);
        }
        separatorTabIconOrder = 99999;
        lastSortedOrder = tabRegistryRefClone;
        SetLastOrder("tabid");
    } else if (orderType == "name") {

        for (var i = 0; i < tabRegistryRef.length; i++) {
            tabRegistryRefClone.push(tabRegistryRef[i]);
        }
        tabRegistryRefClone.sort(nameSortFunction);
        for (var i = 0; i < tabRegistryRef.length; i++) {
            var tabIcon = $("#tab" + tabRegistryRefClone[i]);
            tabIcon.attr("order", i);
            var order = i;
            if (order > maxTabIconOrder)
                maxTabIconOrder = order;
        }
        separatorTabIconOrder = 99999;
        lastSortedOrder = tabRegistryRefClone;
        SetLastOrder("name");
    }
    else if (orderType == "domain") {
        for (var i = 0; i < tabRegistryRef.length; i++) {
            tabRegistryRefClone.push(tabRegistryRef[i]);
        }
        tabRegistryRefClone.sort(domainSortFunction);
        for (var i = 0; i < tabRegistryRef.length; i++) {
            var tabIcon = $("#tab" + tabRegistryRefClone[i]);
            tabIcon.attr("order", i);
            var order = i;
            if (order > maxTabIconOrder)
                maxTabIconOrder = order;
        }
        separatorTabIconOrder = 99999;
        lastSortedOrder = tabRegistryRefClone;
        SetLastOrder("domain");
    }
    else if (orderType == "keyword") {
        for (var i = 0; i < tabRegistryRef.length; i++) {
            tabRegistryRefClone.push(tabRegistryRef[i]);
        }
        separatorTabIconOrder = 0;
        tabRegistryRefClone.sort(keywordSortFunction);
        for (var i = 0; i < tabRegistryRef.length; i++) {
            var tabIcon = $("#tab" + tabRegistryRefClone[i]);
            tabIcon.attr("order", i);
            var order = i;
            if (order > maxTabIconOrder)
                maxTabIconOrder = order;
        }
        // !! do not record result as last tab order!

        // find out how many are matches
        var searchTerm = $("#searchbox").val().toLowerCase();
        separatorTabIconOrder = 0;

        for (var i = 0; i < tabRegistryRef.length; i++) {
            if ((allTabs[tabRegistryRef[i]].title.toLowerCase().indexOf(searchTerm) != -1) ||
                (allTabs[tabRegistryRef[i]].URL[allTabs[tabRegistryRef[i]].URL.length - 1].toLowerCase().indexOf(searchTerm) != -1)) {
                separatorTabIconOrder++;
            }
        }
    }
}

function nameSortFunction(tabId1, tabId2) {
    if (!allTabs[tabId1].title) return 1;
    if (!allTabs[tabId2].title) return 1;
    if (allTabs[tabId1].title.toLowerCase() < allTabs[tabId2].title.toLowerCase())
        return -1;
    else return 1;
}

function domainSortFunction(tabId1, tabId2) {
    let url1 = allTabs[tabId1].URL[allTabs[tabId1].URL.length - 1];
    let url2 = allTabs[tabId2].URL[allTabs[tabId2].URL.length - 1];

    if (url1 < url2)
        return -1;
    else return 1;
}

function keywordSortFunction(tabId1, tabId2) {
    let searchTerm = $("#searchbox").val().toLowerCase();

    if (!allTabs[tabId1].title)
        allTabs[tabId1].title = "untitled";
    if (!allTabs[tabId2].title)
        allTabs[tabId2].title = "untitled";

    let tab1Result = allTabs[tabId1].title.toLowerCase().indexOf(searchTerm);
    let tab2Result = allTabs[tabId2].title.toLowerCase().indexOf(searchTerm);

    let tab1URLResult = allTabs[tabId1].URL[0].toLowerCase().indexOf(searchTerm);  // includes URL!!
    let tab2URLResult = allTabs[tabId2].URL[0].toLowerCase().indexOf(searchTerm);
    //console.log( allTabs[tabId1].URL[allTabs[tabId1].URL.length-1].toLowerCase() +" "+tab1URLResult);
    if (tab1URLResult != -1) {
        tab1Result = tab1URLResult;  // kind of an OR operation
    }
    if (tab2URLResult != -1) {
        tab2Result = tab2URLResult;  // kind of an OR operation
    }

    let lastTabOrder1;
    let lastTabOrder2;

    if ((tab1Result == -1) && (tab2Result == -1)) {
        // retain original order
        lastTabOrder1 = lastSortedOrder.indexOf(tabId1);
        lastTabOrder2 = lastSortedOrder.indexOf(tabId2);
        return lastTabOrder1 < lastTabOrder2 ? -1 : 1;
    }

    if ((tab1Result != -1) && (tab2Result != -1)) {
        // retain original order too
        lastTabOrder1 = lastSortedOrder.indexOf(tabId1);
        lastTabOrder2 = lastSortedOrder.indexOf(tabId2);
        return lastTabOrder1 < lastTabOrder2 ? -1 : 1;
    }

    if (tab1Result == -1) {
        return 1;
    }

    return -1;


}

var sortingTimer;
var sortingTimer2;

function sortTabsCommand(orderType) {
    if (sortingTimer)
        clearTimeout(sortingTimer);   // avoid harold effect
    if (sortingTimer2)
        clearTimeout(sortingTimer2);

    lastSortedOrder = [];
    Object.keys(allTabs).forEach(function (e) { lastSortedOrder.push(parseInt(e, 10)) });
    sortTabs(orderType);

    // perform animation to show new order
    doTabAreaAnimation(6);

    sortingTimer = setTimeout(function () {
        for (var i = 0; i < lastSortedOrder.length; i++) {
            placeTabIcon(lastSortedOrder[i]);
        }
        moveInnerArea(0, 0);    // adjust and check arrows
    }, 180);
}

function SetLastOrder(value) {
    chrome.storage.session.set({ "lastOrder": value });
}
function sortTabs(orderType) {
    maxTabIconOrder = 0;

    if (orderType != "keyword") {
        // remove search result and separator for search result whenever it's sorting
        $("#numsearchresults").hide();//attr("style", "left: 0px; top: 600px;");
        $("#searchseparator").hide();//attr("style", "left: -10px;");
        $("#searchbox").val("");
        extraTabAreaNeeded = 0;
        adjustInnerArea();
    }
    separatorTabIconOrder = 99999;
    if (orderType == "tabid") {
        // largest tabId first
        lastSortedOrder.sort(sortTabId);
        //console.log('lastSortedOrder', lastSortedOrder);
        SetLastOrder("tabid");
    } else if (orderType == "name") {
        lastSortedOrder.sort(nameSortFunction);
        SetLastOrder("name");
    } else if (orderType == "domain") {
        lastSortedOrder.sort(domainSortFunction);
        SetLastOrder("domain");
    } else if (orderType == "keyword") {
        lastSortedOrder.sort(keywordSortFunction);
    }

    for (var i = 0; i < lastSortedOrder.length; i++) {
        var tabIcon = $("#tab" + lastSortedOrder[i]);
        //var order = lastSortedOrder.length-i-1;
        tabIcon.attr("order", i);
        if (i > maxTabIconOrder)
            maxTabIconOrder = i;
    }

    if (orderType == "keyword") {
        $("#numsearchresults").show();
        $("#searchseparator").show();
        // find out how many are matches
        var searchTerm = $("#searchbox").val().toLowerCase();
        separatorTabIconOrder = 0;

        for (var i = 0; i < lastSortedOrder.length; i++) {
            if ((allTabs[lastSortedOrder[i]].title.toLowerCase().indexOf(searchTerm) != -1) ||
                (allTabs[lastSortedOrder[i]].URL[allTabs[lastSortedOrder[i]].URL.length - 1].toLowerCase().indexOf(searchTerm) != -1)) {
                separatorTabIconOrder++;
            }
        }
    }

    return lastSortedOrder;
}


function findTabsCommand() {
    //console.log('keycode', window.event.keyCode);
    let searchTerm = $("#searchbox").val().toLowerCase().trim();

    let keyCode = window.event.keyCode;

    if (separatorTabIconOrder > 0 && (keyCode == 13 || keyCode == 38 || keyCode == 40 || keyCode == 37 || keyCode == 39)) {

        let topped = $('.topped');
        let tabId = 0;
        let lastId = 0;
        if (keyCode == 13) {
            tabId = topped.length > 0 ? parseInt(topped.attr('tabid')) : lastSortedOrder[0];
            // selected the tab, either the first or the one the arrow last pointed
            if (tabId > 0) {
                selectTab(allTabs[tabId], _focusedId);
            }
            window.event.preventDefault();
            return false;

        } else if (keyCode == 40) {
            //down arrow
            if (topped.length == 0) {
                tabId = lastSortedOrder[0];
            } else {
                lastId = parseInt(topped.attr('tabid'));
                for (var i = 0; i < lastSortedOrder.length; i++) {
                    if (lastId == lastSortedOrder[i]) {
                        if (i < separatorTabIconOrder - 1) {
                            tabId = lastSortedOrder[i + 1];
                        } else {
                            //  last tab
                            tabId = lastSortedOrder[i];
                        }
                        break;
                    }
                }
            }
            if (tabId > 0) {
                $('#tab' + tabId).addClass('topped');
            }
            if (lastId > 0 && lastId != tabId) {
                $('#tab' + lastId).removeClass('topped');
            }

        } else if (keyCode == 38) {
            // up arrow
            if (topped.length == 0) {
                tabId = lastSortedOrder[0];
            } else {
                lastId = parseInt(topped.attr('tabid'));
                for (var i = 0; i < lastSortedOrder.length; i++) {
                    if (lastId == lastSortedOrder[i]) {
                        // the last tab
                        if (i == 0) {
                            tabId = lastSortedOrder[i];
                        } else {
                            tabId = lastSortedOrder[i - 1];
                        }
                        break;
                    }
                }
            }

            if (tabId > 0) {
                $('#tab' + tabId).addClass('topped');
            }
            if (lastId > 0 && lastId != tabId) {
                $('#tab' + lastId).removeClass('topped');
            }
        }
        //console.log(keyCode, tabId, lastId);
        // ignore 37 & 39
        return;
    }

    //console.log(searchTerm);
    if (sortingTimer)
        clearTimeout(sortingTimer);   // avoid updating too frequently

    sortTabs("keyword");

    sortingTimer = setTimeout(function () {
        for (i = 0; i < lastSortedOrder.length; i++) {
            placeTabIcon(lastSortedOrder[i]);
        }
        moveInnerArea(0, 0);    // adjust and check arrows

        // place total number of results, if meaningful
        if ((separatorTabIconOrder < lastSortedOrder.length) || (searchTerm != "")) {

            $("#numsearchresults").text(separatorTabIconOrder + " tab match(es)")
                .attr("style", "left:" + (20 + Math.floor(separatorTabIconOrder / 5) * 185) + "px; top:" + ((separatorTabIconOrder % 5) * 100 + 20) + "px;");

            $("#searchseparator").attr("style", "left:" + (120 + (Math.floor(separatorTabIconOrder / 5) + 1) * 185) + "px;");

            // special handling of maxtaborder to allow more spaces
            extraTabAreaNeeded = (4 - ((separatorTabIconOrder - 1) % 5)) + 5;
            adjustInnerArea();

        } else {
            // restore to normal display
            $("#numsearchresults").attr("style", "left:0px; top:600px;");
            $("#searchseparator").attr("style", "left: -10px;");
            extraTabAreaNeeded = 0;
            adjustInnerArea();
        }
        // console.log(searchTerm+": "+separatorTabIconOrder);
    }, 200);

}

function doTabAreaAnimation(count) {
    if (count <= 0) return;

    let tabarea = $("#tabarea");
    if (count == 6)
        tabarea.attr("style", "top:70px; opacity:0.75;");
    else if (count == 5)
        tabarea.attr("style", "top:85px; opacity:0.33;");
    else if (count == 4)
        tabarea.attr("style", "top:90px; opacity:0.0;");
    else if (count == 3)
        tabarea.attr("style", "top:85px; opacity:0.33;");
    else if (count == 2)
        tabarea.attr("style", "top:70px; opacity:0.75;");
    else if (count == 1)
        tabarea.attr("style", "");

    sortingTimer2 = setTimeout(function () {
        doTabAreaAnimation(count - 1);
    }, 60);
}
function faviconURL(u) {
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", u);
    url.searchParams.set("size", "32");
    return url.toString();
}
//
// toomanytab functions
//
// Render TMT tabs in columns
//
function createTMTTab(index) {
    let tab = currentRow.tabs[index];
    let link = tab.URL[tab.URL.length - 1];
    let tmtelement = $("<div/>", {
        id: "tmt" + index,
        "class": "tmttab",
        // "index": index,
        "tabIndex": index,
        link: link//tab.URL[tab.URL.length-1]
    }).appendTo($("#innertmtarea"));

    // console.log(index, tmtelement.attr('id'), tmtelement.attr('tabIndex'));

    tmtelement.hover(function () {
        $('#tmtStatus').text($(this).attr('link')).css('background-color', '#fff').show();
    },
        function () {
            $('#tmtStatus').hide();
        });

    let tmticonbox = $("<div/>", {
        "class": "tmttabiconbox",
        click: onTMTContextMenu
    }).appendTo(tmtelement);

    //favIconURL = "chrome://favicon/size/16@1x/"
    let tmticon = $("<img/>", {
        "class": "tmttabicon",
        src: faviconURL(link)
    }).appendTo(tmticonbox);

    if (tab.pinned && currentRow.id != 3) {
        $("<img/>", {
            "class": "tmtpin",
            src: "/img/pin.png"
        }).appendTo(tmticonbox);
    }

    let label = tab.title || tab.link;
    let tmttext = $("<div/>", {
        "class": "tmttabtitle",
        text: label,
        "title": getMessage("clickToRestore") + " " + "'" + label + "'",
        click: function () {
            onTabRestore(tmtelement);
        }
    }).appendTo(tmtelement);
    //tmttext.bind("click", onTabRestore);
    //tmticonbox.bind("click", onTMTContextMenu);
}

// Update the tabIndex for all tabs
function removeTMTTab(tmttab) {
    if (!tmttab)
        return;
    //console.log('removeTMTTab', tmttab);
    //var tmttab = $("#tmt"+index);
    tmttab.remove();

    // rename the icons onward to reflect latest changes...
    let tabs = $('.tmttab');
    for (var i = 0; i < tabs.length; i++) {
        var tab = $(tabs[i]);
        tab.attr("tabIndex", i);   // should have reduced index
        tab.attr("id", "tmt" + i);
    }
    $("#tmtrowlabel").text(currentRow.name + '(' + currentRow.tabs.length + ')');
}

// remove an active tab
function onTabPop(e) {
    cancelTMTContextMenu();

    let selected = e.currentTarget;
    let tabId = parseInt($(selected).attr("tabId"));
    let rowId = columns.getCurrentRowId();
    // Cannot pop to recently closed columns
    if (rowId == 3) {
        // switch to a pop'able row; usually warps to 0
        nextTMTRow();
        rowId = columns.getCurrentRowId();
    }
    // if popping the tab will close current window (or force regeneration), also close ourselves
    /*var closePopup = false;
    var closeWindowId = allTabs[tabId].windowId;
    if (closeWindowId == currentWindowId && currentTabRegistryRef.length <= 1)
        closePopup = true;

    // save the tab data as tmt tab
    background.popTab(tabId);
   */


    if (!allTabs[tabId]) {
        return;
    }
    // return data of the poped tab
    let poped = columns.popTab(allTabs[tabId]);
    // if tab data returns
    let ownerWindow = poped ? poped.windowId : null;

    // discard data of the tab
    delete allTabs[tabId];

    /* delete from reference
    tabRegistryRef = tabRegistryRef.filter(function(value){
       return value != tabId;
    });*/

    // hide the div
    // last tab, always open a new window with new tab
    if ($('.tabinterior').length == 1) {
        chrome.tabs.create({
            windowId: ownerWindow
        }, function () {
            chrome.tabs.remove(tabId);
        });
    } else {
        chrome.tabs.remove(tabId);
    }

    // just remove the tab div and add to TMT Column
    $("#tab" + tabId).remove();
    currentRow = getCurrentRow();
    let newIndex = currentRow.tabs.length - 1;
    createTMTTab(newIndex);
    moveTMTArea(-0.15 * $("#innertabarea").height(), 6);
    $("#tmtrowlabel").text(currentRow.name + '(' + currentRow.tabs.length + ')');
}

function onTabRestore(tmttab) {
    let index = tmttab.attr('tabIndex');
    //console.log('onTabRestore', tmttab, index);
    cancelTMTContextMenu();
    //var selected = e.currentTarget;
    //var node = $(selected).parent();
    //console.log(e, $(selected), $(selected).parent(), $(selected).parent().attr("tabIndex"));
    //var index = parseInt($(selected).parent().attr("tabIndex"));   // the index is stored at parent
    let selectImmediately = isTMTWindow ? true : false;
    let restored = getCurrentRow().tabs[index];
    if (!restored)
        return;

    // create the tab and create tabData manually
    chrome.tabs.create({
        url: restored.URL[restored.URL.length - 1],
        selected: selectImmediately,
        active: selectImmediately,
        pinned: restored.pinned
    }, function (tab) {
        let tabId = tab.id;
        allTabs[tabId] = new tabData(tab);
        allTabs[tab.id].title = restored.title;
        allTabs[tab.id].favIconURL = restored.favIconURL;

        //tabRegistryRef.push(tab.id);
        // Row id = 2 no longer exists
        let removal = false;
        // if tab is pinned do not remove from TMT
        // ignore pin if it is in the rc column
        let currentRowId = columns.getCurrentRowId();
        if ((!restored.pinned) && (currentRowId != 2) || currentRowId == 3) {
            columns.removeTabInRow(index);
            removal = true;
        }

        // add new tab to tab area
        createTabIcon(tabId);
        // place it at the end
        maxTabIconOrder++;
        $("#tab" + tabId).attr("order", maxTabIconOrder);
        placeTabIcon(tabId);

        // remove tmt icon, if callback asks to
        if (removal) {
            removeTMTTab(tmttab);
        }
        // scroll to it
        adjustInnerArea();
        let innerarea = $("#innertabarea");
        let width = parseInt(innerarea.css("width").replace('px', ''));

        moveInnerArea(-0.125 * width, 6);
    });
}

// remove TMT tab via context menu
function onTabRemove(e) {
    e.stopPropagation();
    e.preventDefault();
    let tmtmenu = $("#tmtcontextmenu");
    let index = parseInt(tmtmenu.attr("tabIndex"));
    columns.removeTabInRow(index);
    removeTMTTab($('#tmt' + index));
}

//
// context menu stuffs
//

function onTabContextMenu(e) {
    e.stopPropagation();
    e.preventDefault();
    $("#tabcontextmenu").attr("style", "top:" + e.pageY + "px;");
}

function onTMTContextMenu(e) {
    e.stopPropagation();
    e.preventDefault();
    let selected = e.currentTarget;
    let index = parseInt($(selected).parent().attr("tabIndex"));   // the index is stored at parent
    $("#tmtcontextmenu").attr("style", "top:" + e.pageY + "px;").attr("tabIndex", index);
}

function cancelTMTContextMenu() {
    $(".cmMenu").attr("style", "top:" + 600 + "px;");
}

//
// changing TMT columns
//
function clearTMTArea() {
    // remove all existing tmt tabs
    $(".tmttab").remove();
    /*
    var tmttabs = $(".tmttab");
    for (var i=0; i<tmttabs.length; ++i) {
        $(tmttabs[i]).remove();
    }*/

    // remove controls too
    $("#tmtaddrowbutton").hide();//css("display", "none");
    $("#tmtremoverowbutton").hide();//css("display", "none");
    $("#tmtconfirm").hide();//css("display", "none");

    // scroll it back up there
    moveTMTArea(1000, 4);
}

// Fill TMT column
function fillTMTArea() {
    currentRow = getCurrentRow();
    const rowLabel = $("#tmtrowlabel");
    // tool tip
    rowLabel.attr("title", columns.getCurrentRowTip());
    if (currentRow.id == 3)
        rowLabel.text(currentRow.name);
    else
        rowLabel.text(currentRow.name + ' (' + currentRow.tabs.length + ')');

    // in advanced mode no need to show tips, show row controls instead
    resetTMTControls();

    // populate with tabs inside row
    for (var i = 0; i < currentRow.tabs.length; i++) {
        createTMTTab(i);
    }
}

function clearAllTMTTabs(e) {
    // special one to clear everything for recently closed tabs
    currentRow = getCurrentRow();

    let rowLength = currentRow.tabs.length;
    for (let i = 0; i < rowLength; i++) {
        let tmttab = $("#tmt" + i);
        tmttab.remove();
        columns.removeTabInRow(0);
    }

    clearTMTArea();
    fillTMTArea();
}

function addTMTRow() {
    // default to "New Column 1", user can click to rename
    let name = getMessage("newColumn");
    if (name) {
        columns.addRow(name, "Custom Column");
        clearTMTArea();
        fillTMTArea();
        askRenameTMTRow();
    }
}
// tmtrowlabelinput is a global generated based on element id
function askRenameTMTRow() {
    currentRow = getCurrentRow();

    if (currentRow.id > 3) {
        tmtrowlabelinput.style.display = "block";
        tmtrowlabelinput.value = currentRow.name;
        tmtrowlabelinput.focus();
        tmtrowlabelinput.selectionStart = 0;
        tmtrowlabelinput.selectionEnd = tmtrowlabelinput.value.length;
    }
}

function cancelRenameTMTRow() {
    $(tmtrowlabelinput).hide();
}

function renameTMTRow(e) {
    switch (e.which) {
        case 27:
            cancelRenameTMTRow();
            return;

        case 13:
            setTimeout(function () {
                $(tmtrowlabelinput).hide();
            }, 100);

            currentRow = getCurrentRow();
            let name = tmtrowlabelinput.value;
            if (name && name != currentRow.name) {
                columns.renameRow(currentRow.id, name);
                clearTMTArea();
                fillTMTArea();
            }
    }
}

function removeTMTRow() {
    columns.removeRow();
    clearTMTArea();
    fillTMTArea();
}

// select next row
function nextTMTRow() {
    columns.nextRow();
    clearTMTArea();
    fillTMTArea();
}
// select previous row
function prevTMTRow() {
    columns.prevRow();
    clearTMTArea();
    fillTMTArea();
}

//
//	main function

var _tabRegistry = {};

var _windowRegistry;

// hash map for tab data

var _tabDataMap = {};
// the correct window that is in focus
var _focusedId;

function filterTabData(tab) {
    if (config.hidePinTab && tab.pinned) {
        // skip the tab
        return;
    }
    allTabs[tab.id] = new tabData(tab);
}

function initBackgroundData(callback) {
    if (isTMTWindow) {
        // tmt window, get the window Id of the TMT window
        chrome.windows.getCurrent(null, function (win) {
            tmtWindowId = win.id;
            populateWins(callback);
        });
    } else {
        populateWins(callback);
    }
}

function getCurrentRow() {
    return columns.getCurrentRow();
}

function populateWins(callback) {

    //_windowRegistry = [];

    if (config.crosswindow) {
        chrome.windows.getAll({
            populate: true
        }, function (windows) {
            windows.forEach(function (win) {
                // the tab can be open as a new tab
                //if (tmtWindowId == win.id)
                //return;
                if (win.focused) {
                    _focusedId = win.id;
                }
                //_windowRegistry.push(win.id);
                win.tabs.forEach(function (tab) {
                    filterTabData(tab);
                });
                // console.log(allTabs);
            });
            // data is ready
            callback();
        });
    } else {
        if (tmtWindowId) {
            chrome.storage.session.get("lastFocusId").then((result) => {
                // populate the last focused window that open the window
                chrome.windows.get(result.lastFocusId, {
                    populate: true
                }, function (win) {
                    _focusedId = win.id;
                    //_windowRegistry.push(win.id);
                    win.tabs.forEach(function (tab) {
                        filterTabData(tab);
                    });
                    // data is ready
                    callback();
                });
            });
        } else {
            chrome.windows.getCurrent({
                populate: true
            }, function (win) {
                _focusedId = win.id;
                //_windowRegistry.push(win.id);
                win.tabs.forEach(function (tab) {
                    filterTabData(tab);
                });
                // data is ready
                callback();
            });
        }
    }
}


// select tab inside current window or other window
// if other window is minimized, must focus the window first then select the tab
// need to use background because the popup will close when focus is gone
// function selectTab(tabId, windowId, currentWinId) {
//     console.log('selectTab', tabId, windowId, currentWinId);

function selectTab(tabData, currentWinId) {
    // console.log('selectTab', tabData, currentWinId);

    // exlcude system tabs
    if (!tabData || !tabData.id || !tabData.windowId)
        return;

    // dont care just try
    var _select = function () {
        chrome.tabs.update(tabData.id, {
            active: true,
            highlighted: true
        }, function (tab) {
            // console.log('selectTab', tab);
            if (tab.active || tab.highlighted)
                closeAllViews();
            else {
                console.error('cannot focus tab', tabData.id);
            }
        });
    }
    // the tab to select is inside the window
    var isInActiveWindow = tabData.windowId == currentWinId;
    if (isInActiveWindow) {
        _select();
    } else {
        chrome.windows.update(tabData.windowId, {
            focused: true
        }, function (win) {
            _select();
        });
    }
}

function closeAllViews() {
    var tabs = chrome.extension.getViews({ type: 'tab' });
    tabs.push.apply(tabs, chrome.extension.getViews({ type: 'popup' }));

    tabs.forEach(function (view) {
        // do not refresh options page
        if (view.location.href.indexOf('popup.html') > 0)
            view.close();
    });
}

// descending sort
function sortTabId(a, b) { return b - a; }

// if this is a window not a popup, there would be some difference in the logic
var isTMTWindow = false;
function main() {

    // console.log('Version {{version}}');
    isTMTWindow = window.location.search.indexOf("tmtwindow") > 0;
    //localization
    $("#findlabel").text(getMessage("find"));
    $("#searchbox").attr("title", getMessage("justTypeIn"));
    $("#optionlabel").text(getMessage("options"));
    $("#optionlabel").attr("title", getMessage("openOptionPage"));
    // $("#importlabel").text(getMessage("importAndExport"));
    // $("#importlabel").attr("title", getMessage("openImportAndExportPage"));
    $("#sortbynamebutton").attr("title", getMessage("sortByName"));
    $("#sortbyaddressbutton").attr("title", getMessage("sortByAddress"));
    $("#sortbytimebutton").attr("title", getMessage("sortByTime"));
    $("#sortbytimebutton").attr("title", getMessage("sortByTime"));

    $("#logoarea").attr("title", getMessage("updateNotes"));
    $("#tmtleftarrow").attr("title", getMessage("previousColumn"));
    $("#tmtrightarrow").attr("title", getMessage("nextColumn"));
    $("#contextmenuremove").text(getMessage("remove"));

    $("#contextmenucancel").text(getMessage("cancel"));
    $("#capturenmenucancel").text(getMessage("cancel"));

    $('#tmtaddcol').attr('title', getMessage("addNewColumn"));
    $('#tmtdelcol').attr('title', getMessage("removeThisColumn"));
    $('#tmtclearcol').attr('title', getMessage("clearAll"));

    $("#confirmQuestionText").text(getMessage("areYouSure"));
    $("#cancelButton").val(getMessage("cancel")).click(function () {
        $('#tmtconfirm').hide();

        if (config.usageMode == 0) {
            $("#tmtrowcontent").show();
        }
    });
    $("#confirmButton").val(getMessage("ok"));


    // NEW: check size setting
    if (config.popupsize == "narrow")
        $("body").attr("style", "width:680px; height:599px;");
    else if (config.popupsize == "small") {
        $("body").attr("style", "width:620px; height:450px;");
        smallMode = true;
    }
    // check version setting
    // if (localStorage["updateread"] && localStorage["updateread"] < MAJOR_VERSION) {
    //     $("#logoarea").show();
    // }

    // load in tab data
    // allTabs = background.tabDataMap;

    // adjust settings in different view mode
    if (config.usageMode == 0) {
        TMTAREA_HEIGHT = 405;
        uparrow.style.top = "140px";
        tmtlistbox.style.top = "165px";
        tmtlistbox.style.height = "405px";
    } else {
        TMTAREA_HEIGHT = 430;
    }

    // add listeners for mouse wheel
    let scrollarea = $("#innertabarea");
    scrollarea[0].addEventListener('mousewheel', mouseWheelMoveInnerArea, false);


    initBackgroundData(function () {
        // calculate inner tab area width
        adjustInnerArea();
        lastSortedOrder = [];
        Object.keys(allTabs).forEach(function (e) { lastSortedOrder.push(parseInt(e, 10)) });
        // create the tab square with preview
        lastSortedOrder.forEach(function (tabId) {
            createTabIcon(tabId);
        });

        // calculate inner tab area width
        //adjustInnerArea(total);

        // sort them in previously stated type of order
        chrome.storage.session.get("lastOrder").then((result) => {

            if (result.hasOwnProperty("lastOrder")) {
                sortTabs(result.lastOrder);
            } else {
                sortTabs("tabid");
            }

            for (var i = 0; i < lastSortedOrder.length; i++) {
                placeTabIcon(lastSortedOrder[i]);
            }

            if (disablePreview) {
                var tabId = $('.tabexterior[order="0"]').attr('tabid');
                var firstTab = $("#tabimg" + tabId);
                firstTab.unbind('click', onTabSelect);
                firstTab.click(onTabContextMenu);
                firstTab[0].src = '/img/plus_screen.png';
            }

            moveInnerArea(0, 0);    // adjust and check arrows

            // fill up toomanytabs area
            fillTMTArea();

            document.getElementById("tmtlistbox").addEventListener('mousewheel', mouseWheelMoveTMTArea, false);

            moveTMTArea(0, 0); // adjust and check arrows

            changeBackground(config.themeColor);

            // put you are here sign
            // fix bug in multi-windows
            if (chrome.tabs.query) {
                chrome.tabs.query({
                    'active': true
                }, function (tabs) {
                    for (var i in tabs) {
                        var tab = $("#tab" + tabs[i].id);
                        if (tab) {
                            $('<div/>', {
                                id: "youareheresign"
                            }).appendTo($("#tab" + tabs[i].id));
                        }
                    }
                });
            } else {
                //decap
                chrome.tabs.getSelected(null, function (tab) {
                    $('<div/>', {
                        id: "youareheresign"
                    }).appendTo($("#tab" + tab.id));
                });
            }
            // focus on searchbox
            $("#searchbox").focus();

        });
    });

    // bind internal events
    /* TODO: upgrade
    chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
        switch (request.command) {
            case "closePopup":
                window.close();
                break;
        }
    });*/

    // replace onblur that tabs to disappear when max
    // select popup when triggered by shortcut (tab refreshed as well)
    // chrome.runtime.sendMessage({
    //     command: "popupLoaded"
    // }, function (response) { });
}

// function onUpdateRead() {
//     var url = 'https://www.visibotech.com/search/label/TMT%20for%20Chrome';
//     chrome.tabs.create({
//         url: url,
//         selected: true
//     });

//     localStorage['updateread'] = MAJOR_VERSION;
//     window.close();
// }

//
// tab area setting/movements
//
function adjustInnerArea() {
    let numDisplayedTabs = $('.tabinterior').length;
    if (maxTabIconOrder) {
        //console.log('adjustInnerArea', maxTabIconOrder, extraTabAreaNeeded);
        numDisplayedTabs = maxTabIconOrder + extraTabAreaNeeded;
    }
    let bestWidth = (Math.ceil((numDisplayedTabs + 1) / 5) + 1) * 180 + 20;
    if (bestWidth < TABAREA_WIDTH)
        bestWidth = TABAREA_WIDTH;
    innertabarea.style.width = bestWidth + "px";
}

function moveInnerArea(delta, times) {
    cancelTMTContextMenu();

    let leftArrow = $("#leftarrow");
    let rightArrow = $("#rightarrow");
    // var area = document.getElementById("innertabarea");
    let originalLeft = parseInt(innertabarea.style.left.replace('px', ''));
    let newLeft = originalLeft + delta;
    let width = parseInt(innertabarea.style.width.replace('px', ''));

    let scrollNeeded = (width > TABAREA_WIDTH);

    if (!scrollNeeded) {
        leftArrow.attr("disabled", true);
        rightArrow.attr("disabled", true);
    } else {
        leftArrow.attr("disabled", false);
        rightArrow.attr("disabled", false);
    }
    if (newLeft < TABAREA_WIDTH - width) {  // left extremum;
        newLeft = TABAREA_WIDTH - width;
        rightArrow.attr("disabled", true);
    }
    if (newLeft >= 0) {
        newLeft = 0;
        leftArrow.attr("disabled", true);
    }

    innertabarea.style.left = newLeft + "px";
    if (times != 0)
        setTimeout(function () {
            moveInnerArea(delta, times - 1);
        }, 50);

}

function mouseWheelMoveInnerArea(e) {
    if (smallMode == true) return;
    moveInnerArea(e.wheelDelta / 10, 4);
}

// tmt column moving

function moveTMTArea(delta, times) {
    cancelTMTContextMenu();

    //var upArrow = document.getElementById("uparrow");
    //var downArrow = document.getElementById("downarrow");
    //var area = document.getElementById("innertmtarea");
    let originalTop = $(innertmtarea).position().top; // parseInt(area.style.top.replace('px',''));
    let newTop = originalTop + delta;
    let height = $(innertmtarea).height();// parseInt(document.defaultView.getComputedStyle(area).getPropertyValue("height").replace('px',''));

    let scrollNeeded = (height > TMTAREA_HEIGHT);

    if (!scrollNeeded) {
        uparrow.setAttribute("disabled", "true");
        downarrow.setAttribute("disabled", "true");
    } else {
        uparrow.setAttribute("disabled", "false");
        downarrow.setAttribute("disabled", "false");
    }

    if (newTop < TMTAREA_HEIGHT - height) {        // top extremum
        newTop = TMTAREA_HEIGHT - height;
        downarrow.setAttribute("disabled", "true");
    }
    if (newTop >= 0) {
        newTop = 0;
        uparrow.setAttribute("disabled", "true");
    }

    innertmtarea.style.top = newTop + "px";
    if (times != 0)
        setTimeout(function () {
            moveTMTArea(delta, times - 1);
        }, 50);
}

function mouseWheelMoveTMTArea(e) {
    moveTMTArea(e.wheelDelta / 10, 4);
}

function changeBackground(code) {
    switch (code) {
        case 0:
            basebox.setAttribute("style", "background:-webkit-gradient(linear, left top, left bottom, from(#00abeb), to(rgba(45,72,101,1)));");
            break;
        case 1:
            basebox.setAttribute("style", "background:-webkit-gradient(linear, left top, left bottom, from(#CCCCCC), to(#4F6D80));");
            break;
        case 2:
            basebox.setAttribute("style", "background:-webkit-gradient(linear, left top, left bottom, from(#f8ae32), to(#Af6e00));");
            break;
        case 3:
            basebox.setAttribute("style", "background:#E6E6E6");
            break;
        case 4:
            basebox.setAttribute("style", "background:-webkit-gradient(linear, left top, left bottom, from(#444455), to(#000000));");
            break;
        case 5:
            var firstColor = config.customThemeColor1;
            var secondColor = config.customThemeColor2;
            basebox.setAttribute("style", "background:-webkit-gradient(linear, left top, left bottom, from(#" + firstColor + "), to(#" + secondColor + "));");
            break;
    }
    chrome.storage.local.set({ "themeColor": code });
}

// null for no sort, or sort by title/url
var colSortState;

function sortTMTColumn(sort) {
    let unsort = colSortState && colSortState == sort;
    clearTMTArea();
    fillTMTArea();

    if (unsort) {
        return;
    }

    // first time or switch state
    let title;
    if (sort == 'title') {
        $('#tmtsortaz').css('opacity', 1);
        $('#tmtsortcom').css('opacity', '');
        //$('#tmtsortaz').attr('selected', true);
        title = getMessage('searchTitle');
    } else {
        $('#tmtsortcom').css('opacity', 1);
        $('#tmtsortaz').css('opacity', '');
        //$('#tmtsortcom').attr('selected', true);
        title = getMessage('searchURL');
    }

    $('#tmtfilter').val('').attr('title', title);
    $('#tmtcolfilterWrap').show();
    $("#tmtrowcontent").hide();

    colSortState = sort;
    let mylist = $('#tmtlistbox');
    let listitems = mylist.find('.tmttab');

    listitems.sort(function (a, b) {
        var compA;
        var compB;
        if (sort == 'title') {
            compA = $(a).text().toUpperCase();
            compB = $(b).text().toUpperCase();
        } else {
            compA = $(a).attr('link').toUpperCase();
            compB = $(b).attr('link').toUpperCase();
        }
        return (compA < compB) ? -1 : (compA > compB) ? 1 : 0;
    })
    $.each(listitems, function (idx, itm) {
        mylist.append(itm);
    });
    // focus at last
    $('#tmtfilter').focus();
}

// filter column by title or url
function filterCol() {

    let searchTerm = $("#tmtfilter").val().trim();

    let mylist = $('#tmtlistbox');
    let listitems = mylist.find('.tmttab');
    listitems.show();
    listitems.filter(function (index, element) {
        let re = new RegExp(searchTerm, 'ig');
        let match = false;
        if (colSortState == 'title') {
            match = re.test($(element).text());
        } else {
            match = re.test($(element).attr('link'));
        }
        if (!match) {
            $(element).hide();
        }
        return element;
    });
}

// centralize the button action
function tmtController(action) {

    $("#tmtrowcontent").hide();
    $('#tmtcolfilterWrap').hide();

    //console.log('tmtController', action);
    switch (action) {
        case 'tmtaddcol':
            addTMTRow();
            break;
        case 'tmtdelcol':
            if (currentRow.id <= 3) return;
            $("#tmtconfirm").show();
            confirmButton.onclick = removeTMTRow;
            break;
        case 'tmtclearcol':
            $("#tmtconfirm").show();
            confirmButton.onclick = clearAllTMTTabs;
            break;
        case 'tmtsortaz':
            sortTMTColumn('title');
            break;
        case 'tmtsortcom':
            sortTMTColumn('com');
            break;
    }
}

// change to reset controls
function resetTMTControls() {
    // hide the text filter
    $('#tmtcolfilterWrap').hide();
    // reset sort state
    colSortState = null;
    // remove opacity rules
    $('#tmtrowbuttons img').css('opacity', '');

    // hide/show controls based on usage mode
    if (config.usageMode == 0) {
        // hide & del col button
        $('#tmtaddcol').hide();
        $('#tmtdelcol').hide();
        $("#tmtrowcontent").text(columns.getCurrentRowTip()).show();
        $('#tmtrowbuttons').attr('center', true);
    } else {
        // custom row mode
        $('#tmtaddcol').show();
        $('#tmtdelcol').show();
        if (currentRow.id <= 3) {
            $('#tmtdelcol').hide();
        } else {
            $('#tmtdelcol').show();
        }
        $("#tmtrowcontent").hide();
        $('#tmtrowbuttons').removeAttr('center');
    }
}

function CloseDuplicates() {

    var tmtWins = chrome.extension.getViews({
        type: 'tab'
    });
    tmtWins.forEach(function (win) {
        // also close options now
        if (win != window) {
            // console.log("window ", win);
            win.close();
        }
    });
    // chrome.tabs.getCurrent(
    //     function (tabs) {

    //     }
    // );
}

// Access the version number from the manifest, 2.4 now
var majorVersion = 2.4;
var disablePreview;
$(document).ready(function () {
    CloseDuplicates();

    $('body').click(function () {
        cancelTMTContextMenu();
    });

    searchbox.onkeyup = findTabsCommand;
    $(searchbox).keypress(function (event) { return event.keyCode != 13; });

    $('#sortbynamebutton').click(function () {
        sortTabsCommand('name');
    });

    $('#sortbyaddressbutton').click(function () {
        sortTabsCommand('domain');
    });

    $('#sortbytimebutton').click(function () {
        sortTabsCommand('tabid');
    });

    $(optionlabel).click(function () {
        chrome.runtime.openOptionsPage();
        // window.close();
    });

    // $(importlabel).click(function () {
    //     chrome.tabs.create({
    //         url: '/core/import.html'
    //     });
    //     window.close();
    // });

    toolbararea.onselectstart = function () {
        return false;
    };

    // $(logoarea).click(function(){
    //     onUpdateRead();
    // });

    $('.colorbutton').click(function () {
        var color = parseInt($(this).attr('to'));
        changeBackground(color);
    });

    tabarea.onselectstart = function () {
        return false;
    };
    $(leftarrow).click(function () {
        moveInnerArea(55, 6);
    });
    $(rightarrow).click(function () {
        moveInnerArea(-55, 6);
    });
    $(tmtleftarrow).click(function () {
        prevTMTRow();
    });
    tmtrowlabel.onselectstart = function () {
        return false;
    };
    $(tmtrowlabel).click(function () {
        askRenameTMTRow();
    });

    $(tmtrowlabelinput).keypress(function (e) {
        renameTMTRow(e);
    }).blur(function () {
        renameTMTRow({
            which: 13
        });
    });

    $(tmtrightarrow).click(function () {
        nextTMTRow();
    });

    tmtColControlsWrapper.onselectstart = function () {
        return false;
    };
    // confirm this one
    $('#tmtrowbuttons > img').click(function () {
        tmtController(this.id);
    });

    tmtfilter.onkeyup = filterCol;

    $(uparrow).click(function () {
        moveTMTArea(25, 6);
    });

    tmtlistbox.onselectstart = function () {
        return false;
    };
    $(downarrow).click(function () {
        moveTMTArea(-25, 6);
    });
    $(contextmenuremove).click(function (event) {
        onTabRemove(event);
        cancelTMTContextMenu();
    });

    $(contextmenucancel).click(function (event) {
        cancelTMTContextMenu();
    });


    chrome.permissions.contains({
        //permissions:["<all_urls>"]
        origins: ['<all_urls>']
    }, function (result) {
        if (result) {
            // The extension has the permissions.
            disablePreview = false;
        } else {
            disablePreview = true;
            $(enableCapture).click(function (event) {
                chrome.permissions.request({
                    origins: ['<all_urls>']
                }, function (granted) {
                    disablePreview = !granted;
                    // chrome.runtime.reload();
                    // if (granted) {
                    //     alert("Screen will be captured when active tab is updated");
                    // }
                });
                cancelTMTContextMenu(event);
            });
        }
        // console.log("has permission " + result);
    });

    // show later
    $('#hintbox').hide();
    $('#versionText').text(majorVersion);

    let keys = ["migratedV3", "rowDataMap", "currentRowId", "usageMode", "welcomeshown", "updateread",
        "popupsize", "hidePinTab",
        "crosswindow", "themeColor",
        "customThemeColor1",
        "customThemeColor2"];

    chrome.storage.local.get(keys).then((result) => {

        if (!result.hasOwnProperty("migratedV3")) {
            console.log("migrate options");
            // import the options from localStorage
            config = InitOptions(keys, localStorage, true);
            config.migratedV3 = true;
            // save the config now
            chrome.storage.local.set(config);
        } else {
            console.log("use storage options");
            config = InitOptions(keys, result, false);
        }
        columns = new TMTColumns(result);
        // current options
        main();
        // show first launch
        if (!config.welcomeshown) {
            try {
                var welcomeURL = 'https://www.visibotech.com/search/label/TMT%20for%20Chrome';
                //"https://www.visibotech.com/2010/01/thank-you-for-installing-toomanytabs.html";
                // show migration page update page
                chrome.tabs.create({
                    url: welcomeURL
                }, function () {
                    chrome.storage.local.set({ "welcomeshown": true, "updateread": majorVersion });
                });
            }
            catch (e) {
                console.error(e);
            }
        } else if (config.updateread != majorVersion) {

            // new version is found
            if (result.updateread < majorVersion) {
                $('#hintbox').show();

                $('#hintClick').click(function () {
                    chrome.storage.local.set({ "welcomeshown": true, "updateread": majorVersion });
                    $('#hintbox').hide();
                });

                // only go to the tab when users want to see it the details
                $('#hintClickView').click(function () {
                    $('#hintbox').hide();
                    chrome.storage.local.set({ "welcomeshown": true, "updateread": majorVersion });
                    var url = 'https://www.visibotech.com/search/label/TMT%3Aupdate';
                    chrome.tabs.create({
                        url: url,
                        selected: true
                    });
                    window.close();
                });
            }
        }
    });

    // if need to refresh the page
    // chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    //     // Process the message or respond if needed
    //     if (message.refresh) {
    //         window.location.reload();
    //     }
    // });
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (changes.hasOwnProperty("rowDataMap")
        ||  changes.hasOwnProperty("crosswindow")) {
            // refresh
            window.location.reload();
        }
    });
});