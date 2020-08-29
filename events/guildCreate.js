const client = require('../bin/discord.js');

module.exports = async (bot, guild) => {
	const { config, plogger } = bot;
	const { name, id, memberCount } = guild;

	const members = memberCount.toLocaleString(config.log.locale);

	if (config.serversBlacklist.includes(id)) {
		plogger.log(`Blacklisted guild join "${name}" (${id}) with ${members} members. Leaving.`);
		guild.leave();
		return;
	}

	plogger.log(`Joined "${name}" (${id}) with ${members} members. Servers: ${client.guilds.cache.size}`);
};