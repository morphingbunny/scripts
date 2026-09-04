import { _r, _b, _isb } from './Utils.js';

const AUTO_SYNC_INIT_TIMEOUT_MS = 30000; // 30 sec
const AUTO_SYNC_INTERVAL_MS = 180000; // 3 min
const AUTO_SYNC_FAILED_DELAY_MS = 1200000; // 10 min

const AutoSyncModule = function (fvdSynchronizer) {
  const AUTO_SYNC_DELAY = fvdSynchronizer.Config.AUTOSYNC_EVERY;
  function DriversAutoUpdater(drivers) {
    setTimeout(() => {
      setInterval(() => {
        _startAutoSync(fvdSynchronizer, drivers);
      }, AUTO_SYNC_INTERVAL_MS);
      _startAutoSync(fvdSynchronizer, drivers);
    }, AUTO_SYNC_INIT_TIMEOUT_MS);
  }

  function _startAutoSync(fvdSynchronizer, drivers) {
    fvdSynchronizer.Utils.Async.arrayProcess(
      drivers,
      function (dInfo, apCallback) {
        var driver = dInfo.driver;
        var driverName = dInfo.name;

        var syncDateKey = driverName.toLowerCase() + '.last_sync_time';
        var syncStatusKey = driverName.toLowerCase() + '.last_sync_success';

        if (!_b(fvdSynchronizer.Prefs.get(driverName.toLowerCase() + '.enable_autosync'))) {
          console.log(driverName, 'autosync disabled');
          return apCallback();
        }

        var syncFailed = false;
        var syncStatus = fvdSynchronizer.Prefs.get(syncStatusKey);
        if(syncStatus) {
          syncFailed = !_b(syncStatus);
        }

        var syncDelay = syncFailed ? AUTO_SYNC_FAILED_DELAY_MS : AUTO_SYNC_DELAY;
        if(!syncDelay) {
          console.log(driverName + ': Empty syncDelay');
          return apCallback();
        }

        var needAutoSync = true;
        var lastSyncDate = fvdSynchronizer.Prefs.get(syncDateKey);

        if(lastSyncDate) {
          var lastUpdateTime = +lastSyncDate;
          needAutoSync = new Date().getTime() - lastUpdateTime >= syncDelay;
        }

        console.log(driverName + ': Need autosync ', needAutoSync);
        if(!needAutoSync) {
          return apCallback();
        }

        console.log(driverName + ': Start autosync');

        driver.startAutoSync(null, function (error) {
          console.log(driverName + ': Sync completed with: ' + error);
          fvdSynchronizer.Prefs.set(syncDateKey, new Date().getTime());
          fvdSynchronizer.Prefs.set(syncStatusKey, !error);
          return apCallback();
        });
      }
    );
  }

  var __fvdSynchronizerAutoSync = function () {
    var drivers = [];

    fvdSynchronizer.eachDriver(function (driver, name) {
      if (driver.startAutoSync) {
        drivers.push({
          driver: driver,
          name: name,
        });
      }
    });

    var autoUpdater = new DriversAutoUpdater(drivers);
  };

  fvdSynchronizer.AutoSync = new __fvdSynchronizerAutoSync();
};

export default AutoSyncModule;
