//// WARNINGN!!!!!!!!!!!!!!!!!!!!!!
////  Never use JQuery on Checkbox
////
//// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

function ToggleCapture() {
    //var enable = $('#disablePreview').is(":checked");

    if ($('#disablePreview').is(":checked")) {
        //console.log("request");
        chrome.permissions.request({
            origins: ['<all_urls>']
        }, function (granted) {
            // The callback argument will be true if the user granted the permissions.
            if (granted) {
                disablePreview.checked = false;
            } else {
                disablePreview.checked = true;
                // clear when popup up open
                // clearCaptures();
            }
        });
    }
    else {
        //console.log("remove");
        chrome.permissions.remove({
            origins: ['<all_urls>']
        }, function (removed) {
            console.log("remove permission", removed);
            if (removed) {
                // The permissions have been removed.
                disablePreview.checked = true;
                // clearCaptures();
            } else {
                // permission remove, the capture is disable
                // The permissions have not been removed (e.g., you tried to remove
                // required permissions).
                disablePreview.checked = false;
            }
        });
    }
}
/*

https://developer.chrome.com/apps/permissions
request the all_url permission when users enable thumbnail
*/

// Restores select box state to saved value from localStorage.
function restore_options(data) {

    let keys = ["migratedV3", "popupsize", "usageMode", "showcount", "crosswindow", "recentlyClosedMax", "disableContextMenu", "winpopupWidth", "hidePinTab", "customThemeColor1", "customThemeColor2"];

    chrome.storage.local.get(keys).then((data) => {
        let options;
        if (!data.hasOwnProperty("migratedV3")) {
            // from localStorage
            options = InitOptions(keys, localStorage, true);
            options.migratedV3 = true;
            // save the config now
            chrome.storage.local.set(options);
        } else {

            options = InitOptions(keys, data, false);
        }
        widebutton.checked = true;

        if (options.popupsize) {
            switch (options.popupsize) {
                case "narrow":
                    narrowbutton.checked = true;
                    break;
                case "wide":
                    widebutton.checked = true;
                    break;
                case "small":
                    smallbutton.checked = true;
                    break;
            }
        }


        basicbutton.checked = options.usageMode == 0;
        probutton.checked = options.usageMode == 1;

        showcountbutton.checked = options.showcount;
        hidecountbutton.checked = !options.showcount;

        showcrosswindow.checked = options.crosswindow;
        hidecrosswindow.checked = !options.crosswindow;

        $('#maxRcTabs-select').val(options.MAX_RECENT_TABS);

        disableContextMenu.checked = options.disableContextMenu;
        $('#winpopupWidth').val(options.winpopupWidth);


        $('#hidePinTab').attr('checked', options.hidePinTab);
        customColor1.value = options.customThemeColor1;
        customColor2.value = options.customThemeColor2;

    });

    // disble context menu options
    // $('#disableContextMenu').attr("checked", localStorage["disableContextMenu"] == "true");

    $('#disableContextMenu').change(function () {

        let disableCM = isChecked(this);
        chrome.storage.local.set({ "disableContextMenu": disableCM });
        ToggleContextMenu(disableCM);
    });

    $('#winpopupWidth').change(function () {
        var width = parseInt($('#winpopupWidth').val());
        if (!isNaN(width)) {
            chrome.storage.local.set({ "winpopupWidth": width });
        }
    });

    $('#hidePinTab').change(function () {
        //console.log($(this).attr("checked"));
        chrome.storage.local.set({ "hidePinTab": isChecked(this) });
    });
    // bugged, .color is undefined
    //   customColor1.color.fromString(localStorage["customThemeColor1"]?localStorage["customThemeColor1"]:"ffffff");
    //   customColor2.color.fromString(localStorage["customThemeColor2"]?localStorage["customThemeColor2"]:"7777ff");
}

function isChecked(node) {
    // dont use jquery
    return node.checked;//$(node).attr("checked") == 'checked' || $(node).attr("checked") == 'true';
}

