const client = require('../bin/discord.js');

module.exports = async (bot, guild) => {
	const config = bot;
	const { name, id, memberCount } = guild;

	const members = memberCount;

	console.log(`${global.infostring}Left "${name}" (${id}) with ${members} members. Servers: ${client.guilds.cache.size}`);
};