module.exports = async (bot, info) => {
	const { plogger } = bot;
	plogger.log(JSON.stringify(info), 'warn');
};