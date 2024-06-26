const client = require('../bin/discord.js');

const fetch = require('node-fetch');

const rateLimits = new Map();
const reportedChannels = new Set();

module.exports = async (bot, message) => {
	if (message.channel.type === 'news') {
		const { config, options: { http }, rest } = bot;
		const { channel, guild, author } = message;

		const consoleWarn = async (event) => {
			let entry = '';
			const owner = await client.users.fetch(message.guild.ownerID);

			const logAssets = {
				channel: `Channel: #${channel.name} (${channel.id})`,
				server: `Server: "${guild.name}" (${guild.id}), owner: ${owner.username}#${owner.discriminator} (${owner.id})`,
				author: `Author: ${author.username}#${author.discriminator} (${author.id}) ${message.webhookID ? '- Webhook' : ''}`,
				message: `Message content: ${message.embeds[0] !== undefined ? `${message.content}\n* Embed:\n${JSON.stringify(message.embeds[0], (key, value) => { if (value !== null) return value; }, 2)}` : message.content}`,
			};

			const addAsset = (...assets) => {
				assets.forEach(asset => {
					entry += `\n${logAssets[asset]}`;
				});
			};

			switch (event) {
			case 'rateLimited':
				entry += `Channel is being rate limited! Count: ${rateLimits.get(channel.id).count}, threshold: ${config.spamThreshold}`;
				addAsset('channel', 'server', 'author', 'message');
				break;
			case 'missingPerms':
				entry += 'Missing permissions!';
				addAsset('channel', 'server');
				break;
			default:
				console.log(`${global.errorstring}Invalid consoleWarn() instance!`);
				return;
			}

			console.log(global.warnstring + entry);
		};

		// Reports a rate limited channel in console, sends a DM to the bot owner if spam is above the threshold
		if (rateLimits.has(channel.id)) {
			rateLimits.get(channel.id).count++;

			if ((rateLimits.get(channel.id).count >= config.spamThreshold) && !reportedChannels.has(channel.id)) {
				const owner = await client.users.fetch(message.guild.ownerID);
				await client.users.fetch(process.env.DISCORD_BOT_OWNER_ID)
					.then((user) => {
						user.send(`**Spam channel report**\n\nChannel: #${channel.name} (${channel.id})\nServer: "${guild.name}" (${guild.id}), owner: ${owner.username}#${owner.discriminator} (${owner.id})`);
					})
					.catch((error) => console.log(global.errorstring + error));

				reportedChannels.add(channel.id);
			}

			consoleWarn('rateLimited');
			return;
		}

		// Publish the message and check if the channel is being rate limited or missing permissions
		await fetch(
			`${http.api}/v${http.version}/channels/${channel.id}/messages/${message.id}/crosspost`,
			{
				method: 'POST',
				headers: {
					'Authorization': `${rest.tokenPrefix} ${process.env.DISCORD_BOT_TOKEN}`,
				},
			},
		)
			.then((res) => res.json())
			.then((json) => {
				if (json.code == 50001 || json.code == 50013) {
					consoleWarn('missingPerms');
				}
				else if (json.retry_after !== undefined) {
					rateLimits.set(channel.id, { count: 1 });

					setTimeout(() => {
						rateLimits.delete(channel.id);
                        if (debugmessage == true) {
						  console.log(`${global.debugstring}Rate limit counter reset for ${channel.id}`);
                        }
					}, json.retry_after);

					consoleWarn('rateLimited');
				}
				else {
					console.log(`${global.infostring}Published ${message.id} in #${channel.name} (${channel.id}) - "${guild.name}" (${guild.id})`);
				}
			});
	}
};