function init() {
    // function in core.js
    $('#pagetitle').text(getMessage("optionsPageTitle"));
    $('#welcomemessage').html(getMessage("welcomeMessage"));

    $('#popupWidth').text(getMessage("popupWidth"));
    $('#popupWidth1').text(getMessage("popupWidth1"));
    $('#popupWidth2').text(getMessage("popupWidth2"));
    $('#popupWidth3').text(getMessage("popupWidth3"));

    $('#showTabCount').text(getMessage("showTabCount"));
    $('#showTabCount1').text(getMessage("optionsYes"));
    $('#showTabCount2').text(getMessage("optionsNo"));

    $('#crossWindow').text(getMessage("crossWindow"));
    $('#crossWindow1').text(getMessage("crossWindow1"));
    $('#crossWindow2').text(getMessage("crossWindow2"));
    $('#crossWindow3').text(getMessage("crossWindow3"));

    $('#customThemeColor').text(getMessage("customThemeColor"));

    $('#advancedFeatures').text(getMessage("advancedFeatures"));
    $('#customRows1').text(getMessage("customRows1"));
    $('#customRows2').text(getMessage("customRows2"));
    $('#customRows3').text(getMessage("customRows3"));

    // $('#shortcut1').text(getMessage("shortcut1"));
    // $('#shortcut2').text(getMessage("shortcut2"));
    $('#shortcut3').text(getMessage("shortcut3"));

    $('#quickSupport').html(getMessage("quickSupport"));
    $('#quickSupport1').html(getMessage("quickSupport1"));
    $('#quickSupport2').html(getMessage("quickSupport2"));

    $('#donateBtn').html(getMessage("supportMsg"));

    $('#maxRcTabs').text(getMessage("recentClosedMsg"));

    $('#disablePreviewLabel').text(getMessage('disablePreviewLabel'));

    $('#disablePreviewTip').text(getMessage('disablePreviewTip'));

    $('#disableContextMenuLabel').text(getMessage('disableContextMenuLabel'));

    $('#winpopupWidthLabel').text(getMessage('winpopupWidthLabel'));

    $('#hidePinTabLabel').text(getMessage('hidePinTabLabel'));

    let manifest = chrome.runtime.getManifest();
    // Access the version number from the manifest, not the same major version
    $('#versionNum').text(manifest.version);

    // NEW FUNCTION, Import and Export inside options directly
    $("#importAndExportlabel").text(getMessage("importAndExport"));
    $("#exportlabel").val(getMessage("exportBackup"));
    $("#importJson").val(getMessage("importButton"));

    chrome.permissions.contains({
        //permissions:["<all_urls>"]
        origins: ['<all_urls>']
    }, function (result) {
        if (result) {
            // The extension has the permissions.
            disablePreview.checked = false;
        } else {
            disablePreview.checked = true;
            // clearCaptures();
        }
        // console.log("has permission " + result);
    });
}

function InitClickHandlers() {
    $('#disablePreviewButton').click(ToggleCapture);

    $('#disablePreview').click(function () { return false; });

    // shortcutkey.onchange=function(){
    //     localStorage['shortcut']= this.value;
    // };

    $(widebutton).click(function () {
        // localStorage['popupsize'] = 'wide';
        chrome.storage.local.set({ "popupsize": "wide" });
    });
    $(narrowbutton).click(function () {
        // localStorage['popupsize'] = 'narrow';
        chrome.storage.local.set({ "popupsize": "narrow" });
    });
    $(smallbutton).click(function () {
        // localStorage['popupsize'] = 'small';
        chrome.storage.local.set({ "popupsize": "small" });
    });

    $(showcountbutton).click(function () {
        chrome.storage.local.set({ "showcount": true });
        // localStorage['showcount'] = 'true';
        reportNumTabs();
    });

    $(hidecountbutton).click(function () {
        chrome.storage.local.set({ "showcount": false });
        // localStorage['showcount'] = 'false';
        reportNumTabs();
    });

    $('#maxRcTabs-select').change(function () {
        chrome.storage.local.set({ "recentlyClosedMax": this.value });
    });

    $(customColor1).change(function () {
        chrome.storage.local.set({ "customThemeColor1": this.color.toString() });
    });

    $(customColor2).change(function () {
        chrome.storage.local.set({ "customThemeColor2": this.color.toString() });
    });
    $(basicbutton).click(function () {
        UpdateUsageMode(0);
    });
    $(probutton).click(function () {
        UpdateUsageMode(1);
    });

    $(showcrosswindow).click(function () {
        chrome.storage.local.set({ "crosswindow": true });
        // chrome.runtime.sendMessage({ "refresh": true });
    });
    $(hidecrosswindow).click(function () {
        chrome.storage.local.set({ "crosswindow": false });
        // chrome.runtime.sendMessage({ "refresh": true });
    });

    $(exportlabel).click(function () {
        chrome.storage.local.get(["rowDataMap", "usageMode", "currentRowId"]).then((result) => {
            result.version = 2.4;
            saveJsonToFile(result, "tmtBackup");
        });
    });
    $(importJson).click(function () {
        handleFile();
    });


    let oldExportButton = $(exportOldlabel);

    if (!localStorage.rowDataMap) {
        // only show when there is data inside localStorage
        oldExportButton.hide();
    }
    else {
        //export exisiting localstorage data to a file
        $(exportOldlabel).click(function () {
            var result =
            {
                version: 2.3,
                rowDataMap: JSON.parse(localStorage.rowDataMap),
                usageMode: localStorage.usageMode,
                currentRow: localStorage.currentRowId
            };
            saveJsonToFile(result, "tmtLocalStorage");
        });
    }
}

