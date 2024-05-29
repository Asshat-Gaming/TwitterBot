'use strict';

const fs = require('fs');
const commandExistsSync = require('command-exists').sync;
const version = require('./package.json').version;
require('dotenv').config({ path: './.env' });
global.colors = require ('colors');
global.errorstring = '[ERROR] '.red + ' '.white;
global.warnstring = '[WARNING] '.magenta + ' '.white;
global.infostring = '[INFO] '.yellow + ' '.white;
global.debugstring = '[DEBUG] '.gray + ' '.white;
global.debugmessage = false;

console.log(`${global.infostring}Starting the twitter-to-discord application v${version}`);

// Extract all the env variables we will be using
const {
  TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET,
  TWITTER_ACCESS_TOKEN_KEY,
  TWITTER_ACCESS_TOKEN_SECRET,
  MONGO_URI,
  DISCORD_BOT_TOKEN,
  DISCORD_CMD_PREFIX,
  DISCORD_BOT_OWNER_ID,
  TEMP,
} = process.env;

// Exit if the env variable was not set or passed. None can be empty
function envTest(value, name) {
  var name=value;
  if (!value) {
    console.log(`${global.errorstring}Missing the environment variable '${name}'`);
    process.exit(1);
  }
}

envTest(TWITTER_CONSUMER_KEY, 'TWITTER_CONSUMER_KEY');
envTest(TWITTER_CONSUMER_SECRET, 'TWITTER_CONSUMER_SECRET');
envTest(TWITTER_ACCESS_TOKEN_KEY, 'TWITTER_ACCESS_TOKEN_KEY');
envTest(TWITTER_ACCESS_TOKEN_SECRET, 'TWITTER_ACCESS_TOKEN_SECRET');
envTest(MONGO_URI, 'MONGO_URI');
envTest(DISCORD_BOT_TOKEN, 'DISCORD_BOT_TOKEN');
envTest(DISCORD_CMD_PREFIX, 'DISCORD_CMD_PREFIX');
envTest(DISCORD_BOT_OWNER_ID, 'DISCORD_BOT_OWNER_ID');
envTest(TEMP, 'TEMP');

process.env.TEMP = 'C:/Windows/TEMP';

// Ensure we can access the temp directory
try {
  fs.accessSync(process.env.TEMP, fs.constants.F_OK);
} catch (err) {
  console.log(`${global.errorstring}Unable to access the temp directory: ${process.env.TEMP}`);
  console.log(global.errorstring + err);
  process.exit(1);
}

// Ensure all the commands we need to function exist via PATH
if (!commandExistsSync('ffmpeg')) {
  console.log(`${global.errorstring}\'ffmpeg\' is not available on the command line`);
  process.exit(1);
}
if (!commandExistsSync('magick')) {
  console.log(`${global.errorstring}\'magick\' is not available on the command line`);
  process.exit(1);
}

// Passed all the startup tests
// Continue to load application
require('./bin');