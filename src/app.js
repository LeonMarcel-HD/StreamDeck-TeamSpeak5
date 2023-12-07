/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />

// TeamSpeak stuff
let TeamSpeakWebsocket;
let TeamSpeakIsConnected = false; // TeamSpeak socket status

// Elgato context ids of buttons
let afkContexts = []; // Stores all context ids of afk buttons
let micMuteContexts = []; // Stores all context ids of mute buttons
let outputMuteContexts = []; // Stores all context ids of output buttons
let overlayContexts = []; // Stores all context ids of overlay buttons

// Elgato button registration / button logic
const micMute = new Action("de.leonmarcel.teamspeak5.muteaction");
const soundMute = new Action("de.leonmarcel.teamspeak5.soundmuteaction");
const afk = new Action("de.leonmarcel.teamspeak5.afkaction");
const overlaybtn = new Action("de.leonmarcel.teamspeak5.overlay");
const lWhisper = new Action("de.leonmarcel.teamspeak5.lwhisperaction");
const qWhisper = new Action("de.leonmarcel.teamspeak5.qwhisperaction");
const rWhisper = new Action("de.leonmarcel.teamspeak5.rwhisperaction");
const ptm = new Action("de.leonmarcel.teamspeak5.ptmaction");
const ptt = new Action("de.leonmarcel.teamspeak5.pttaction");
let ttlwActive = false;
let ttqwActive = false;
let ttrwActive = false;
let ttmActive = false;
let tttActive = false;
let settings;

// Overlay lists
let userarray = []; // Array to store all users in the current channel
let talkingurls = []; // Links of myts avatars that are talking

// The first event when Stream Deck starts
// Getting global settings and sending to to PI for them to use
$SD.onConnected(
  ({ actionInfo, appInfo, connection, messageType, port, uuid }) => {
    $SD.getGlobalSettings(uuid);
    $SD.sendToPropertyInspector(uuid);

    console.log("Stream Deck -- Connected: ");
  }
);

// Saving the APIKey from TeamSpeak into the Elgato settings database
$SD.on("didReceiveGlobalSettings", ({ event, payload }) => {
  console.log("Stream Deck -- Settings received: ");
  settings = payload.settings;
  console.log(payload);
  createTeamSpeakSocket();
});

// Reconnect methode if a disconnect happens
const reconnectTeamSpeak = async () => {
  await new Promise((r) => setTimeout(r, 5000));
  console.log("TeamSpeak -- Trying to reconnect: ");
  createTeamSpeakSocket();
};

