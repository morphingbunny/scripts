//googleclient/chrome/apps/user_agent_spoofer/spoofer.js
// String identifiers for use in hashes.
const CUSTOM_OPTIONS_IDENTIFIER = 'custom_options_list';
const SPOOF_OPTIONS_IDENTIFIER = 'spoofer_list';
const USE_SYNC = 'use_sync';
const USE_SPOOF_PER_TAB = 'use_per_tab';
const PERMANENT_OVERRIDE = 'permanent_override';
const NO_SPOOF_PER_TAB = 'no_spoof';

const MANAGED_GROUP_NAME = 'Managed';

let storage_location_for_testing = null;

// The sync storage API has throttling limits, this is to minimize the potential
// of throttling on import.
const MAX_IMPORT_COUNT = 450;

const CUSTOM_OPTIONS_LIST_PREFIX = 'c_';
const SPOOF_OPTIONS_LIST_PREFIX = 's_';
const MANAGED_USER_AGENT_LIST_PREFIX = 'cm_';
const MANAGED_SPOOF_LIST_PREFIX = 'sm_';

function deepEquals(a, b) {
  if (typeof a !== typeof b) {
    return false;
  }
  if (a === null || b === null) {
    return a === b;
  }
  if (a instanceof Array) {
    return b instanceof Array && a.length === b.length &&
        a.every((x, i) => deepEquals(x, b[i]));
  }
  if (typeof a === 'object') {
    return deepEquals(Object.keys(a).toSorted(), Object.keys(b).toSorted()) &&
        Object.entries(a).every(([k, v]) => deepEquals(v, b[k]));
  }
  return a === b;
}

/**
 * Object that encapsulates a user-agent. Makes passing around a set of values
 * related to a user-agent much easier.
 */
class UserAgent {
  /**
   * @param {string} title
   * @param {string} ua_string
   * @param {string} vendor_string
   * @param {string} badge
   * @param {boolean} is_preset
   * @param {string} group
   */
  constructor(title, ua_string, vendor_string, badge, is_preset, group) {
    this.title = title;
    this.ua_string = ua_string;
    this.vendor = vendor_string;
    this.badge = badge;
    this.is_preset = is_preset;
    this.append_to_default_ua = false;
    this.group = group;
    this.is_managed = false;
    this.key = '';
  }
}

class PresetSpoof {
  /**
   * @param {string} domain
   * @param {string} user_agent
   */
  constructor(domain, user_agent) {
    this.domain = domain;
    this.user_agent = user_agent;
    this.is_managed = false;
    this.key = '';
  }
}

// Migrates all data from chrome.storage.sync to chrome.storage.local, then
// sets `use_sync` to false.
function maybeMigrateSyncToLocal() {
  return new Promise(resolve => {
    chrome.storage.local.get('use_sync', ({use_sync}) => {
      if (!use_sync) {
        // Not using Sync, don't need to migrate anything.
        resolve();
        return;
      }
      console.log('Migrating sync storage to local storage...');
      chrome.storage.sync.get(sync => {
        chrome.storage.local.set({...sync, use_sync: false}, () => {
          console.log('Data successfully migrated from sync to local.');
          resolve();
        });
      });
    });
  });
}


// Wipes all settings.  Usually useful for catastrophic data corruption.
async function resetEverything() {
  const managed = await getIsOtherSettingsManaged();
  if (managed) {
    return;
  }
  await getStorageLocation().set({
    [SPOOF_OPTIONS_IDENTIFIER]: [],
    [CUSTOM_OPTIONS_IDENTIFIER]: [],
  });
}

function getStorageLocation() {
  return storage_location_for_testing || chrome.storage.local;
}

/*****************************************************************************/
/* Configuration getter/setter methods                                       */
/*****************************************************************************/

// Sets whether spoofs are across all tabs or only for the current active tab.
async function setSpoofPerTab(spoof_per_tab) {
  const managed = await getSpoofPerTabManaged();
  if (managed != null) {
    return;
  }
  // Clear out any settings per tab.
  await clearHotlistMap();
  await chrome.storage.local.set({[USE_SPOOF_PER_TAB]: spoof_per_tab});
}

async function getSpoofPerTab() {
  const managed = await getSpoofPerTabManaged();
  if (managed != null) {
    return managed;
  }
  return (await chrome.storage.local.get(USE_SPOOF_PER_TAB))[USE_SPOOF_PER_TAB];
}

// Sets whether permanent spoofs override the hot-switch.
async function setPermanentSpoofOverride(permanent_override) {
  const managed = await getSpoofOverrideManaged();
  if (managed != null) {
    return;
  }
  await getStorageLocation().set({[PERMANENT_OVERRIDE]: permanent_override});
}

async function getPermanentSpoofOverride() {
  const managed = await getSpoofOverrideManaged();
  if (managed != null) {
    return managed;
  }
  const items = await getStorageLocation().get(PERMANENT_OVERRIDE);
  return !!items[PERMANENT_OVERRIDE];
}

