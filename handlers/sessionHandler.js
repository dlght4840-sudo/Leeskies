const fs = require('fs');
const path = require('path');

const sessionHandler = {
    /**
     * Checks if a valid registered session already exists
     * @param {string} sessionDir 
     * @returns {boolean}
     */
    hasExistingSession: (sessionDir) => {
        const credsPath = path.join(sessionDir, 'creds.json');
        if (!fs.existsSync(credsPath)) return false;

        try {
            const raw = fs.readFileSync(credsPath, 'utf-8');
            const parsed = JSON.parse(raw);
            return Boolean(parsed.registered || parsed.me);
        } catch {
            return false;
        }
    },

    /**
     * Deletes existing session files to allow a clean re-pair
     * @param {string} sessionDir 
     */
    clearSession: (sessionDir) => {
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
            console.log(`[SessionHandler] 🧹 Cleared old session folder at ${sessionDir}`);
        }
        fs.mkdirSync(sessionDir, { recursive: true });
    }
};

module.exports = sessionHandler;