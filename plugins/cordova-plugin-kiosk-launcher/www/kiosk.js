cordova.define("cordova-plugin-kiosk-launcher.kiosk", function(require, exports, module) {
var exec = require("cordova/exec");

var Kiosk = {
  setKioskEnabled(enabled) {
    exec(null, null, "Kiosk", "setKioskEnabled", [!!enabled]);
  },

  switchLauncher: function() {
    exec(null, null, "Kiosk", "switchLauncher", []);
  },

  isInKiosk: function(callback) {
    exec(
      function(out) {
        callback(out == "true");
      },
      function(error) {
        alert("Kiosk.isInKiosk failed: " + error);
      },
      "Kiosk",
      "isInKiosk",
      []
    );
  },

  isSetAsLauncher: function(callback) {
    exec(
      function(out) {
        callback(out == "true");
      },
      function(error) {
        alert("Kiosk.isSetAsLauncher failed: " + error);
      },
      "Kiosk",
      "isSetAsLauncher",
      []
    );
  },

  getSystemState: function(success, error) {
    exec(success, error, "Kiosk", "getSystemState", []);
  },

  setBrightness: function(percent, success, error) {
    exec(success, error, "Kiosk", "setBrightness", [percent]);
  },

  applySystemDefaults: function(success, error) {
    exec(success, error, "Kiosk", "applySystemDefaults", []);
  },

  requestWriteSettings: function(success, error) {
    exec(success, error, "Kiosk", "requestWriteSettings", []);
  },

  openWifiSettings: function(success, error) {
    exec(success, error, "Kiosk", "openWifiSettings", []);
  },

  openBluetoothSettings: function(success, error) {
    exec(success, error, "Kiosk", "openBluetoothSettings", []);
  },

  setFlashlight: function(enabled, success, error) {
    exec(success, error, "Kiosk", "setFlashlight", [!!enabled]);
  },

  exitKiosk: function(success, error) {
    exec(success, error, "Kiosk", "exitKiosk", []);
  },

  openDeveloperSettings: function(success, error) {
    exec(success, error, "Kiosk", "openDeveloperSettings", []);
  },

  openAccessibilitySettings: function(success, error) {
    exec(success, error, "Kiosk", "openAccessibilitySettings", []);
  },

  openRuStore: function(success, error) {
    exec(success, error, "Kiosk", "openRuStore", []);
  },

  openKeyboardSettings: function(success, error) {
    exec(success, error, "Kiosk", "openKeyboardSettings", []);
  },

  openFileManager: function(success, error) {
    exec(success, error, "Kiosk", "openFileManager", []);
  },

  getNotifications: function(success, error) {
    exec(success, error, "Kiosk", "getNotifications", []);
  },

  isNotificationAccessGranted: function(success, error) {
    exec(success, error, "Kiosk", "isNotificationAccessGranted", []);
  },

  openNotificationAccessSettings: function(success, error) {
    exec(success, error, "Kiosk", "openNotificationAccessSettings", []);
  },

  disableLauncher: function(success, error) {
    exec(success, error, "Kiosk", "disableLauncher", []);
  },

  killAll: function(success, error) {
    exec(success, error, "Kiosk", "killAll", []);
  }
};

module.exports = Kiosk;
});
