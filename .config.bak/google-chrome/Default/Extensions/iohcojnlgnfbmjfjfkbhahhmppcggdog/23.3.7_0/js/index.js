var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import LocalStorage from './LocalStorage.js';
import ConfigModule from './config.js';
import ErrorsModule from './errors.js';
import DriverModule from './Driver/index.js';
import ServerIndexModule from './Server/index.js';
import UtilsModule from './Utils.js';
import PrefsModule from './Prefs.js';
import DialogsModule from './Dialogs.js';
import LocalizerModule from './Localizer.js';
import ObserverModule from './Observer.js';
import ServerConnectionModule from './Server/Connection.js';
import ServerSyncModule from './Server/Sync.js';
import DriverSpeeddialModule from './Driver/Speeddial.js';
import BookmarksInit from './Driver/bookmarks/bookmarks.js';
import DriverBookmarksModule from './Driver/Bookmarks.js';
const PENDING_REQUESTS_TIMEOUT = 1000 * 5 * 60;
class FvdSynchronizerModule {
    constructor(eventListener, modulesConfig = {}) {
        this.localStorage = new LocalStorage();
        this.modulesConfig = {
            sync: false,
            mode: 0,
        };
        this._pendingSDRequests = [];
        this.Config = ConfigModule;
        this.Errors = ErrorsModule;
        this.Server = ServerIndexModule;
        this.Driver = DriverModule;
        this.addEventListener = eventListener;
        Object.assign(this.modulesConfig, modulesConfig);
        const self = this;
        setInterval(function () {
            self.clearTimedoutPendingRequests();
        }, PENDING_REQUESTS_TIMEOUT);
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.localStorage.init();
            new UtilsModule(this);
            new PrefsModule(this);
            new DialogsModule(this);
            if (this.modulesConfig.sync) {
                new ObserverModule(this);
                new ServerConnectionModule(this);
                new ServerSyncModule(this);
                new DriverSpeeddialModule(this);
                new BookmarksInit(this);
                new DriverBookmarksModule(this);
            }
            if (this.modulesConfig.mode === 1) {
                new LocalizerModule(this);
            }
        });
    }
    nextPendingRequestId() {
        const id = Date.now().toString().substring(7) + '_' + Math.ceil(1000 * Math.random());
        return id;
    }
    addPendingRequest(callback) {
        var id = this.nextPendingRequestId();
        const newPendingRequest = {
            id: id,
            callback: callback,
            time: new Date().getTime(),
        };
        this._pendingSDRequests.push(newPendingRequest);
        return id;
    }
    getPendingRequest(id) {
        let request = null;
        for (var i = 0; i != this._pendingSDRequests.length; i++) {
            if (id == this._pendingSDRequests[i].id) {
                request = this._pendingSDRequests[i];
                break;
            }
        }
        return request;
    }
    removePendingRequestById(id) {
        let index = null;
        for (let i = 0; i != this._pendingSDRequests.length; i++) {
            if (this._pendingSDRequests[i].id === id) {
                index = i;
                break;
            }
        }
        if (index !== null) {
            this._pendingSDRequests.splice(index, 1);
        }
    }
    clearTimedoutPendingRequests() {
        const toRemoveIds = [];
        const now = new Date().getTime();
        this._pendingSDRequests.forEach(function (request) {
            if (now - request.time >= PENDING_REQUESTS_TIMEOUT) {
                toRemoveIds.push(request.id);
            }
        });
        const self = this;
        toRemoveIds.forEach(function (id) {
            self.removePendingRequestById(id);
        });
    }
    id(cb) {
        chrome.management.getSelf((app) => {
            cb(app.id);
        });
    }
    eachDriver(cb) {
        for (var k in this.Driver) {
            cb(this.Driver[k], k);
        }
    }
}
export default FvdSynchronizerModule;
