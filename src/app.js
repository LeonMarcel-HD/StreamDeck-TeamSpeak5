/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />

// TeamSpeak stuff
let TeamSpeakWebsocket;
let TeamSpeakInitialized = false;
let TeamSpeakIsConnected = false; // TeamSpeak socket status
let TeamSpeakIsMuted = false; // TeamSpeak mic status
let TeamSpeakIsSoundMuted = false; // TeamSpeak output status
let TeamSpeakIsAFK = false; // TeamSpeak afk status
let TeamSpeakPTT = false; // TeamSpeak ptt status
let TeamSpeakPTM = false; // TeamSpeak ptm status
let micInterval = false; // StreamDeck mic state check to update icon/state
let soundInterval = false; // StreamDeck output state check to update icon/state
let afkInterval = false; // StreamDeck afk state check to update icon/state

// Reconnect methode if a disconnect happens
const reconnectTeamSpeak = async (apiKey) => {
  await new Promise((r) => setTimeout(r, 5000));
  createTeamSpeakSocket(apiKey);
  console.log("TeamSpeak -- Trying to reconnect: ");
};

const createTeamSpeakSocket = (apiKey) => {
  // Opening a new websocket on 127.0.0.1 with default port 5899 (TeamSpeak Remote Apps)
  if (!TeamSpeakIsConnected) {
    TeamSpeakWebsocket = new WebSocket("ws://127.0.0.1:5899");
    TeamSpeakWebsocket.onopen = () => {
      TeamSpeakIsConnected = true;
      console.log("TeamSpeak -- Connecting: ");
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "auth",
          payload: {
            identifier: "de.leonmarcel.streamdeckplugin",
            version: "1.0.0",
            name: "Stream Deck Plugin",
            description:
              "Stream Deck Plugin to send Hotkeys to TeamSpeak | @LeonMarcelHD",
            content: {
              apiKey: apiKey,
            },
          },
        })
      );
    };
  } else {
    return;
  }

  // Listening on messages coming from the websocket
  TeamSpeakWebsocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.status && data.status.code !== 0) {
      console.log("TeamSpeak -- Error: ");
      console.log(data.status.message);
      return;
    }
    // Handle auth events
    if (data.type === "auth") {
      console.log("TeamSpeak -- Auth: ");
      TeamSpeakIsConnected = true;
      const key = data.payload.apiKey;
      settings.apiKey = key;
      settings.connectionStatus = TeamSpeakIsConnected;
      $SD.setGlobalSettings(settings);

      // Clearing previously sended hotkeys if a disconnect happens.
      // This is also needed for TeamSpeak to receive the first Hotkey.
      // Using this "workaround" results in the TS client freaking out
      // when loosing connection to the Plugin
      if (TeamSpeakIsConnected) {
        if (TeamSpeakInitialized) {
          TeamSpeakWebsocket.send(
            JSON.stringify({
              type: "buttonPress",
              payload: { button: "mute", state: false },
            })
          );
          TeamSpeakWebsocket.send(
            JSON.stringify({
              type: "buttonPress",
              payload: { button: "afk", state: false },
            })
          );
          TeamSpeakWebsocket.send(
            JSON.stringify({
              type: "buttonPress",
              payload: { button: "soundmute", state: false },
            })
          );
        }
      }

      // Handle self client properties events
    } else if (data.type === "clientSelfPropertyUpdated") {
      // -> split into inputMuted
      if (data.payload.flag === "inputMuted") {
        if (data.payload.newValue === true) {
          TeamSpeakIsMuted = true;
        } else {
          TeamSpeakIsMuted = false;
        }
      }

      // -> split into outputMuted
      if (data.payload.flag === "outputMuted") {
        if (data.payload.newValue === true) {
          TeamSpeakIsSoundMuted = true;
        } else {
          TeamSpeakIsSoundMuted = false;
        }
      }

      // -> split into away
      if (data.payload.flag === "away") {
        if (data.payload.newValue === true) {
          TeamSpeakIsAFK = true;
        } else {
          TeamSpeakIsAFK = false;
        }
      }
    } else {
      // console.log(data);
    }
  };

  // Error handling if connection could not be opend
  TeamSpeakWebsocket.onerror = (err) => {
    console.log("TeamSpeak -- Error: ", err);
    TeamSpeakIsConnected = false;
    settings.connectionStatus = TeamSpeakIsConnected;
    $SD.setGlobalSettings(settings);
  };

  // Reconnect if the connection is closed
  TeamSpeakWebsocket.onclose = (event) => {
    console.log("TeamSpeak -- Disconnected: ");
    TeamSpeakIsConnected = false;
    settings.connectionStatus = TeamSpeakIsConnected;
    $SD.setGlobalSettings(settings);
    reconnectTeamSpeak(apiKey);
  };
};