/*****************************************************************************/
/* Enterprise configuration getter methods                                   */
/*****************************************************************************/

function getIsUserAgentManaged() {
  return chrome.storage.managed.get('EditRights')
      .then(items => (items?.EditRights?.user_agents ?? null));
}

function getIsSpoofManaged() {
  return chrome.storage.managed.get('EditRights')
      .then(items => (items?.EditRights?.permanent_spoofs ?? null));
}

function getIsOtherSettingsManaged() {
  return chrome.storage.managed.get('EditRights')
      .then(items => (items?.EditRights?.other_settings ?? null));
}


function getSpoofOverrideManaged() {
  return chrome.storage.managed.get('OtherSettings')
      .then(items => (items?.OtherSettings?.spoof_override ?? null));
}

function getHotlistEnabledManaged() {
  return chrome.storage.managed.get('OtherSettings')
      .then(items => (items?.OtherSettings?.hotlist_enabled ?? null));
}

function getSpoofPerTabManaged() {
  return chrome.storage.managed.get('OtherSettings')
      .then(items => (items?.OtherSettings?.spoof_per_tab ?? null));
}

/*****************************************************************************/
/* Functions for accessing data from sync storage                            */
/*****************************************************************************/

// Data is stored in chrome.storage as a list of pointers, and those pointers
// point at the data itself.  The size of a single object is capped with
// chrome.storage, so it could not be all saved as one list.

// The two major lists of things to be saved and retrieved are:
// 1. a list of all user-agents
// 2. a list of all hard coded spoofs
// Both of these has its own pointer list.
// Each of the objects stored this way has a "key" field where it saves its
// own pointer, in case you need to access it.

// Most of these functions require callback methods because they rely on
// chrome.storage APIs, which all require callbacks.  This makes them all
// asynchronous, and blocking has to be done at a higher scope than this UI.

async function _getUserAgentPointerList() {
  return getStorageLocation()
      .get(CUSTOM_OPTIONS_IDENTIFIER)
      .then(({[CUSTOM_OPTIONS_IDENTIFIER]: pointers}) => (pointers || []));
}

// Access a User Agent object by its pointer.
function _getUserAgentByKey(key) {
  return getStorageLocation().get(key).then(({[key]: value}) => value);
}

async function _getUserAgentList() {
  const [managed_list, pointer_list] = await Promise.all([
    _getManagedUserAgentList(),
    _getUserAgentPointerList(),
  ]);
  if (!pointer_list || pointer_list.length === 0) {
    return managed_list;
  }
  const user_agent_map = await getStorageLocation().get(pointer_list);
  return managed_list.concat(Object.values(user_agent_map));
}

function _convertRawUAToUserAgent(
    {
      title,
      ua_string,
      vendor,
      badge,
      append,
    },
    i) {
  return Object.assign(new UserAgent(), {
    is_managed: true,
    title,
    ua_string,
    vendor,
    badge,
    append_to_default_ua: append,
    group: MANAGED_GROUP_NAME,
    key: i !== undefined ? MANAGED_USER_AGENT_LIST_PREFIX + i : undefined,
  });
}

async function _getManagedUserAgentList() {
  const raw_uas =
      (await chrome.storage.managed.get('UserAgents'))?.UserAgents || [];
  return raw_uas.map((ua, i) => _convertRawUAToUserAgent(ua, i));
}


// Add a signle user-agent object to storage.
async function _addUserAgent(user_agent) {
  const managed = await getIsUserAgentManaged();
  if (managed) {
    return;
  }
  const pointers = await _getUserAgentPointerList();
  if (!user_agent.key || user_agent.key == '') {
    const max = getMaxSpoofId(pointers);
    user_agent.key = CUSTOM_OPTIONS_LIST_PREFIX + (max + 1);
  }
  // Can't just store the user-agent by itself, we have to
  // create a dict and point one key value to our user-agent object,
  // then save the dict.
  await getStorageLocation().set({
    [user_agent.key]: user_agent,
    [CUSTOM_OPTIONS_IDENTIFIER]: pointers.concat([user_agent.key]),
  });
}

async function _editUserAgent(user_agent) {
  const managed = await getIsUserAgentManaged();
  if (managed || !user_agent?.key) {
    return;
  }
  // no need to update the pointer list, since we're keeping
  // all of our pointers the same.
  await getStorageLocation().set({
    [user_agent.key]: user_agent,
  });
  return user_agent;
}

