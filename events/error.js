module.exports = async (bot, error) => {
	const { plogger } = bot;
	plogger.log(JSON.stringify(error), 'error');
};