// Elgato stuff
const micMute = new Action("de.leonmarcel.teamspeak5.muteaction");
const soundMute = new Action("de.leonmarcel.teamspeak5.soundmuteaction");
const afk = new Action("de.leonmarcel.teamspeak5.afkaction");
let settings;

// Saving the APIKey from TeamSpeak into the Elgato settings database
$SD.on("didReceiveGlobalSettings", ({ event, payload }) => {
  console.log("Stream Deck -- Settings received: ");

  settings = payload.settings;
  console.log(payload);

  if (!TeamSpeakInitialized) {
    createTeamSpeakSocket(payload.settings?.apiKey || "");
    TeamSpeakInitialized = true;
  }
});

// The first event when Stream Deck starts
// Getting global settings and sending to to PI for them to use
$SD.onConnected(
  ({ actionInfo, appInfo, connection, messageType, port, uuid }) => {
    $SD.getGlobalSettings(uuid);
    $SD.sendToPropertyInspector(uuid);

    console.log("Stream Deck -- Connected: ");
  }
);

// ----------------------------------------------------
// |            UPDATE STREAM DECK ICONS              |
// ----------------------------------------------------

// Update icon on canvas /sec to the mic mute status
micMute.onWillAppear(({ context }) => {
  if (micInterval) {
    return;
  }
  micInterval = setInterval(() => {
    if (!TeamSpeakIsConnected) return;
    if (TeamSpeakIsMuted) {
      $SD.setState(context, true);
    } else {
      $SD.setState(context, false);
    }
  }, 1000);
});

soundMute.onWillAppear(({ context }) => {
  if (soundInterval) {
    return;
  }
  soundInterval = setInterval(() => {
    if (!TeamSpeakIsConnected) return;
    if (TeamSpeakIsSoundMuted) {
      $SD.setState(context, true);
    } else {
      $SD.setState(context, false);
    }
  }, 1000);
});

afk.onWillAppear(({ context }) => {
  if (afkInterval) {
    return;
  }
  afkInterval = setInterval(() => {
    if (!TeamSpeakIsConnected) return;
    if (TeamSpeakIsAFK) {
      $SD.setState(context, true);
    } else {
      $SD.setState(context, false);
    }
  }, 1000);
});

// Clearing active intervalls that request TS mic status
micMute.onWillDisappear(({ context }) => {
  clearInterval(micInterval);
  micInterval = false;
});

soundMute.onWillDisappear(({ context }) => {
  clearInterval(soundInterval);
  soundInterval = false;
});

afk.onWillDisappear(({ context }) => {
  clearInterval(afkInterval);
  afkInterval = false;
});

// ----------------------------------------------------
// |           SENDING TEAMSPEAK KEY PRESSES          |
// ----------------------------------------------------

// Microphone
micMute.onKeyDown(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  TeamSpeakWebsocket.send(
    JSON.stringify({
      type: "buttonPress",
      payload: { button: "mute", state: true },
    })
  );
});

micMute.onKeyUp(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  TeamSpeakWebsocket.send(
    JSON.stringify({
      type: "buttonPress",
      payload: { button: "mute", state: false },
    })
  );
});

// Output
soundMute.onKeyDown(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  TeamSpeakWebsocket.send(
    JSON.stringify({
      type: "buttonPress",
      payload: { button: "soundmute", state: true },
    })
  );
});

soundMute.onKeyUp(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  TeamSpeakWebsocket.send(
    JSON.stringify({
      type: "buttonPress",
      payload: { button: "soundmute", state: false },
    })
  );
});

afk.onKeyDown(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  TeamSpeakWebsocket.send(
    JSON.stringify({
      type: "buttonPress",
      payload: { button: "afk", state: true },
    })
  );
});

afk.onKeyUp(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  TeamSpeakWebsocket.send(
    JSON.stringify({
      type: "buttonPress",
      payload: { button: "afk", state: false },
    })
  );
});

// ----------------------------------------------------
// |              SENDING LWHISPER HOTKEY             |
// ----------------------------------------------------