// Adds multiple user agent objects at once.
// Calls back with a list of the pointers to the user-agent objects added.
async function _addMultipleUserAgents(user_agent_list) {
  if (!user_agent_list || user_agent_list.length === 0) {
    return;
  }
  const managed = await getIsUserAgentManaged();
  if (managed) {
    return;
  }
  const pointer_list = await _getUserAgentPointerList();
  // TODO(nicolaso): getMaxUserAgentId()
  let max = 0;
  if (pointer_list && pointer_list.length > 0) {
    for (let i = 0; i < pointer_list.length; i++) {
      const index = parseInt(
          pointer_list[i].substring(CUSTOM_OPTIONS_LIST_PREFIX.length));
      if (index >= max) max = index;
    }
  }
  for (let j = 0; j < user_agent_list.length; j++) {
    user_agent_list[j].key = CUSTOM_OPTIONS_LIST_PREFIX + (max + 1 + j);
  }
  await getStorageLocation().set({
    ...Object.fromEntries(user_agent_list.map(ua => [ua.key, ua])),
    [CUSTOM_OPTIONS_IDENTIFIER]:
        pointer_list.concat(user_agent_list.map(ua => ua.key)),
  });
}

// Managed user agents don't need to be protected because they are stored in
// a different data space that cannot be manipulated.  It will simply fail.
async function _deleteUserAgentByKey(key) {
  const managed = await getIsUserAgentManaged();
  if (managed) {
    return;
  }
  const pointers = (await _getUserAgentPointerList()).filter(k => k !== key);
  await getStorageLocation().set({[CUSTOM_OPTIONS_IDENTIFIER]: pointers});
  await getStorageLocation().remove(key);
}

// TODO (gwilson): refactor these functions with the ones above
async function _getSpoofPointerList() {
  return getStorageLocation()
      .get(SPOOF_OPTIONS_IDENTIFIER)
      .then(({[SPOOF_OPTIONS_IDENTIFIER]: pointers}) => (pointers || []));
}

async function _getSpoofList() {
  const managed_list = await _getManagedSpoofList();
  const pointers = await _getSpoofPointerList();
  if (!pointers || pointers.length === 0) {
    return managed_list;
  }
  const spoof_map = await getStorageLocation().get(pointers);
  return managed_list.concat(Object.values(spoof_map));
}

async function _getManagedSpoofList() {
  const raw_spoofs =
      (await chrome.storage.managed.get('PermanentSpoofs'))?.PermanentSpoofs ||
      [];
  return raw_spoofs.map(
      ({
        domain,
        user_agent,
      },
       i) => Object.assign(new PresetSpoof(), {
        domain,
        is_managed: true,
        key: MANAGED_SPOOF_LIST_PREFIX + i,
        user_agent: _convertRawUAToUserAgent(user_agent, undefined),
      }));
}

async function _addSpoof(preset_spoof) {
  const managed = await getIsSpoofManaged();
  if (managed) {
    return false;
  }
  // preset_spoof.user_agent will be empty if they want to spoof with the
  // default UA always.
  if (!preset_spoof) {
    console.log('Preset spoof to add doesn\'t exist, bailing.');
    return false;
  }
  const pointer_list = await _getSpoofPointerList();
  if (!preset_spoof.key) {
    const max = getMaxSpoofId(pointer_list);
    preset_spoof.key = SPOOF_OPTIONS_LIST_PREFIX + (max + 1);
  }
  await getStorageLocation().set({
    [preset_spoof.key]: preset_spoof,
    [SPOOF_OPTIONS_IDENTIFIER]: pointer_list.concat([preset_spoof.key]),
  });
}

function getMaxSpoofId(pointers) {
  return Math.max(
      0, ...pointers.map(p => +p.substring(SPOOF_OPTIONS_LIST_PREFIX.length)));
}

// TODO(gwilson): Refactor this with _addMultipleUserAgents.  They're almost
// exactly the same.
async function _addMultipleSpoofs(spoofs) {
  const managed = await getIsSpoofManaged();
  if (managed) {
    return;
  }
  if (!spoofs || spoofs.length === 0) {
    return;
  }
  const pointers = await _getSpoofPointerList();
  const max = getMaxSpoofId(pointers);
  spoofs = spoofs.map((s, i) => ({
                        ...s,
                        key: SPOOF_OPTIONS_LIST_PREFIX + (max + 1 + i),
                      }));
  await getStorageLocation().set({
    ...Object.fromEntries(spoofs.map(s => [s.key, s])),
    [SPOOF_OPTIONS_IDENTIFIER]: pointers.concat(spoofs.map(s => s.key)),
  });
  // await updateRequestFilters();
}

async function _deleteSpoofByKey(key) {
  const managed = await getIsSpoofManaged();
  if (managed) {
    return;
  }
  const pointers = (await _getSpoofPointerList()).filter(p => p !== key);
  await getStorageLocation().set({[SPOOF_OPTIONS_IDENTIFIER]: pointers});
  await getStorageLocation().remove(key);
}

// Returns the full spoof list grouped by the string title of each UA's group.
// This is useful for the UI, so we can do something like show 'Title' - 'list
// of UAs'.
async function getOptionsByGroup() {
  const uas = await _getUserAgentList();
  return Object.fromEntries(Map.groupBy(uas, getUserAgentGroup));
}

