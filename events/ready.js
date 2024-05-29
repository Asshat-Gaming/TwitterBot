module.exports = async client => {
	const config = client;

	console.log(`${global.infostring}Discord: Connected!`);

	let totalMembers = 0;

	console.log(`${global.infostring}Discord: Calculating total members across all servers.`);
	client.guilds.cache.forEach(guild => {
		const { name, id, memberCount: members } = guild;
		totalMembers += members;
	});
	console.log(`${global.infostring}Discord: Publishing on ${client.guilds.cache.size} servers with ${totalMembers} total members.`);
};