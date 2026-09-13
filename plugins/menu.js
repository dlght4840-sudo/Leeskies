module.exports = {
    name: 'menu',
    aliases: ['help', 'list'],
    category: 'general',
    desc: 'Show list of available commands',
    async execute({ reply, prefix, commandManager }) {
        let menuText = `╭───────────────╮\n    *LEESKIES MD*\n╰───────────────╯\n`;
        menuText += `⚡ *Prefix:* [ ${prefix} ]\n`;
        menuText += `📦 *Total Commands:* ${commandManager.commands.size}\n`;
        menuText += `─────────────────\n\n`;

        for (const [name, cmd] of commandManager.commands) {
            menuText += `◦ *${prefix}${name}* : ${cmd.desc || 'No description'}\n`;
        }

        menuText += `\n─────────────────\n💡 Type any command above to use it.`;
        await reply(menuText);
    }
};