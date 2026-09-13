const codeHandler = {
    /**
     * Sanitizes phone input into E.164-compatible numbers without '+'
     * @param {string} phone 
     * @returns {string|null}
     */
    cleanNumber: (phone) => {
        if (!phone) return null;
        const cleaned = phone.replace(/[^0-9]/g, '');
        // Basic international validation (10 to 15 digits)
        if (cleaned.length < 10 || cleaned.length > 15) {
            return null;
        }
        return cleaned;
    },

    /**
     * Formats 8-character pairing code into XXXX-XXXX format
     * @param {string} code 
     * @returns {string}
     */
    formatCode: (code) => {
        if (!code) return '';
        return code.match(/.{1,4}/g)?.join('-') || code;
    },

    /**
     * Requests the pairing code safely with a delay
     * @param {object} sock - Baileys socket instance
     * @param {string} phoneNumber 
     * @returns {Promise<string>}
     */
    fetchPairingCode: async (sock, phoneNumber) => {
        // WhatsApp requires a short delay before calling requestPairingCode
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return await sock.requestPairingCode(phoneNumber);
    }
};

module.exports = codeHandler;