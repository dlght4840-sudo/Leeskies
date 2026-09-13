const { DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

const connectionHandler = {
    /**
     * Handles state changes during pairing
     * @param {object} update - connection.update payload
     * @param {string} botName - Bot identifier
     * @param {Function} onReconnect - Callback if reconnect is allowed
     */
    handleUpdate: async (update, botName, onReconnect) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log('\n========================================');
            console.log(`✅ [${botName}] SUCCESSFULLY LINKED!`);
            console.log('📁 Credentials saved in session folder.');
            console.log('🚀 You can now start the bot using: node index.js');
            console.log('========================================\n');
            process.exit(0);
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error instanceof Boom)?.output?.statusCode;
            const errorMsg = lastDisconnect?.error?.message || 'Unknown error';

            console.log(`[ConnectionHandler] Connection closed: ${errorMsg} (Code: ${statusCode})`);

            const shouldRetry =
                statusCode !== DisconnectReason.loggedOut &&
                statusCode !== DisconnectReason.connectionReplaced;

            if (shouldRetry) {
                console.log('🔄 Re-attempting handshake in 3 seconds...');
                setTimeout(onReconnect, 3000);
            } else {
                console.log('❌ Session was rejected or logged out. Please re-run pair.js.');
                process.exit(1);
            }
        }
    }
};

module.exports = connectionHandler;