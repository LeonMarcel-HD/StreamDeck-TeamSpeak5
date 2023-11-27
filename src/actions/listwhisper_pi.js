/// <reference path="../libs/js/property-inspector.js" />
/// <reference path="../libs/js/utils.js" />
/// <reference path="../libs/js/stream-deck.js" />

let teamspeakWebSocketConnectionStatus = false;
let currentLanguage;
let settings;

$PI.onConnected((jsn) => {
  $PI.getGlobalSettings();
  settings = jsn.actionInfo.payload.settings;
  console.log("Current PTT Settings: ", settings);
  console.log("Current ActionInfo Settings: ", jsn.actionInfo);
  currentLanguage = jsn.appInfo.application.language;
});

$PI.onDidReceiveGlobalSettings(({ payload }) => {
  console.log("onDidReceiveGlobalSettings", payload);
  teamspeakWebSocketConnectionStatus = payload.settings.connectionStatus;
  var layout1 = document.getElementById("sdpi-layout1");
  var layout2 = document.getElementById("sdpi-layout2");

  if (!teamspeakWebSocketConnectionStatus) {
    // If TS is NOT connected show Setup process
    layout1.style.display = "block";
    layout2.style.display = "none";
  } else {
    // If TS is connected show settings
    layout1.style.display = "none";
    layout2.style.display = "block";
    // Restoring previously setted settings
    document.getElementById("whisperlist").value = settings.input ?? "";
    switch (settings.ptt) {
      case 1:
        document.getElementById("rdio1").checked = true;
        break;
      case 2:
        document.getElementById("rdio2").checked = true;
        break;
      default:
        console.warn("No settings found, setting to default");
        document.getElementById("rdio1").checked = true;
        $PI.setSettings({ ...settings, ptt: 1 });
    }
  }
});

// Whisper list
document.getElementById("whisperlist").addEventListener("input", (event) => {
  settings = { ...settings, input: event.target.value };
  $PI.setSettings(settings);
});

// Push To Talk
document.getElementById("rdio1").addEventListener("click", () => {
  settings = { ...settings, ptt: 1 };
  $PI.setSettings(settings);
});

// Toggle To Talk
document.getElementById("rdio2").addEventListener("click", () => {
  settings = { ...settings, ptt: 2 };
  $PI.setSettings(settings);
});

document.getElementById("open-setup").addEventListener("click", () => {
  switch (currentLanguage) {
    case "de":
      window.open("setupde.html");
      break;
    case "en":
    default:
      window.open("setupen.html");
      break;
  }
});