/*****************************************************************************/
/* "Hotlist" functions                                                       */
/*****************************************************************************/

// Functions for getting and setting the "hotlist" or the on-the-fly spoof that
// the user chooses from the icon in the upper right of Chrome.

async function getHotlistMap() {
  return (await chrome.storage.session.get('hotlist'))?.hotlist || {};
}

async function clearHotlistMap() {
  await chrome.storage.session.remove('hotlist');
}

async function getHotlistIndexById(tabId) {
  if (!tabId) {
    console.log('no tab provided, returning nothing');
    return null;
  }
  if (!await getSpoofPerTab()) {
    tabId = NO_SPOOF_PER_TAB;
  }
  const index_map = await getHotlistMap();
  return index_map[tabId] || null;
}

async function setHotlist(tab, index) {
  // Makes sure the items we want to use as a hotlist are in the cache.
  if (!tab || !tab.id) {
    console.log('no tab passed, not saving anything.')
    return;
  }
  const managed = await getHotlistEnabledManaged();
  if (managed == false) {
    console.log('Hotlist enabled is managed.  ignoring input.');
    return;
  }
  const tabId = (await getSpoofPerTab()) ? tab.id : NO_SPOOF_PER_TAB;
  const hotlist = await getHotlistMap();
  console.log('Storing ' + index + ' under tab ' + tabId);
  await chrome.storage.session.set({hotlist: {...hotlist, [tabId]: index}});
  // await updateRequestFilters();
}

/*****************************************************************************/
/* Helper / utility functions                                                */
/*****************************************************************************/

// Returns a "base" set of user-agent strings, while
// saving them to storage.
async function getBaseOptionsList(hard_reset) {
  const base_options_list = new Array();
  base_options_list.push(new UserAgent('Default', '', '', '', true, 'Chrome'));
  base_options_list.push(new UserAgent(
      'Windows Firefox 33',
      'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:33.0) Gecko/20120101 Firefox/33.0',
      'Mozilla, Inc.', 'FFW', true, 'Firefox'));
  base_options_list.push(new UserAgent(
      'Mac Firefox 33',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10; rv:33.0) Gecko/20100101 Firefox/33.0',
      'Mozilla, Inc.', 'FFM', true, 'Firefox'));
  base_options_list.push(new UserAgent(
      'Opera 12.14',
      'Opera/9.80 (Windows NT 6.0) Presto/2.12.388 Version/12.14',
      'Mozilla, Inc.', 'O12', true, 'Opera'));
  base_options_list.push(new UserAgent(
      'Mac Safari 7',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.75.14 (KHTML, like Gecko) Version/7.0.3 Safari/7046A194A',
      'Apple, Inc.', 'S7', true, 'Safari'));
  base_options_list.push(new UserAgent(
      'Internet Explorer 6',
      'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.0; WOW64; Trident/4.0; SLCC1)',
      'Microsoft', 'IE6', true, 'Internet Explorer'));
  base_options_list.push(new UserAgent(
      'Internet Explorer 7',
      'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; WOW64; Trident/4.0; SLCC1)',
      'Microsoft', 'IE7', true, 'Internet Explorer'));
  base_options_list.push(new UserAgent(
      'Internet Explorer 8',
      'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.0; WOW64; Trident/4.0; SLCC1)',
      'Microsoft', 'IE8', true, 'Internet Explorer'));
  base_options_list.push(new UserAgent(
      'Internet Explorer 9',
      'Mozilla/5.0 (MSIE 9.0; Windows NT 6.1; Trident/5.0)', 'Microsoft', 'IE9',
      true, 'Internet Explorer'));
  base_options_list.push(new UserAgent(
      'Internet Explorer 10',
      'Mozilla/5.0 (MSIE 10.0; Windows NT 6.1; Trident/5.0)', 'Microsoft',
      'IE10', true, 'Internet Explorer'));
  base_options_list.push(new UserAgent(
      'iPhone 6',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 6_0 like Mac OS X) AppleWebKit/536.26 (KHTML, like Gecko) Version/6.0 Mobile/10A5376e Safari/8536.25',
      'Apple, Inc.', 'IP6', true, 'iOS'));
  base_options_list.push(new UserAgent(
      'iPad',
      'Mozilla/5.0 (iPad; CPU OS 6_0 like Mac OS X) AppleWebKit/536.26 (KHTML, like Gecko) Version/6.0 Mobile/10A5376e Safari/8536.25',
      'Apple, Inc.', 'iPad', true, 'iOS'));
  base_options_list.push(new UserAgent(
      'Android KitKat',
      'Mozilla/5.0 (Linux; Android 4.4.2; Nexus 4 Build/KOT49H) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/34.0.1847.114 Mobile Safari/537.36',
      '', 'AND', true, 'Android'));
  base_options_list.push(new UserAgent(
      'Windows Phone 8',
      'Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.0; Trident/6.0; IEMobile/10.0; ARM; Touch; NOKIA; Lumia 920)',
      '', 'WP7', true, 'Windows Phone'));
  if (hard_reset) {
    const list = await _getUserAgentList();
    const key_list = [];
    for (let i = 0; i < list.length; i++) {
      key_list.push(list[i].key);
    }
    if (key_list && key_list.length > 0) {
      await getStorageLocation().remove(
          [...key_list, CUSTOM_OPTIONS_IDENTIFIER]);
    }
    await _addMultipleUserAgents(base_options_list);
  }
  return base_options_list;
}