const createTeamSpeakSocket = () => {
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
            version: "1.1.0",
            name: "Stream Deck Plugin",
            description:
              "Stream Deck Plugin to send Hotkeys to TeamSpeak | @LeonMarcelHD",
            content: {
              apiKey: settings.apiKey || "",
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
    // console.log(data.payload);
    if (data.status && data.status.code !== 0) {
      console.log("TeamSpeak -- Error: ");
      console.log(data.status.message);
      TeamSpeakIsConnected = false;
      return;
    }
    // Handle auth events
    if (data.type === "auth") {
      console.log("TeamSpeak -- Auth: ");
      TeamSpeakIsConnected = true;
      settings.apiKey = data.payload.apiKey;
      settings.connectionStatus = TeamSpeakIsConnected;
      $SD.setGlobalSettings(settings);

      if (TeamSpeakIsConnected) {
        console.log(data.payload.connections);
        if (data.payload.connections.length != 0) {
          data.payload.connections.forEach((connection) => {
            connection.clientInfos.forEach((element) => {
              userarray[String(element.id)] = [];
              userarray[String(element.id)]["user"] =
                element.properties.nickname;
              userarray[String(element.id)]["avatar"] =
                element.properties.myteamspeakAvatar;
            });
          });
        }
      }

      // Handle self client properties events
    } else if (data.type === "clientSelfPropertyUpdated") {
      // -> split into inputMuted
      if (data.payload.flag === "inputMuted") {
        micMuteContexts.forEach((context) => {
          $SD.setState(context, data.payload.newValue);
        });
      }
      // -> split into outputMuted
      if (data.payload.flag === "outputMuted") {
        outputMuteContexts.forEach((context) => {
          $SD.setState(context, data.payload.newValue);
        });
      }
      // -> split into away
      if (data.payload.flag === "away") {
        afkContexts.forEach((context) => {
          $SD.setState(context, data.payload.newValue);
        });
      }
    } else if (data.type === "talkStatusChanged") {
      url = userarray[String(data.payload.clientId)]["avatar"]
        .split(";")
        .sort(
          (a, b) =>
            ["2", "3", "4", "1"].indexOf(a[0]) -
            ["2", "3", "4", "1"].indexOf(b[0])
        )[0]
        .split(",")[1];
      if (data.payload.status === 1) {
        console.log(
          userarray[String(data.payload.clientId)]["user"] + " spricht gerade"
        );
        talkingurls.push([
          data.payload.connectionId,
          data.payload.clientId,
          url,
        ]);
      } else {
        console.log(
          userarray[String(data.payload.clientId)]["user"] +
            " spricht nicht mehr"
        );
        talkingurls = talkingurls.filter(function (value) {
          return !(
            value[0] === data.payload.connectionId &&
            value[1] === data.payload.clientId
          );
        });
      }
      urls = talkingurls.map(function (value) {
        return value[2];
      });
      // TODO: count total number of users in channel to display it in the top left corner
      generateMultiAvatarImage(urls, talkingurls.length).then((dataUrl) => {
        overlayContexts.forEach((context) => {
          $SD.setImage(context, dataUrl);
        });
      });
    } else if (data.type === "clientMoved") {
      if (
        data.payload.oldChannelId == "0" &&
        data.payload.properties !== null
      ) {
        userarray[String(data.payload.clientId)] = [];
        userarray[String(data.payload.clientId)]["user"] =
          data.payload.properties.nickname;
        userarray[String(data.payload.clientId)]["avatar"] =
          data.payload.properties.myteamspeakAvatar;
      }
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
    console.log("TeamSpeak -- Disconnected: "); //TODO remove users from overlay when closing client
    TeamSpeakIsConnected = false;
    settings.connectionStatus = TeamSpeakIsConnected;
    $SD.setGlobalSettings(settings);
    reconnectTeamSpeak();
  };
};

// ----------------------------------------------------
// |            UPDATE STREAM DECK ICONS              |
// ----------------------------------------------------

// Update Mic
micMute.onWillAppear(({ context }) => {
  micMuteContexts.push(context);
});

micMute.onWillDisappear(({ context }) => {
  micMuteContexts = micMuteContexts.filter((x) => x != context);
});

// Update Sound
soundMute.onWillAppear(({ context }) => {
  outputMuteContexts.push(context);
});

soundMute.onWillDisappear(({ context }) => {
  outputMuteContexts = outputMuteContexts.filter((x) => x != context);
});

// Update AFK
afk.onWillAppear(({ context }) => {
  afkContexts.push(context);
});

afk.onWillDisappear(({ context }) => {
  afkContexts = afkContexts.filter((x) => x != context);
});

// Update Overlay
overlaybtn.onWillAppear(({ context }) => {
  overlayContexts.push(context);
});

overlaybtn.onWillDisappear(({ context }) => {
  overlayContexts = overlayContexts.filter((x) => x != context);
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
      payload: { button: "mute", state: false },
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
      payload: { button: "mute", state: true },
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
      payload: { button: "soundmute", state: false },
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
      payload: { button: "soundmute", state: true },
    })
  );
});

