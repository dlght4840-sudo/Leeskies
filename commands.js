const fs = require('fs');
const path = require('path');

class CommandManager {
    constructor() {
        this.commands = new Map();
        this.aliases = new Map();
        this.pluginsDir = path.join(__dirname, 'plugins');
        this.prefix = '.'; // Default prefix
        this.ownerNumbers = ['234XXXXXXXXXX@s.whatsapp.net']; // Add owner JIDs here
    }

    /**
     * Dynamically reads and loads all command files in the plugins folder
     */
    loadPlugins() {
        if (!fs.existsSync(this.pluginsDir)) {
            fs.mkdirSync(this.pluginsDir, { recursive: true });
        }

        this.commands.clear();
        this.aliases.clear();

        const files = fs.readdirSync(this.pluginsDir).filter((file) => file.endsWith('.js'));

        console.log(`\n📦 [Leeskies MD] Loading plugins...`);
        for (const file of files) {
            try {
                const filePath = path.join(this.pluginsDir, file);
                
                // Clear require cache for hot-reload support
                delete require.cache[require.resolve(filePath)];
                const plugin = require(filePath);

                if (!plugin.name || typeof plugin.execute !== 'function') {
                    console.log(`⚠️ Skipped ${file}: Missing 'name' or 'execute' function.`);
                    continue;
                }

                this.commands.set(plugin.name.toLowerCase(), plugin);

                if (Array.isArray(plugin.aliases)) {
                    for (const alias of plugin.aliases) {
                        this.aliases.set(alias.toLowerCase(), plugin.name.toLowerCase());
                    }
                }

                console.log(`  ✔ Loaded: [ ${plugin.name} ]`);
            } catch (err) {
                console.error(`❌ Error loading plugin ${file}:`, err.message);
            }
        }
        console.log(`✅ Finished loading ${this.commands.size} command(s).\n`);
    }

    /**
     * Extracts text body from any WhatsApp message type (text, caption, etc.)
     */
    extractMessageBody(msg) {
        if (!msg.message) return '';
        const m = msg.message;
        return (
            m.conversation ||
            m.extendedTextMessage?.text ||
            m.imageMessage?.caption ||
            m.videoMessage?.caption ||
            m.buttonsResponseMessage?.selectedButtonId ||
            m.templateButtonReplyMessage?.selectedId ||
            ''
        );
    }

    /**
     * Main handler that intercepts incoming messages and executes matched commands
     * @param {object} sock - Baileys socket instance
     * @param {object} m - Raw Baileys message object
     */
    async handleMessage(sock, m) {
        try {
            // Ignore status broadcasts, self-messages, or messages without content
            if (!m.message || m.key.remoteJid === 'status@broadcast' || m.key.fromMe) return;

            const chatJid = m.key.remoteJid;
            const isGroup = chatJid.endsWith('@g.us');
            const senderJid = isGroup ? m.key.participant : chatJid;
            const cleanSender = senderJid ? senderJid.replace(/:\d+/, '') : '';

            const body = this.extractMessageBody(m).trim();
            if (!body.startsWith(this.prefix)) return;

            // Parse command and arguments
            const args = body.slice(this.prefix.length).trim().split(/\s+/);
            const cmdName = args.shift().toLowerCase();
            const text = args.join(' ');

            // Find command directly or via alias
            const commandKey = this.aliases.get(cmdName) || cmdName;
            const cmd = this.commands.get(commandKey);

            if (!cmd) return; // Command not found

            // Helper for quick replies
            const reply = async (content) => {
                return await sock.sendMessage(chatJid, { text: content }, { quoted: m });
            };

            // Permission Checks
            const isOwner = this.ownerNumbers.includes(cleanSender);

            if (cmd.ownerOnly && !isOwner) {
                return reply('❌ This command is restricted to the bot owner.');
            }

            if (cmd.groupOnly && !isGroup) {
                return reply('👥 This command can only be used in groups.');
            }

            // Execute the command
            await cmd.execute({
                sock,
                m,
                args,
                text,
                chatJid,
                senderJid: cleanSender,
                isGroup,
                isOwner,
                reply,
                prefix: this.prefix,
                command: cmdName,
                commandManager: this
            });

        } catch (error) {
            console.error('[Command Execution Error]:', error);
            await sock.sendMessage(m.key.remoteJid, {
                text: `⚠️ *Command Error:* ${error.message}`
            }, { quoted: m });
        }
    }
}

module.exports = new CommandManager();