async function addCustomUAOption(
    name, user_agent, append_to_default_ua, indicator, group) {
  const new_user_agent =
      new UserAgent(name, user_agent, '', indicator, false, group);
  new_user_agent.append_to_default_ua = append_to_default_ua;
  await _addUserAgent(new_user_agent);
}

async function deleteCustomUAOption(name) {
  const options_list = await _getUserAgentList();
  for (let i = 0; i < options_list.length; i++) {
    if (options_list[i].title == name) {
      await _deleteUserAgentByKey(options_list[i].key);
      break;
    }
  }
}

// TODO(nicolaso): Remove.
// For legacy support.  Probably no longer needed.
function isRemovable(user_agent) {
  return (!isDefault(user_agent));
}

function getDisplayUserAgentString(user_agent) {
  return (
      user_agent.ua_string == '' ? '[Use default User-agent string]' :
                                   user_agent.ua_string);
}

function getDisplayAppendOrReplaceString(user_agent) {
  return (
      user_agent.ua_string == '' ?
          'N/A' :
          (user_agent.append_to_default_ua ? 'Append' : 'Replace'));
}

function guessUserAgentGroup(str) {
  if (!str) return '';
  // If there is no group defined, guess one.
  const guesses = [
    ['Chrome', 'Chrome'], ['Firefox', 'Firefox'], ['Opera', 'Opera'],
    ['Safari', 'Safari'], ['IE', 'Internet Explorer'],
    ['Internet Explorer', 'Internet Explorer'], ['iPhone', 'iPhone'],
    ['iPad', 'iPad'], ['iOS', 'iOS']
  ];
  for (let i = 0; i < guesses.length; i++) {
    if (str.toUpperCase().indexOf(guesses[i][0].toUpperCase()) > -1)
      return guesses[i][1];
  }
  return '';
}

function getUserAgentGroup(user_agent) {
  return user_agent?.group || '';
}

// Given a string of JSON, if it is well formed as determined by
// schema.json, import the settings.
// Does not overwrite local settings.
async function importJson(raw_data) {
  try {
    const result = JSON.parse(raw_data);
    // Read in UserAgents
    const user_agents = result['UserAgents'];
    let hash = {};
    // TODO(nicolaso): Maybe use Promise.all() to add UAs and spoofs in
    // parallel, instead of adding UAs and then adding spoofs.
    // TODO(nicolaso): Code golf/modernize.
    if (user_agents && user_agents.length > 0) {
      const options = await _getUserAgentList();
      // Make sure we don't keep importing the same object repeatedly.
      // Make a hash of all existing options and if there is a collision with
      // items to import, don't import it.
      for (let i = 0; i < options.length; i++) hash[options[i].ua_string] = '1';
      const list_to_add = [];
      for (let j = 0; j < user_agents.length; j++) {
        // Don't test for user_agent.append, because it's boolean and
        // could be false.
        if (user_agents[j].title && user_agents[j].ua_string &&
            user_agents[j].badge) {
          const ua = new UserAgent(
              user_agents[j].title, user_agents[j].ua_string,
              user_agents[j].vendor, user_agents[j].badge, false,
              user_agents[j].group);
          ua.append_to_default_ua = user_agents[j].append_to_default_ua;
          ua.is_managed = false;
          if (!hash[ua.ua_string]) {
            hash[ua.ua_string] = '1';
            list_to_add.push(ua);
          }
        } else {
          console.log(
              'Ignoring incomplete user agent entry ' + user_agents[j].title);
        }
      }
      await _addMultipleUserAgents(list_to_add);
    }

    const permanent_spoofs = result['PermanentSpoofs'];
    hash = new Array();
    if (permanent_spoofs && permanent_spoofs.length > 0) {
      const spoofs = await _getSpoofList();
      // Make sure we don't keep importing the same object repeatedly.
      // Make a hash of all existing options and if there is a collision with
      // items to import, don't import it.
      for (let i = 0; i < spoofs.length; i++)
        hash[spoofs[i].domain + ' ' + spoofs[i].user_agent.ua_string] = '1';
      const list_to_add = [];
      for (let j = 0; j < permanent_spoofs.length; j++) {
        // Don't test for user_agent.append, because it's boolean and
        // could be false.
        if (permanent_spoofs[j].domain && permanent_spoofs[j].user_agent &&
            permanent_spoofs[j].user_agent.title &&
            permanent_spoofs[j].user_agent.ua_string &&
            permanent_spoofs[j].user_agent.vendor &&
            permanent_spoofs[j].user_agent.badge) {
          const ua = new UserAgent(
              permanent_spoofs[j].user_agent.title,
              permanent_spoofs[j].user_agent.ua_string,
              permanent_spoofs[j].user_agent.vendor,
              permanent_spoofs[j].user_agent.badge, false,
              permanent_spoofs[j].group);
          ua.append_to_default_ua =
              permanent_spoofs[j].user_agent.append_to_default_ua;
          ua.is_managed = false;
          const spoof = new PresetSpoof(permanent_spoofs[j].domain, ua);
          spoof.is_managed = false;
          if (!hash[spoof.domain + ' ' + spoof.user_agent.ua_string]) {
            hash[spoof.domain + ' ' + spoof.user_agent.ua_string] = '1';
            list_to_add.push(spoof);
          }
        } else {
          console.log('Ignoring incomplete spoof entry ' + permanent_spoofs[j]);
        }
      }
      await _addMultipleSpoofs(list_to_add);
    }
  } catch (err) {
    console.error('Import aborted.');
    console.error(err);
  }
}

