const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const config = require("./config");
const { loadCommands, handleCommand } = require("./commands");

const app = express();
const PORT = process.env.PORT || 3000;

let currentPairingCode = "Generating code, please refresh in a few seconds...";

// Serve pairing code over HTTP for web browsers
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${config.botName} - Pairing</title>
        <style>
          body { font-family: sans-serif; background: #0f172a; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2rem; border-radius: 12px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
          .code { font-size: 2rem; font-weight: bold; color: #22c55e; letter-spacing: 4px; margin: 1.5rem 0; background: #0f172a; padding: 1rem; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>${config.botName} Pairing Code</h2>
          <div class="code">${currentPairingCode}</div>
          <p>Enter this code in <b>WhatsApp > Linked Devices > Link with phone number instead</b>.</p>
        </div>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`[${config.botName}] Web server running on port ${PORT}`);
});

async function startLeeskiesMD() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");

  // Load plugins dynamically
  loadCommands();

  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false, // Prevents Baileys deprecation warning
    auth: state,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
  });

  sock.ev.on("creds.update", saveCreds);

  // Automatic Pairing Code Request for non-registered sessions
  if (!sock.authState.creds.registered) {
    const phoneNumber = config.ownerNumber.replace(/[^0-9]/g, "");

    setTimeout(async () => {
      try {
        const rawCode = await sock.requestPairingCode(phoneNumber);
        currentPairingCode = rawCode?.match(/.{1,4}/g)?.join("-") || rawCode;

        console.log(`\n=================================`);
        console.log(`🤖 BOT NAME: ${config.botName}`);
        console.log(`📱 PHONE NUMBER: ${phoneNumber}`);
        console.log(`🔑 PAIRING CODE: \x1b[32m${currentPairingCode}\x1b[0m`);
        console.log(`=================================\n`);
      } catch (err) {
        console.error("❌ Failed to generate pairing code:", err.message);
        currentPairingCode = "Error generating code. Check console logs.";
      }
    }, 4000);
  }

  // Handle incoming commands
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    await handleCommand(sock, messages[0]);
  });

  // Handle connection updates
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "connecting") {
      console.log(`[${config.botName}] Connecting to WhatsApp...`);
    } else if (connection === "open") {
      console.log(`✅ [${config.botName}] Connected successfully!`);
      currentPairingCode = "Device already paired and active! ✅";
    } else if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`[${config.botName}] Connection closed (Reason Code: ${statusCode})`);

      if (shouldReconnect) {
        console.log(`[${config.botName}] Reconnecting...`);
        startLeeskiesMD();
      } else {
        console.log(`[${config.botName}] Session logged out. Delete ./session directory and restart.`);
      }
    }
  });
}

startLeeskiesMD();