const lWhisper = new Action("de.leonmarcel.teamspeak5.lwhisperaction");
let ttlwActive = false;
let ttlwActiveInterval;

lWhisper.onKeyDown(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  // Sending PTLW hotkey
  if (payload.settings.pushtotalk === "on") {
    TeamSpeakWebsocket.send(
      JSON.stringify({
        type: "buttonPress",
        payload: {
          button: payload.settings.whisperlist + ".lWhisper",
          state: false,
        },
      })
    );
    $SD.setState(context, true);
    // Sending TTLW hotkey
  } else {
    if (ttlwActive == false) {
      return;
    } else {
      ttlwActive == false;
      clearInterval(ttlwActiveInterval);

      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: {
            button: payload.settings.whisperlist + ".lWhisper",
            state: true,
          },
        })
      );
      $SD.setState(context, false);
    }
  }
});

lWhisper.onKeyUp(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  // Sending PTLW hotkey
  if (payload.settings.pushtotalk === "on") {
    TeamSpeakWebsocket.send(
      JSON.stringify({
        type: "buttonPress",
        payload: {
          button: payload.settings.whisperlist + ".lWhisper",
          state: true,
        },
      })
    );
    ttlwActive == false;
    clearInterval(ttlwActiveInterval);
    $SD.setState(context, false);
    // Sending TTLW hotkey
  } else {
    if (ttlwActive) {
      ttlwActive = false;
      return;
    } else {
      ttlwActive = true;
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: {
            button: payload.settings.whisperlist + ".lWhisper",
            state: false,
          },
        })
      );
      ttlwActiveInterval = setInterval(() => {
        TeamSpeakWebsocket.send(
          JSON.stringify({
            type: "buttonPress",
            payload: {
              button: payload.settings.whisperlist + ".lWhisper",
              state: false,
            },
          })
        );
      }, 500);
      $SD.setState(context, true);
    }
  }
});

// ----------------------------------------------------
// |              SENDING QWHISPER HOTKEY             |
// ----------------------------------------------------

const qWhisper = new Action("de.leonmarcel.teamspeak5.qwhisperaction");
let ttqwActive = false;
let ttqwActiveInterval;

qWhisper.onKeyDown(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  // Sending PTQW hotkey
  if (payload.settings.pushtotalk === "on") {
    TeamSpeakWebsocket.send(
      JSON.stringify({
        type: "buttonPress",
        payload: { button: "qWhisper", state: false },
      })
    );
    $SD.setState(context, true);
    // Sending TTQW hotkey
  } else {
    if (ttqwActive == false) {
      return;
    } else {
      ttqwActive == false;
      clearInterval(ttqwActiveInterval);
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: { button: "qWhisper", state: true },
        })
      );
      $SD.setState(context, false);
    }
  }
});

qWhisper.onKeyUp(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  // Sending PTQW hotkey
  if (payload.settings.pushtotalk === "on") {
    TeamSpeakWebsocket.send(
      JSON.stringify({
        type: "buttonPress",
        payload: { button: "qWhisper", state: true },
      })
    );
    ttqwActive == false;
    clearInterval(ttqwActiveInterval);
    $SD.setState(context, false);
    // Sending TTQW hotkey
  } else {
    if (ttqwActive) {
      ttqwActive = false;
      return;
    } else {
      ttqwActive = true;
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: { button: "qWhisper", state: false },
        })
      );
      ttqwActiveInterval = setInterval(() => {
        TeamSpeakWebsocket.send(
          JSON.stringify({
            type: "buttonPress",
            payload: { button: "qWhisper", state: false },
          })
        );
      }, 500);
      $SD.setState(context, true);
    }
  }
});

// ----------------------------------------------------
// |              SENDING RWHISPER HOTKEY             |
// ----------------------------------------------------

const rWhisper = new Action("de.leonmarcel.teamspeak5.rwhisperaction");
let ttrwActive = false;
let ttrwActiveInterval;

rWhisper.onKeyDown(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  // Sending PTRW hotkey
  if (payload.settings.pushtotalk === "on") {
    TeamSpeakWebsocket.send(
      JSON.stringify({
        type: "buttonPress",
        payload: { button: "rwhisper", state: false },
      })
    );
    $SD.setState(context, true);
    // Sending TTRW hotkey
  } else {
    if (ttrwActive == false) {
      return;
    } else {
      ttrwActive == false;
      clearInterval(ttrwActiveInterval);
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: { button: "rwhisper", state: true },
        })
      );
      $SD.setState(context, false);
    }
  }
});