// Returns a string of JSON that encapsulates all of the settings data.
// Structure will look like this, returned as a string:
// {
//  "UserAgents": [
//    {"title": "1", "ua_string": "ua_1", "vendor": "v_1", "badge": "A1",
//    "append_to_default_ua" : false},
//    {"title": "2", "ua_string": "ua_2", "vendor": "v_2", "badge": "A2",
//    "append_to_default_ua" : false}
//  ],
//  "PermanentSpoofs": [
//    {"domain" : "foo.com", "user_agent": {"title": "4", "ua_string": "ua_4",
//    "vendor": "v_4", "badge": "A4", "append_to_default_ua" : false}},
//    {"domain" : "bar.com", "user_agent": {"title": "5", "ua_string": "ua_5",
//    "vendor": "v_5", "badge": "A5", "append_to_default_ua" : true}}
//  ]
// }
async function exportJson() {
  const uas = await _getUserAgentList();
  const spoofs = await _getSpoofList();
  return JSON.stringify({
    UserAgents: await _getUserAgentList(),
    PermanentSpoofs: await _getSpoofList(),
  });
}


// Method for pulling a long list of structured user-agent data into memory.
async function importUserAgentData(raw_data) {
  // Credit goes to jeffd at http://techpatterns.com/forums/about304.html for
  // posting a whole bunch of ua strings.  Thanks!
  //
  // Assume that the input consists of XML that takes the form of:
  // <useragentswitcher>
  //   <folder description="foo">
  //     <folder description="bar">
  //       <useragent description="[Name]" useragent="[UA Value]" appcodename=""
  //       appname="" appversion="" platform="" vendor="" vendorsub=""/>
  //     </folder>
  //   </folder>
  //   <separator />
  // </useragentswitcher>
  const options = await _getUserAgentList();
  let import_count = 0;
  let duplicates = 0;
  const hash = {};
  for (let i = 0; i < options.length; i++) hash[options[i].ua_string] = '1';
  const list_to_add = [];
  $('useragent', raw_data).each(function() {
    const ua = new UserAgent(
        $(this).attr('description'),  // title
        $(this).attr('useragent'),    // ua string
        '',                           // Vendor string
        'X',                          // badge
        false,                        // is preset
        _getParentFolderName($(this).parent()));
    // Ignore the "about" group.
    if (ua.group != 'UA List :: About') {
      if (hash[ua.ua_string]) {
        duplicates++;
      } else if (import_count < MAX_IMPORT_COUNT) {
        hash[ua.ua_string] = '1';
        list_to_add.push(ua);
        import_count++;
      }
    }
  });
  await _addMultipleUserAgents(list_to_add);
  return {import_count, duplicates};
}

function _getParentFolderName(obj) {
  const parent_folder_name = ($(obj) && $(obj).parent().length > 0) ?
      _getParentFolderName($(obj).parent()) :
      null;
  const my_folder_name = $(obj).attr('description');
  return (
      parent_folder_name ? parent_folder_name + ' - ' + my_folder_name :
                           (my_folder_name ? my_folder_name : null));
}

async function _addOption(domain, user_agent_key) {
  console.log('Adding new preset spoof with key of ' + user_agent_key);
  const list = await _getUserAgentList();
  let user_agent = list.find(ua => ua.key === user_agent_key);
  if (!user_agent) {
    user_agent = new UserAgent('', '', '', '', true, '');
  }
  console.log('Adding new preset spoof with ' + user_agent);
  await _addSpoof(new PresetSpoof(domain, user_agent));
}

// Is the user agent the "default" user agent (i.e. the normal browser UA)
function isDefault(user_agent) {
  return (!user_agent || (user_agent.ua_string == ''));
}