// AFK
afk.onKeyDown(({ action, context, device, event, payload }) => {
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

afk.onKeyUp(({ action, context, device, event, payload }) => {
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

// ----------------------------------------------------
// |          SENDING LIST WHISPER HOTKEY             |
// ----------------------------------------------------

lWhisper.onKeyDown(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  switch (payload.settings.ptt) {
    // Sending PTLW hotkey
    case 1:
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: {
            button: payload.settings.input + ".lWhisper",
            state: false,
          },
        })
      );
      $SD.setState(context, true);
      // Sending TTLW hotkey
      break;
    case 2:
      $SD.setState(context, true);
  }
});

lWhisper.onKeyUp(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  switch (payload.settings.ptt) {
    // Sending PTLW hotkey
    case 1:
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: {
            button: payload.settings.input + ".lWhisper",
            state: true,
          },
        })
      );
      $SD.setState(context, false);
      break;
    // Sending TTLW hotkey
    case 2:
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: {
            button: payload.settings.input + ".lWhisper",
            state: ttlwActive,
          },
        })
      );
      ttlwActive = !ttlwActive;
      $SD.setState(context, ttlwActive);
  }
});

// ----------------------------------------------------
// |         SENDING QUICK WHISPER HOTKEY             |
// ----------------------------------------------------

qWhisper.onKeyDown(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  switch (payload.settings.ptt) {
    // Sending PTQW hotkey
    case 1:
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: {
            button: "qWhisper",
            state: false,
          },
        })
      );
      $SD.setState(context, true);
      // Sending TTQW hotkey
      break;
    case 2:
      $SD.setState(context, true);
  }
});

qWhisper.onKeyUp(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  switch (payload.settings.ptt) {
    // Sending PTQW hotkey
    case 1:
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: {
            button: "qWhisper",
            state: true,
          },
        })
      );
      $SD.setState(context, false);
      break;
    // Sending TTQW hotkey
    case 2:
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: {
            button: "qWhisper",
            state: ttqwActive,
          },
        })
      );
      ttqwActive = !ttqwActive;
      $SD.setState(context, ttqwActive);
  }
});

// ----------------------------------------------------
// |           SENDING REPLY WHISPER HOTKEY           |
// ----------------------------------------------------

rWhisper.onKeyDown(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  switch (payload.settings.ptt) {
    // Sending PTRW hotkey
    case 1:
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: {
            button: "rwhisper",
            state: false,
          },
        })
      );
      $SD.setState(context, true);
      // Sending TTRW hotkey
      break;
    case 2:
      $SD.setState(context, true);
  }
});

rWhisper.onKeyUp(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  switch (payload.settings.ptt) {
    // Sending PTRW hotkey
    case 1:
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: {
            button: "rwhisper",
            state: true,
          },
        })
      );
      $SD.setState(context, false);
      break;
    // Sending TTRW hotkey
    case 2:
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: {
            button: "rwhisper",
            state: ttrwActive,
          },
        })
      );
      ttrwActive = !ttrwActive;
      $SD.setState(context, ttrwActive);
  }
});

// ----------------------------------------------------
// |                SENDING PTM HOTKEY                |
// ----------------------------------------------------

ptm.onKeyDown(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  switch (payload.settings.ptt) {
    // Sending PTM hotkey
    case 1:
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: {
            button: "ptm",
            state: false,
          },
        })
      );
      $SD.setState(context, true);
      // Sending TTM hotkey
      break;
    case 2:
      $SD.setState(context, true);
  }
});

ptm.onKeyUp(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  switch (payload.settings.ptt) {
    // Sending PTM hotkey
    case 1:
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: {
            button: "ptm",
            state: true,
          },
        })
      );
      $SD.setState(context, false);
      break;
    // Sending TTM hotkey
    case 2:
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: {
            button: "ptm",
            state: ttmActive,
          },
        })
      );
      ttmActive = !ttmActive;
      $SD.setState(context, ttmActive);
  }
});

// ----------------------------------------------------
// |                SENDING PTT HOTKEY                |
// ----------------------------------------------------

ptt.onKeyDown(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  switch (payload.settings.ptt) {
    // Sending PTT hotkey
    case 1:
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: {
            button: "ptt",
            state: false,
          },
        })
      );
      $SD.setState(context, true);
      // Sending TTT hotkey
      break;
    case 2:
      $SD.setState(context, true);
  }
});

