const chalk = require('chalk');
const moment = require('moment');
const { log } = require('../config.json');

exports.log = (content, type = 'log') => {

	const levels = ['info', 'log', 'debug'];

	if (!levels.includes(log.loggingLevel)) throw new TypeError(`Valid logging levels: ${levels.join(', ')}`);
	if (levels.includes(type)) {
		if (levels.indexOf(type) > levels.indexOf(log.loggingLevel)) return;
	}

	const types = {
		log: ['blue'],
		info: ['magenta'],
		debug: ['cyan'],
		ready: ['green'],
		warn: ['yellow'],
		error: ['red'],
	};

	const timestamp = `[${moment().format(log.timeFormat)}]`;

	function logType(label, textColor = 'white') {
		return console.log(`${timestamp} ${chalk[textColor](label.toUpperCase())} ${content} `);
	}

	if (Object.keys(types).includes(type)) {
		return logType(type, ...types[type]);
	}
	else {
		throw new TypeError(`Valid logger types: ${Object.keys(types)}`);
	}
};

for (const type of ['error', 'warn', 'debug']) {
	exports[type] = (...args) => this.log(...args, type);
}