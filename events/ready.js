const client = require('../bin/discord.js');

module.exports = async bot => {
	const { config, plogger } = bot;

	plogger.log('Connected!', 'ready');

	let totalMembers = 0;

	plogger.log('Calculating total members across all servers.', 'debug');
	plogger.log('Checking for blacklisted guilds.');
	client.guilds.cache.forEach(guild => {
		const { name, id, memberCount: members } = guild;
		if (config.serversBlacklist.includes(id)) {
			plogger.log(`Blacklisted guild: "${name}" (${id}). Leaving.`);
			guild.leave();
		}
		else {
			totalMembers += members;
		}
	});
	plogger.log(`Publishing on ${client.guilds.cache.size} servers with ${totalMembers.toLocaleString(config.log.locale)} total members.`, 'info');
};