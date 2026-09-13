const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const { sessionHandler, codeHandler, connectionHandler } = require('./handlers');

const BOT_NAME = 'Leeskies MD';
const SESSION_DIR = './session';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startPair() {
    // 1. Check existing session
    if (sessionHandler.hasExistingSession(SESSION_DIR)) {
        const answer = await question('⚠️ An active session exists. Overwrite? (y/n): ');
        if (answer.toLowerCase().trim() !== 'y') {
            console.log('Pairing cancelled.');
            process.exit(0);
        }
        sessionHandler.clearSession(SESSION_DIR);
    }

    // 2. Select Method
    console.log(`\n==== ${BOT_NAME} PAIRING ====`);
    console.log('1. Scan QR Code');
    console.log('2. Pairing Code');
    const choice = (await question('Select option (1 or 2): ')).trim();

    let targetPhone = null;
    const isPairingCode = choice === '2';

    if (isPairingCode) {
        const input = await question('\nEnter WhatsApp number (e.g. 234XXXXXXXXXX): ');
        targetPhone = codeHandler.cleanNumber(input);

        if (!targetPhone) {
            console.log('❌ Invalid number format. Re-run and provide a valid country code.');
            process.exit(1);
        }
    }

    // 3. Socket bootstrap
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !isPairingCode,
        auth: state,
        browser: Browsers.macOS('Desktop')
    });

    // 4. Pairing code dispatch
    if (isPairingCode && !sock.authState.creds.registered) {
        try {
            console.log('\n⏳ Requesting pairing code from WhatsApp...');
            const code = await codeHandler.fetchPairingCode(sock, targetPhone);
            const formatted = codeHandler.formatCode(code);

            console.log('--------------------------------------');
            console.log(`🔑 PAIRING CODE: [ ${formatted} ]`);
            console.log('--------------------------------------');
            console.log('👉 Enter this code on your WhatsApp (Linked Devices > Link with phone number)\n');
        } catch (err) {
            console.error('❌ Failed to retrieve pairing code:', err.message);
            process.exit(1);
        }
    }

    // 5. Register events to handlers
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        connectionHandler.handleUpdate(update, BOT_NAME, startPair);
    });
}

startPair();