rWhisper.onKeyUp(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  // Sending PTRW hotkey
  if (payload.settings.pushtotalk === "on") {
    TeamSpeakWebsocket.send(
      JSON.stringify({
        type: "buttonPress",
        payload: { button: "rwhisper", state: true },
      })
    );
    ttrwActive == false;
    clearInterval(ttrwActiveInterval);
    $SD.setState(context, false);
    // Sending TTRW hotkey
  } else {
    if (ttrwActive) {
      ttrwActive = false;
      return;
    } else {
      ttrwActive = true;
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: { button: "rwhisper", state: false },
        })
      );
      ttrwActiveInterval = setInterval(() => {
        TeamSpeakWebsocket.send(
          JSON.stringify({
            type: "buttonPress",
            payload: { button: "rwhisper", state: false },
          })
        );
      }, 500);
      $SD.setState(context, true);
    }
  }
});

// ----------------------------------------------------
// |                SENDING PTM HOTKEY                |
// ----------------------------------------------------

const ptm = new Action("de.leonmarcel.teamspeak5.ptmaction");
let ttmActive = false;
let ttmActiveInterval;

ptm.onKeyDown(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  // Sending PTM hotkey
  if (payload.settings.pushtotalk === "on") {
    TeamSpeakWebsocket.send(
      JSON.stringify({
        type: "buttonPress",
        payload: { button: "ptm", state: false },
      })
    );
    $SD.setState(context, true);
    // Sending TTM hotkey
  } else {
    if (ttmActive == false) {
      return;
    } else {
      ttmActive == false;
      clearInterval(ttmActiveInterval);
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: { button: "ptm", state: true },
        })
      );
      $SD.setState(context, false);
    }
  }
});

ptm.onKeyUp(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  // Sending PTM hotkey
  if (payload.settings.pushtotalk === "on") {
    TeamSpeakWebsocket.send(
      JSON.stringify({
        type: "buttonPress",
        payload: { button: "ptm", state: true },
      })
    );
    ttmActive == false;
    clearInterval(ttmActiveInterval);
    $SD.setState(context, false);
    // Sending TTM hotkey
  } else {
    if (ttmActive) {
      ttmActive = false;
      return;
    } else {
      ttmActive = true;
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: { button: "ptm", state: false },
        })
      );
      ttmActiveInterval = setInterval(() => {
        TeamSpeakWebsocket.send(
          JSON.stringify({
            type: "buttonPress",
            payload: { button: "ptm", state: false },
          })
        );
      }, 500);
      $SD.setState(context, true);
    }
  }
});

// ----------------------------------------------------
// |                SENDING PTT HOTKEY                |
// ----------------------------------------------------

const ptt = new Action("de.leonmarcel.teamspeak5.pttaction");
let tttActive = false;
let tttActiveInterval;

ptt.onKeyDown(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  // Sending PTT hotkey
  if (payload.settings.pushtotalk === "on") {
    TeamSpeakWebsocket.send(
      JSON.stringify({
        type: "buttonPress",
        payload: { button: "ptt", state: false },
      })
    );
    $SD.setState(context, true);
    // Sending TTT hotkey
  } else {
    if (tttActive == false) {
      return;
    } else {
      tttActive == false;
      clearInterval(tttActiveInterval);
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: { button: "ptt", state: true },
        })
      );
      $SD.setState(context, false);
    }
  }
});

ptt.onKeyUp(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  // Sending PTT hotkey
  if (payload.settings.pushtotalk === "on") {
    TeamSpeakWebsocket.send(
      JSON.stringify({
        type: "buttonPress",
        payload: { button: "ptt", state: true },
      })
    );
    tttActive == false;
    clearInterval(tttActiveInterval);
    $SD.setState(context, false);
    // Sending TTT hotkey
  } else {
    if (tttActive) {
      tttActive = false;
      return;
    } else {
      tttActive = true;
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: { button: "ptt", state: false },
        })
      );
      tttActiveInterval = setInterval(() => {
        TeamSpeakWebsocket.send(
          JSON.stringify({
            type: "buttonPress",
            payload: { button: "ptt", state: false },
          })
        );
      }, 500);
      $SD.setState(context, true);
    }
  }
});
