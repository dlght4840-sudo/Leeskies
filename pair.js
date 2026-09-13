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
const fs = require('fs');

const SESSION_DIR = './session';

// Setup console input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startPairing() {
    // 1. Ensure clean session state for a new pair
    if (!fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();

    // 2. Ask for the phone number
    console.log('\n=================================================');
    console.log('            LEESKIES MD - PAIR CODE SETUP        ');
    console.log('=================================================');

    let phone = await question('📱 Enter your WhatsApp number (with country code, e.g. 234XXXXXXXXXX): ');
    phone = phone.replace(/[^0-9]/g, '');

    if (!phone || phone.length < 10) {
        console.log('❌ Invalid phone number. Please run the script again.');
        process.exit(1);
    }

    // 3. Initialize socket with QR disabled
    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Strictly disabled
        auth: state,
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: false
    });

    // 4. Request the 8-digit code from WhatsApp
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const rawCode = await sock.requestPairingCode(phone);
                // Formats code as ABCD-1234
                const formattedCode = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;

                console.log('\n=================================================');
                console.log(`🔑 YOUR PAIRING CODE: [ ${formattedCode} ]`);
                console.log('=================================================');
                console.log('📌 HOW TO LINK:');
                console.log('1. Open WhatsApp on your phone.');
                console.log('2. Tap 3 dots (top right) > Linked Devices.');
                console.log('3. Tap "Link a Device".');
                console.log('4. Tap "Link with phone number instead" at the bottom.');
                console.log('5. Enter the code above.\n');
            } catch (err) {
                console.error('❌ Failed to retrieve pairing code:', err.message);
                process.exit(1);
            }
        }, 3000); // 3-second delay ensures socket handshake is ready
    }

    // 5. Save updated credentials to ./session
    sock.ev.on('creds.update', saveCreds);

    // 6. Monitor connection status
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log('\n=================================================');
            console.log('🎉 DEVICE SUCCESSFULLY LINKED TO LEESKIES MD!');
            console.log(`🤖 Logged in as: ${sock.user.id.split(':')[0]}`);
            console.log('📁 Credentials saved inside ./session folder.');
            console.log('=================================================');
            console.log('👉 You can now stop this script and start: node index.js\n');
            process.exit(0);
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error instanceof Boom)?.output?.statusCode;
            const isLoggedOut = statusCode === DisconnectReason.loggedOut;

            if (isLoggedOut) {
                console.log('❌ Pairing failed: Device was logged out. Try again.');
                process.exit(1);
            } else {
                console.log('⚠️ Handshake interrupted. Retrying connection...');
                startPairing();
            }
        }
    });
}

startPairing();