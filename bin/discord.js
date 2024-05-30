'use strict';

const Discord = require('discord.js');
const rimraf = require('rimraf');
const path = require('path');
const moment = require('moment');
const commands = require('./commands');
const FeedsModel = require('./models/feeds');
const PostsModel = require('./models/posts');
const utils = require('./utils');
const state = require('./state');
const myEvents = require('./events');
const fs = require('fs');

if (debugmessage == true) {
  console.log(`${global.debugstring}Loading discordClient.js`);
}

const client = new Discord.Client({
  disableEveryone: true,
  disabledEvents: [
    'TYPING_START',
  ],
  intents: 37379,
});

client.config = require('../config.json');

// Load publishing events
fs.readdir('C:\\TwitterBot\\events\\', (err, files) => {
	if (err) return console.error(err);
	files.forEach((file) => {
		if (!file.endsWith('.js')) return;
		const event = require(`C:\\TwitterBot\\events\\${file}`);
		const eventName = file.split('.')[0];
		client.on(eventName, event.bind(null, client));
		delete require.cache[require.resolve(`C:\\TwitterBot\\events\\${file}`)];
	});
});

process.on('unhandledRejection', (error) => {
	console.log(global.infostring + error.message);
});

// Discord has disconnected
client.on('shardDisconnect', (event, shardID) => {
  console.log(`${global.warnstring}Discord: Disconnected from shard.`);
});

// Discord general warning
client.on('warn', info => {
  console.log(`${global.warnstring}Discord: Warning`);
  console.log(global.warnstring + info);
});

// Discord is reconnecting
client.on('shardReconnecting', id => {
  console.log(`${global.infostring}Discord: Reconnecting to shard with ID ${id += 1}.`);
});

// Discord has resumed
client.on('shardResume', (replayed, shardID) => {
  console.log(`${global.infostring}Discord: Shard ID ${shardID} resumed connection and replayed ${replayed} item(s)`);
});

// Discord has erred
client.on('error', err => {
  console.log(`${global.errorstring}Discord: Error:`);
  console.log(global.warnstring + err);
});

client.on('ready', () => {
  console.log(`${global.infostring}Discord: Connection success`);
  console.log(`${global.infostring}Discord: Connected as '${client.user.username}'`);
  console.log(`${global.infostring}Discord: Command prefix: ${process.env.DISCORD_CMD_PREFIX}`);
  client.user.setPresence({
  activities: [{ name: `news to Discord!`, type: 1, url: `https://twitch.tv/asshatgaming` }],
  status: 'online',
});
});

// Only run the first time the discord client is ready
client.once('ready', () => {
  // Create a timer to check for stale records every hour
  setInterval(checkForStaleRecords, 1000 * 60 * 60);
  // Check for stale records 10 seconds after startup
  setTimeout(checkForStaleRecords, 1000 * 10);
});

client.on('messageCreate', msg => {
  // Don't listen to other bots
  if (msg.author.bot) return;
  // Exit if the message does not start with the prefix set
  if (!msg.content.startsWith(process.env.DISCORD_CMD_PREFIX)) return;
  // Exit if the author of the message is not the bot's owner or the guild's owner
  if (msg.author.id !== process.env.DISCORD_BOT_OWNER_ID
    && msg.author.id !== msg.guild.owner.id) return;
  // Split message into an array on any number of spaces
  msg.params = msg.content.split(/ +/g).map(x => x.toLowerCase()); // eslint-disable-line no-param-reassign
  // Pull first index and remove prefix
  msg.cmd = msg.params.shift() // eslint-disable-line no-param-reassign
    .slice(process.env.DISCORD_CMD_PREFIX.length).toLowerCase();
  // Exit if no command was given (prefix only)
  if (!msg.cmd) return;
  // We only want to focus on 'twitter' commands
  if (msg.cmd !== 'twitter') return;
  // These commands need to be run in a guild text channel to associate the guild id and channel id
  if (msg.channel.type === 'dm') {
    msg.author.send('This command does not work via DM\'s. Please run it in a guild\'s text channel.');
    return;
  }
  if (debugmessage == true) {
    console.log(`${global.debugstring}Discord: [${msg.guild.name}] (#${msg.channel.name}) <${msg.author.tag}>: ${msg.content}`);
  }
  msg.prefix = process.env.DISCORD_CMD_PREFIX; // eslint-disable-line no-param-reassign
  commands(msg);
});

module.exports = {
  connect: () => {
    console.log(`${global.infostring}Discord: Connecting...`);
    client.login(process.env.DISCORD_BOT_TOKEN)
      .catch(err => {
        console.log(`${global.errorstring}Discord: Login error`);
        console.log(global.errorstring + err);
        process.exit(1);
      });
  },
};


myEvents.on('discord_notify', () => {
  while (state.notify.length > 0) {
    // Shift the next notification entry out of the array
    const entry = state.notify.shift();
    // Ensure that this entry is in the list of currently streamed ids
    if (state.ids.includes(entry.twitter_id)) {
      // Get the discord cached data now in case something was changed between being added and now
      const user = client.users.cache.get(entry.user_id);
      const channel = client.channels.cache.get(entry.channel_id);
      // Ensure we have a user and a channel to post to
      if (user && channel) {
        channel.send(`${user}, The twitter feed for **${entry.screen_name}** has synced and will now be posted to this channel.`);
      }
    }
  }
});