ptt.onKeyUp(({ action, context, device, event, payload }) => {
  if (!TeamSpeakIsConnected) {
    $SD.showAlert(context);
    return;
  }
  switch (payload.settings.ptt) {
    // Sending PTT hotkey
    case 1:
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: {
            button: "ptt",
            state: true,
          },
        })
      );
      $SD.setState(context, false);
      break;
    // Sending TTT hotkey
    case 2:
      TeamSpeakWebsocket.send(
        JSON.stringify({
          type: "buttonPress",
          payload: {
            button: "ptt",
            state: tttActive,
          },
        })
      );
      tttActive = !tttActive;
      $SD.setState(context, tttActive);
  }
});

// ----------------------------------------------------
// |         GENERATING IMAGES FOR OVERLAY            |
// ----------------------------------------------------

generateMultiAvatarImage = async (urls, n) => {
  // one images takes up a little over 1/3 of the width (let's say 50px for now)
  // all images are cut into circles
  // images overlap by 1/3 of their radius
  // there will be a max of 6 images
  // the combination of all images will be centered in a square
  // the square will be 144 x 144

  if (urls.length > 6) {
    urls = urls.slice(0, 6);
  }

  canvas_size = 144;
  canvas_center = canvas_size / 2;
  circle_radius = (canvas_size / 6) * 1.05;
  single_offset = (circle_radius / 3) * 2;
  double_offset = (circle_radius / 3) * 5;
  line_shift = canvas_size * 0.05;

  // create a list of images and their positions
  images = [];
  for (var i = 0; i < urls.length; i++) {
    // position describes the center of the image
    y =
      canvas_center +
      (urls.length > 3) * (i < 3 ? -single_offset : single_offset);
    x = canvas_center;
    switch (urls.length) {
      case 1:
        break;
      case 2:
        x += i == 0 ? -single_offset : single_offset;
        break;
      case 3:
        x += i == 0 ? -double_offset : i == 1 ? 0 : double_offset;
        break;
      case 4:
      case 5:
      case 6:
        x += i % 3 == 0 ? -double_offset : i % 3 == 1 ? 0 : double_offset;
        x += i < 3 ? -line_shift : i < 6 ? 0 : line_shift;
        break;
    }

    url = urls[i] || "assets/overlay/default_profilepicture.png";
    image = new Image();
    image.src = url;
    await image.onload;
    images.push({
      img: image,
      x: x,
      y: y,
    });
  }

  // create a canvas
  canvas = document.createElement("CANVAS");
  ctx = canvas.getContext("2d");

  canvas.height = canvas_size;
  canvas.width = canvas_size;

  // draw background from assets/overlay/overlay_blank.png
  bkgrd_image = new Image();
  bkgrd_image.src = "assets/overlay/overlay_blank.png";
  await bkgrd_image.onload;
  ctx.drawImage(bkgrd_image, 0, 0, canvas_size, canvas_size);

  // draw all images
  for (var i = 0; i < images.length; i++) {
    ctx.save();

    // turn image into circle
    ctx.beginPath();
    ctx.arc(images[i].x, images[i].y, circle_radius, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.clip();

    // draw gradient
    pp_bkgrd_image = new Image();
    pp_bkgrd_image.src = "assets/overlay/default_gradient.png";
    await pp_bkgrd_image.onload;
    x = images[i].x - circle_radius;
    y = images[i].y - circle_radius;
    w = circle_radius * 2;
    h = circle_radius * 2;
    ctx.drawImage(pp_bkgrd_image, x, y, w, h);
    // draw image if it is not undefined
    ctx.drawImage(images[i].img, x, y, w, h);

    // reset clip
    ctx.restore();
  }

  // draw number in top left corner with an offset of 10px
  ctx.fillStyle = "#fff";
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  // offset is 10px
  ctx.fillText(n, 10, 10);

  return canvas.toDataURL();
};
