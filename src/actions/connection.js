/// <reference path="../libs/js/property-inspector.js" />
/// <reference path="../libs/js/utils.js" />
/// <reference path="../libs/js/stream-deck.js" />

let teamspeakWebSocketConnectionStatus = false;
let currentLanguage;

$PI.onConnected((jsn) => {
  $PI.getGlobalSettings();
  console.log("Current ActionInfo Settings: ", jsn);
  currentLanguage = jsn.appInfo.application.language;
});

$PI.onDidReceiveGlobalSettings(({ payload }) => {
  teamspeakWebSocketConnectionStatus = payload.settings.connectionStatus;

  var layout1 = document.getElementById("sdpi-layout1");
  var layout2 = document.getElementById("sdpi-layout2");

  if (!teamspeakWebSocketConnectionStatus) {
    layout1.style.display = "block";
    layout2.style.display = "none";
  } else {
    layout1.style.display = "none";
    layout2.style.display = "block";
  }
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