$(document).ready(function () {
    // closeOtherView();
    $('#MigrateNote').hide();
    chrome.storage.local.get(["migratedV3", "popupsize", "usageMode", "showcount", "crosswindow", "recentlyClosedMax", "disableContextMenu", "winpopupWidth", "hidePinTab", "customThemeColor1", "customThemeColor2"]).then((data) => {
        console.log("migratedV3 " + data.migratedV3);
        init();
        restore_options(data);
        InitClickHandlers();
    });
});

function ToggleContextMenu(disableCM) {
    if (disableCM) {
        //no context menu
        chrome.contextMenus.removeAll();
        // chrome.runtime.sendMessage({ "refresh": true });
    } else {
        // regenerate context menu
        chrome.storage.local.get(["rowDataMap"]).then((col) => {
            var columns = new TMTColumns(col.rowDataMap);
            prepareContextMenu(columns, true);
            // chrome.runtime.sendMessage({ "refresh": true });
        });
    }
}

// rowDataMap might not be loaded
function UpdateUsageMode(mode) {
    chrome.storage.local.set({ "usageMode": mode });
    // cannot change unless only the susupended column is left??
    chrome.storage.local.get(["disableContextMenu"]).then((result) => {
        ToggleContextMenu(IsFalseOrNull(result, "disableContextMenu"));
    });
}

function saveJsonToFile(jsonData, fileName) {
    // Convert JSON to string
    var jsonStr = JSON.stringify(jsonData, null, 2);

    // Create a Blob object with the JSON data
    var blob = new Blob([jsonStr], { type: 'text/plain' });

    // Create a URL for the Blob
    var url = URL.createObjectURL(blob);

    // Create a download link
    var downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = fileName + '.json';

    // Append the link to the body
    document.body.appendChild(downloadLink);

    // Trigger the click event on the link
    downloadLink.click();

    // Clean up
    URL.revokeObjectURL(url);
    document.body.removeChild(downloadLink);
}

function handleFile() {
    // Get the file input element
    var fileInput = document.getElementById('fileInput');

    // Check if files were selected
    if (fileInput.files.length > 0) {
        // Get the selected file
        var file = fileInput.files[0];

        // Create a FileReader object
        var reader = new FileReader();

        // Set up event handler for when the file is loaded
        reader.onload = function (event) {
            // Get the file content as text
            var fileContent = event.target.result;

            // Process the file content
            // console.log(fileContent);
            let importedRowDataMap = JSON.parse(fileContent);

            if (importedRowDataMap) {
                console.log(importedRowDataMap);
                chrome.storage.local.set({
                    "rowDataMap": importedRowDataMap.rowDataMap,
                    "usageMode": 0,
                    "currentRowId": 0
                }).then(() => {
                    alert(getMessage("importedSuccessfully"));
                    // window.location.reload();
                });
            }
            // You can parse the file content as JSON or perform other operations here
        };
        // Read the file as text
        reader.readAsText(file);
    } else {
        // console.log("No file selected.");
        alert(getMessage("backupNotFound"));
    }
}