// Add this number to the ID of managed spoofs, to avoid duplicate IDs in
// declarativeNetRequest.
const MANAGED_SPOOF_OFFSET =
    chrome.declarativeNetRequest.MAX_NUMBER_OF_SESSION_RULES;

function spoofIdToNetRequestId(spoof_id) {
  // Convert 's_0', etc. to a number, and add MANAGED_SPOOF_OFFSET if it comes
  // from policies. This avoids IDs collisions for declarativeNetRequest.
  return +spoof_id.replace(/^sm?_/, '') +
      (/^s_/.test(spoof_id) ? 0 : MANAGED_SPOOF_OFFSET);
}

function netRequestIdToSpoofId(net_request_id) {
  if (net_request_id >= MANAGED_SPOOF_OFFSET) {
    // From managed spoofs.
    return `sm_${net_request_id - MANAGED_SPOOF_OFFSET}`;
  } else {
    // From non-managed spoofs.
    return `s_${net_request_id}`;
  }
}

// Original string with wrong escapes:
//     '^(https?:\/\/)?' +                                   // protocol
//         '((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|' +  // domain name
//         '((\d{1,3}\.){3}\d{1,3}))' +                      // OR ip (v4)
//         address
//         '(\:\d+)?(\/[-a-z\d%_.~+]*)*$',
//     'i');
const DOMAIN_NAME_PATTERN = new RegExp(
    '^(https?://)?' +                                 // protocol
        '((([a-zd]([a-zd-]*[a-zd])*).)+[a-z]{2,}|' +  // domain name
        '((d{1,3}.){3}d{1,3}))' +                     // OR ip (v4) address
        '(:d+)?(/[-a-zd%_.~+]*)*$',
    'i');
/**
 * Returns true if |str| is a "domain name" spoof rule, and false if it's a
 * regex rule. Domain name spoofs must match the URL literally, at a domain
 * boundary. Regex rules can match anywhere in the URL.
 *
 * N.B.: DOMAIN_NAME_PATTERN is copypasted from the MV2 implementation, and is
 * intentionally left unchanged so it's bug-compatible.
 *
 * Escapes use a SINGLE backslash instead of 2. In other words it's not escaped.
 * '\d' only matches the letter 'd', and '\.' matches any character.
 *
 * This code doesn't work as the author intended:
 * - IP addresses don't parse as valid hosts.
 * - Port numbers don't parse.
 * - The path part of the URL can't contain numbers.
 * - 'd.d.d.d:dddd' parses as a domain name.
 *
 * @param {string} str
 * @return {boolean}
 */
function isDomainName(str) {
  return DOMAIN_NAME_PATTERN.test(str);
}

/**
 * Returns true if the spoof with |match_pattern| would match |url|.
 * @param {string} match_pattern
 * @param {string} url
 * @return {boolean}
 */