myEvents.on('discord_send', (tweet, str, files) => {
  // Get the record for the current feed
  FeedsModel.findOne({ twitter_id: tweet.user.id_str })
    .then(data => {
      if (!data || !data.channels) return;
      // Get channels that exist and we have send message permissions in
      // Mapped into an array of promises
      const channels = data.channels
        .map(c => client.channels.cache.get(c.channel_id))
        .filter(c => c && c.permissionsFor(client.user).has('SEND_MESSAGES'))
        .map(c => channelSend(c, str, files));
      if (channels.length === 0) {
        console.log(`${global.infostring}Tweet: ${tweet.id_str}: No valid Discord channel(s) found to post to. ${data.channels.length} registered`);
        return;
      }
      // Send to Discord channels
      utils.promiseSome(channels)
        .then(promiseResults => {
          console.log(`${global.infostring}Tweet: ${tweet.id_str}: Posted to ${promiseResults.filter(x => x).length}/${data.channels.length} Discord channel(s)`);
          const entry = new PostsModel({
            tweet_id: tweet.id_str,
            messages: promiseResults,
          });
          entry.save();
          // Remove the temp directory we made for converting gifs if it exists
          rimraf(path.join(process.env.TEMP, `tweet-${tweet.id_str}`), () => {
          });
        });
    });
});

function channelSend(channel, str, files) {
  return new Promise((resolve, reject) => {
    channel.send(str, { files })
      .then(message => resolve({ channel_id: channel.id, message_id: message.id }))
      .catch(reject);
  });
}

function checkForStaleRecords() {
  if (debugmessage == true) {
    console.log(`${global.debugstring}Checking for stale feed records`);
  }
  FeedsModel.find()
    .then(records => {
      if (debugmessage == true) {
        console.log(`${global.debugstring}${records.length} total results`);
      }
      let removedRecords = 0;
      let removedChannels = 0;
      records.forEach(record => {
        // Remove record if there have been no channels registered to it for over 3 days
        if ((!record.channels || record.channels.length === 0) && moment(record.modified_on).add(3, 'd') < moment()) {
          if (debugmessage == true) {
            console.log(`${global.debugstring}Record has no or 0 channels for over 3 days, removing record: ${record.screen_name}`);
          }
          removedRecords++;
          record.remove()
            .then(() => {
              if (debugmessage == true) {
                console.log(`${global.debugstring}Record removed: ${record.screen_name}`);
              }
            });
          return;
        }
        console.log(`${global.infostring}Checking channels for: ${record.screen_name}`);
        // Loop through the registered channels and ensure they still exist
        // and have send permissions at a minimum
        const validChannels = [];
        record.channels.forEach(x => {
          if (moment(x.created_at).add(3, 'd') > moment()) {
            // This record was created within the last 3 days
            // Give them time to get their permissions correctly set
            // Consider valid
            validChannels.push(x);
            return;
          }
          const guild = client.guilds.cache.get(x.guild_id);
          if (!guild || !guild.available) {
            if (debugmessage == true) {
              console.log(`${global.debugstring}The guild ${x.guild_id} does not exist or is unavailable`);
            }
            return;
          }
          const channel = client.channels.cache.get(x.channel_id);
          if (!channel || !channel.permissionsFor(client.user).has('SEND_MESSAGES')) {
            if (debugmessage == true) {
              console.log(`${global.debugstring}The channel ${x.channel_id} does not exist or is unavailable`);
            }
            return;
          }
          validChannels.push(x);
        });
        if (validChannels.length === 0) {
          // There are no valid channels left
          if (debugmessage == true) {
            console.log(`${global.debugstring}No channels left for this record after validating accessibility, removing record: ${record.screen_name}`);
          }
          removedRecords++;
          record.remove()
            .then(() => {
              if (debugmessage == true) {
                console.log(`${global.debugstring}Record removed: ${record.screen_name}`);
              }
            });
          return;
        }
        // See if the amount of valid channels has changed
        if (record.channels.length !== validChannels.length) {
          const diff = record.channels.length - validChannels.length;
          // Update the record with the valid channels
          if (debugmessage == true) {
            console.log(`${global.debugstring}Updating record - minus ${diff} channels`);
          }
          removedChannels += diff;
          const entry = FeedsModel(record);
          entry.channels = validChannels;
          entry.save({ upsert: true })
            .then(() => {
              if (debugmessage == true) {
                console.log(`${global.debugstring}Record updated: ${record.screen_name}`);
              }
            });
        }
      });
      if (removedRecords === 0 && removedChannels === 0) {
        if (debugmessage == true) {
          console.log(`${global.debugstring}No stale records`);
        }
        return;
      }
      console.log(`${global.infostring}Removed ${removedRecords} stale record(s) and ${removedChannels} stale channel(s) from the database`);
      state.reload = true;
    });
}