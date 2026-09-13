const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const readline = require('readline');

// Configuration
const BOT_NAME = 'Leeskies MD';
const SESSION_DIR = './session';
const USE_PAIRING_CODE = false; // Set to true if you want an 8-digit code instead of scanning QR
const PHONE_NUMBER = '234XXXXXXXXXX'; // Your number (with country code, no '+') if USE_PAIRING_CODE is true

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startLeeskiesMD() {
    // 1. Load session credentials from local storage
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`\n================================`);
    console.log(`⚡ Initializing ${BOT_NAME}...`);
    console.log(`📦 Baileys Version: v${version.join('.')} (Latest: ${isLatest})`);
    console.log(`================================\n`);

    // 2. Initialize the WhatsApp Socket
    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }), // Suppress verbose engine logs
        printQRInTerminal: !USE_PAIRING_CODE,
        auth: state,
        browser: Browsers.macOS('Desktop'), // Prevents suspicious login flags
        generateHighQualityLinkPreview: true,
        syncFullHistory: false
    });

    // 3. Pairing Code Logic (if enabled & not registered yet)
    if (USE_PAIRING_CODE && !sock.authState.creds.registered) {
        let phoneNumber = PHONE_NUMBER;
        if (!phoneNumber || phoneNumber.includes('X')) {
            phoneNumber = await question('📱 Enter your WhatsApp phone number (with country code): ');
        }
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

        setTimeout(async () => {
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n🔑 Your Pairing Code for ${BOT_NAME}: [ ${code} ]\n`);
        }, 3000);
    }

    // 4. Save session updates whenever credentials change
    sock.ev.on('creds.update', saveCreds);

    // 5. Connection lifecycle management
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'close') {
            const shouldReconnect =
                (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

            console.log(`[!] Connection closed. Reason:`, lastDisconnect?.error?.message || 'Unknown');

            if (shouldReconnect) {
                console.log(`🔄 Reconnecting ${BOT_NAME}...`);
                startLeeskiesMD();
            } else {
                console.log(`❌ Logged out. Delete the '${SESSION_DIR}' folder and scan again.`);
                process.exit(0);
            }
        } else if (connection === 'open') {
            console.log(`\n========================================`);
            console.log(`✅ ${BOT_NAME} IS SUCCESSFULLY CONNECTED!`);
            console.log(`🤖 Logged in as: ${sock.user.id.split(':')[0]}`);
            console.log(`========================================\n`);
        }
    });

    // 6. Message Event Hook (ready for your command router)
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        // Command handler/router goes here
    });

    return sock;
}

startLeeskiesMD();