function spoofMatchesUrl(match_pattern, url) {
  match_pattern = match_pattern.toLowerCase();
  url = url.toLowerCase();
  if (isDomainName(match_pattern)) {
    if (/^https?:/.test(match_pattern)) {
      // Need an exact match of the entire URL.
      return url === match_pattern;
    }
    // Needs to match at a domain name anchor. Try matching with every
    // subdomain as an anchor.
    let partial_url = url.replace(/^\w+:\/\//, '');
    // Iterate until we hit ':' (port number) or '/' (path).
    while (!/^[:\/]/.test(partial_url)) {
      partial_url = partial_url.replace(/^\./, '');
      if (partial_url.startsWith(match_pattern)) {
        return true;
      }
      // Advance to next punctuation.
      partial_url = partial_url.replace(/^\w+/, '');
    }
    return false;
  }
  // Otherwise it's just a regex.
  return (new RegExp(match_pattern)).test(url);
}

/**
 * @param {string} url
 * @return {!Promise<string>}
 */
async function getBadgeTextFromSpoofList(url) {
  for (const spoof of await _getSpoofList()) {
    if (spoofMatchesUrl(spoof.domain, url.href)) {
      return spoof.user_agent?.badge || '';
    }
  }
  return '';
}

/**
 * @param {number} tab_id
 * @return {!Promise<string>}
 */
async function getBadgeTextFromHotlist(tab_id) {
  const hotlist_id = await getHotlistIndexById(tab_id);
  if (hotlist_id) {
    const ua = await _getUserAgentByKey(hotlist_id);
    return ua?.badge || '';
  }
  return '';
}

async function getBadgeTextForTab(tab) {
  if (!tab || !tab.id) {
    return '';
  }

  const {id: tab_id} = tab;
  const url = new URL(tab.url || tab.pendingUrl);
  // Hash, username, and password are ignored for URL matching.
  url.hash = '';
  url.username = '';
  url.password = '';

  if (!/https?:/.test(url)) {
    // Could be chrome-extension:// or something, no badge needed.
    return '';
  }

  if (await getPermanentSpoofOverride()) {
    // spoofs > hotlist
    return (await getBadgeTextFromSpoofList(url)) ||
        (await getBadgeTextFromHotlist(tab_id));
  } else {
    // hotlist > spoofs
    return (await getBadgeTextFromHotlist(tab_id)) ||
        (await getBadgeTextFromSpoofList(url));
  }
}

// Updates the badge on the action given the current active tab.
// TODO(nicolaso): Cache value to avoid re-calculating unnecessarily.
async function updateBadge(tab) {
  if (!tab || !tab.id) {
    return;
  }
  await chrome.action.setBadgeText({
    tabId: tab.id,
    text: await getBadgeTextForTab(tab),
  });
}

//googleclient/chrome/apps/user_agent_spoofer/popup.js
// Get the list of standard options.
function refreshView() {
  getOptionsByGroup().then(buildTables);
}

$(window).on('load', refreshView);

function refreshSelected() {
  chrome.tabs.query({currentWindow: true, active: true}).then(async ([tab]) => {
    // TODO(nicolaso): After hotlistMap in spoofer.js uses
    // chrome.storage.session, use storage directly instead of using
    // sendMessage().
    const ua_index = await getHotlistIndexById(tab.id);
    $('td').removeClass('popup_selected');
    if (ua_index) {
      $('td#ua_row_' + ua_index).addClass('popup_selected');
      _getUserAgentByKey(ua_index).then(function(user_agent) {
        $('td#ua_row_' + getUserAgentGroup(user_agent))
            .addClass('popup_selected');
      });
    }
  });
}

function setCurrent(ua_index) {
  chrome.runtime.sendMessage(
      {
        action: 'setCurrent',
        target: 'service_worker',
        ua_index,
      },
      {}, refreshSelected);
}

function addPermanentSpoof() {
  refreshSelected();
}


function _newRow(title, value, right_icon, index) {
  let td = document.createElement('td');
  const a = document.createElement('a');
  td.setAttribute('class', 'popup_item');
  a.appendChild(document.createTextNode(title));
  td.setAttribute('id', 'ua_row_' + index);
  td.appendChild(a);
  const tr = document.createElement('tr');
  tr.appendChild(td);
  if (right_icon) {
    td = document.createElement('td');
    const img = document.createElement('img');
    img.setAttribute('src', right_icon);
    td.appendChild(img);
    tr.appendChild(td);
  }
  return tr;
}

function showSubTable(sub_table_index) {
  const sub_table = $('#sub_table_' + sub_table_index);
  sub_table.addClass('visible');
  sub_table.removeClass('invisible');
  const group_table = $('#group_table');
  group_table.addClass('invisible');
  group_table.removeClass('visible');
}

function buildTables(options_map) {
  const outer_table = $('#options_table');
  outer_table.empty();
  // Build master table of groups.
  let group_table = document.createElement('table');
  group_table.setAttribute('id', 'group_table');
  outer_table.append(group_table);
  group_table = $('#group_table');
  group_table.addClass('popup_group_table');
  let index = 0;
  for (const group in options_map) {
    // For each group, build a subtable of all options
    group_table.append(_newRow(
        (group == '' ? 'Default' : group), group, 'Chevron-right.png', index));
    let group_sub_table = document.createElement('table');
    group_sub_table.setAttribute('id', 'sub_table_' + index);
    outer_table.append(group_sub_table);
    $('#ua_row_' + index).on('click', (function(index) {
                               return function() {
                                 showSubTable(index);
                               };
                             })(index));
    group_sub_table = $('#sub_table_' + index);
    group_sub_table.addClass('popup_sub_table');
    const options = options_map[group];
    for (let i = 0; i < options.length; i++) {
      group_sub_table.append(
          _newRow(options[i].title, options[i].key, null, '' + options[i].key));
      group_sub_table.addClass('invisible');
      const key = options[i].key;
      $('#ua_row_' + options[i].key).on('click', () => setCurrent(key));
    }
    index++;
  }
  // if there is only one group, automatically show it.
  if (index == 1) showSubTable(0);

  refreshSelected();
}

function getAddOptionRow() {
  const td = document.createElement('td');
  td.setAttribute('class', 'popup_item');
  const a = document.createElement('a');
  a.appendChild(document.createTextNode('Add Permanent Spoof'));
  a.setAttribute('id', 'add_spoof');
  a.setAttribute('href', '#');
  td.appendChild(a);
  const tr = document.createElement('tr');
  tr.appendChild(td);
  return tr;
}

function getShowOptionsRow() {
  const td = document.createElement('td');
  td.setAttribute('class', 'popup_item');
  const a = document.createElement('a');
  a.appendChild(document.createTextNode('Settings'));
  a.setAttribute('href', 'options.html');
  a.setAttribute('target', '_new');
  td.appendChild(a);
  const tr = document.createElement('tr');
  tr.appendChild(td);
  return tr;
}

