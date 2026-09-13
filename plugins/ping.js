module.exports = {
    name: 'ping',
    aliases: ['p', 'speed'],
    category: 'general',
    desc: 'Check response speed of the bot',
    ownerOnly: false,
    groupOnly: false,
    async execute({ reply }) {
        const start = Date.now();
        await reply('🏓 *Pong!*');
        const latency = Date.now() - start;
        await reply(`⚡ Latency: *${latency}ms*`);
    }
};