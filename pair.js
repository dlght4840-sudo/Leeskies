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

// Setup terminal input helper
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startPairing() {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();

    console.log('\n======================================');
    console.log('       LEESKIES MD - PAIRING SETUP     ');
    console.log('======================================');
    console.log('1. Scan QR Code');
    console.log('2. Generate 8-Digit Pairing Code');
    console.log('--------------------------------------');

    const choice = (await question('Select pairing method (1 or 2): ')).trim();

    const isPairingCode = choice === '2';
    let phoneNumber = '';

    if (isPairingCode) {
        phoneNumber = await question('\nEnter your WhatsApp number (with country code, e.g. 234XXXXXXXXXX): ');
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

        if (!phoneNumber || phoneNumber.length < 10) {
            console.log('❌ Invalid phone number. Please re-run the script.');
            process.exit(1);
        }
    }

    // Initialize socket
    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !isPairingCode, // Baileys auto-prints QR if true
        auth: state,
        browser: Browsers.macOS('Desktop')
    });

    // Request pairing code if selected and not yet linked
    if (isPairingCode && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
                
                console.log('\n--------------------------------------');
                console.log(`🔑 YOUR PAIRING CODE: [ ${formattedCode} ]`);
                console.log('--------------------------------------');
                console.log('📌 Enter this on WhatsApp: Linked Devices > Link with phone number instead.\n');
            } catch (err) {
                console.error('❌ Failed to request pairing code:', err.message);
                process.exit(1);
            }
        }, 3000);
    }

    // Save session data
    sock.ev.on('creds.update', saveCreds);

    // Watch connection status
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log('\n======================================');
            console.log('✅ LINKED SUCCESSFULLY!');
            console.log(`🤖 Device ID: ${sock.user.id.split(':')[0]}`);
            console.log(`📁 Session stored in: ${SESSION_DIR}`);
            console.log('======================================');
            console.log('You can now run: node index.js\n');
            process.exit(0);
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error instanceof Boom)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                console.log('⚠️ Connection dropped. Retrying...');
                startPairing();
            } else {
                console.log('❌ Pairing failed or was logged out. Please try again.');
                process.exit(1);
            }
        }
    });
}

startPairing();