'use strict';

const Discord = require('discord.js');
const FeedsModel = require('./models/feeds');
const state = require('./state');
const twitter = require('./twitter');
const myEvents = require('./events');

if (debugmessage == true) {
  console.log(`${global.debugstring}Loading discordCommandHandler.js`);
}

module.exports = msg => {
  // If only the command was run with no parameters show the root usage message
  if (msg.params.length === 0) {
    if (debugmessage == true) {
      console.log(`${global.debugstring}No parameters, unable to continue, sending usage`);
    }
    msg.channel.send(`Usage: \`\`${msg.prefix}${msg.cmd} <add | remove | list>\`\``);
    return;
  }

  // Get the command action - add | remove | list
  const action = msg.params[0];
  // Get the command target. For add and remove this will be a Twitter screen name
  const target = msg.params[1];
  if (debugmessage == true) {
    console.log(`${global.debugstring}Sction: ${action} target: ${target}`);
  }

  // Decide what action to take
  switch (action) {
    case 'add':
      if (!hasTarget()) return;
      lookupTarget(target, msg)
        .then(user => {
          if (user === false) return;
          getSingleRecord(user.id_str)
            .then(record => addChannel(msg, user, record));
        });
      break;
    case 'remove':
      if (!hasTarget()) return;
      lookupTarget(target, msg)
        .then(user => {
          if (user === false) return;
          getSingleRecord(user.id_str)
            .then(record => removeChannel(msg, user, record));
        });
      break;
    case 'list':
      getAllRecords()
        .then(records => listChannels(msg, target, records));
      break;
    case 'post':
      // Only the bot owner can manually post tweets
      // Used to test the application
      if (msg.author.id !== process.env.DISCORD_BOT_OWNER_ID) return;
      if (!hasTarget()) return;
      if (!/^\d+$/.test(target)) {
        msg.channel.send(`**${target}** is not a valid tweet ID.`);
        return;
      }
      twitter.getTweet(target)
        .then(tweet => {
          myEvents.emit('manual_post', tweet);
        })
        .catch(err => {
          if (err && err[0] && err[0].code === 8) {
            msg.channel.send(err[0].message);
          } else {
            console.log(global.errorstring + err);
          }
        });
      break;
    default:
      if (debugmessage == true) {
        console.log(`${global.debugstring}Action did not match any of our actions, send usage`);
      }
      msg.channel.send(`Usage: \`\`${msg.prefix}${msg.cmd} <add | remove | list>\`\``);
  }

  function hasTarget() {
    if (!target) {
      if (debugmessage == true) {
        console.log(`${global.debugstring}No target, unable to continue`);
      }
      msg.channel.send(`Usage: \`\`${msg.prefix}${msg.cmd} ${action} <target>\`\``);
      return false;
    }
    return true;
  }
};

function lookupTarget(target, msg) {
  return new Promise((resolve, reject) => {
    twitter.getUser(target)
      .then(userData => {
        if (userData === false) {
          msg.channel.send(`**${target}** is not a registered Twitter account.`);
          resolve(false);
          return;
        }
        resolve(userData);
      })
      .catch(reject);
  });
}

function getSingleRecord(id) {
  return new Promise((resolve, reject) => {
    if (debugmessage == true) {
      console.log(`${global.debugstring}Getting a single feed record`);
    }
    FeedsModel.findOne({ twitter_id: id })
      .then(resolve)
      .catch(reject);
  });
}

function getAllRecords() {
  return new Promise((resolve, reject) => {
    if (debugmessage == true) {
      console.log(`${global.debugstring}Getting all feeds records`);
    }
    FeedsModel.find()
      .then(resolve)
      .catch(reject);
  });
}

function addChannel(msg, user, record) {
  if (debugmessage == true) {
    console.log(`${global.debugstring}Adding a channel`);
  }
  // We have data about this Twitter user
  if (record) {
    // See if this channel is already registered or if we need to add this channel
    const addThisChannel = !record.channels
      .find(x => x.guild_id === msg.guild.id && x.channel_id === msg.channel.id);
    if (addThisChannel) {
      // Add this channel / guild to the array of channels
      const entry = FeedsModel(record);
      entry.channels.push({
        guild_id: msg.guild.id,
        channel_id: msg.channel.id,
      });
      entry.modified_on = Date.now();
      // Save the modified record back to the database
      if (debugmessage == true) {
        console.log(`${global.debugstring}Saving new channel to record`);
      }
      entry.save({ upsert: true })
        .then(() => {
          console.log(`${global.infostring}DISCORD: Channel: ${msg.channel.id} User: ${msg.author.id} ADDED ${user.screen_name}`);
          msg.channel.send(`This channel will now receive tweets from **${user.screen_name}**.`);
        })
        .catch(err => {
          err(err);
          msg.channel.send('There was an issue communicating with the database. Please try again.');
        });
    } else {
      // Don't add this channel because it is already added
      msg.channel.send(`This channel already receives tweets from **${user.screen_name}**`);
    }
  } else {
    // We do not have any data for this Twitter screen_name
    // Create the record to save
    const entry = FeedsModel({
      screen_name: user.screen_name,
      twitter_id: user.id_str,
      channels: [{
        guild_id: msg.guild.id,
        channel_id: msg.channel.id,
      }],
    });
    if (debugmessage == true) {
      console.log(`${global.debugstring}Saving new feed record to database`);
    }
    // Save the new record
    entry.save()
      .then(() => {
        console.log(`${global.infostring}TWITTER: ADDING FEED: ${user.screen_name}`);
        console.log(`${global.infostring}DISCORD: Channel: ${msg.channel.id} User: ${msg.author.id} ADDED ${user.screen_name}`);
        if (debugmessage == true) {
          console.log(`${global.debugstring}New feed added, flagging Twitter reload`);
        }
        state.reload = true;
        msg.channel.send('This channel will now receive tweets from '
          + `**${user.screen_name}**\n\nWe are not yet streaming that Twitter feed. `
          + 'Please allow up to 5 minutes to sync.\n'
          + 'Enter **y** within 15 seconds to be notified on sync.')
          .then(() => {
            const collector = msg.channel.createMessageCollector(
              x => x.author.id === msg.author.id, { time: 15000 },
            );
            collector.on('collect', m => {
              if (m.content.toLowerCase() === 'y' || m.content.toLowerCase() === 'yes') {
                state.notify.push({
                  user_id: msg.author.id,
                  channel_id: msg.channel.id,
                  screen_name: user.screen_name,
                  twitter_id: user.id_str,
                });
                collector.stop();
                msg.reply('You will be @\'d when we are synced. :thumbsup:');
              }
            });
          });
      })
      .catch(err => {
        err(err);
        msg.channel.send('There was an issue communicating with the database. Please try again later.');
      });
  }
}

function removeChannel(msg, user, record) {
  if (debugmessage == true) {
    console.log(`${global.debugstring}Removing a channel`);
  }
  // We have data for this Twitter screen_name
  if (record) {
    // Get the channel index of the channel we ran this command in
    let index = -1;
    for (let i = 0; i < record.channels.length; i++) {
      if (record.channels[i].channel_id === msg.channel.id
        && record.channels[i].guild_id === msg.guild.id) {
        index = i;
        break;
      }
    }
    // The channel we are in is currently registered
    if (index === -1) {
      // The channel we are in is not currently registered
      msg.channel.send(`**${user.screen_name}** is not registered to receive tweets in this channel.`);
    } else {
      // Splice this channel out of the channels array
      record.channels.splice(index, 1);
      let databaseAction;
      if (record.channels.length > 0) {
        if (debugmessage == true) {
          console.log(`${global.debugstring}Removing a channel from a record`);
        }
        databaseAction = record.save({ upsert: true });
      } else {
        if (debugmessage == true) {
          console.log(`${global.debugstring}Removing an entire record`);
        }
        databaseAction = record.remove();
      }
      databaseAction.then(() => {
        msg.channel.send(`This channel will no longer receive tweets from **${user.screen_name}**`);
        console.log(`${global.infostring}DISCORD: Channel: ${msg.channel.id} User: ${msg.author.id} REMOVED ${user.screen_name}`);
        if (record.channels.length === 0) {
          console.log(`${global.infostring}DISCORD: REMOVING FEED: ${user.screen_name}`);
          if (debugmessage == true) {
            console.log(`${global.debugstring}Old feed removed, flagging reload`);
          }
          state.reload = true;
        }
      })
        .catch(err => {
          err(err);
          msg.channel.send('There was an issue communicating with the database. Please try again later.');
        });
    }
  } else {
    // We do not have any data for this Twitter screen_name
    msg.channel.send(`**${user.screen_name}** is not registered to post tweets in any channels.`);
  }
}

function listChannels(msg, target, records) {
  if (debugmessage == true) {
    console.log(`${global.debugstring}Listing ${records.length} channels`);
  }
  // Tell the user if we have 0 records
  // The database is empty
  if (records.length === 0) {
    msg.channel.send('No Twitter accounts are currently posting tweets to any channels.');
    return;
  }
  // Build a string to post to Discord
  let str = '';
  // Only the bot owner can request to see what is happening in all the guilds
  if (target === 'all' && msg.author.id === process.env.DISCORD_BOT_OWNER_ID) {
    if (debugmessage == true) {
      console.log(`${global.debugstring}Listing Twitter feeds for all guilds`);
    }
    records
      .sort((a, b) => {
        const c = a.screen_name.toLowerCase();
        const d = b.screen_name.toLowerCase();
        if (c < d) return -1;
        if (c > d) return 1;
        return 0;
      })
      .forEach(record => {
        // Get channels that currently exist
        // It's possible to have a channel registered that was later deleted
        // Remove null entries
        // Map the string for each item
        const channels = record.channels.map(c => msg.client.channels.get(c.channel_id))
          .filter(x => x)
          .map(x => `${Discord.escapeMarkdown(x.guild.name)} - **#${Discord.escapeMarkdown(x.name)}**`);
        // Only add to string if we have channels
        if (channels.length > 0) {
          str += `**${Discord.escapeMarkdown(makePossessive(record.screen_name))}** tweets are posted to:\n`;
          str += channels.join('\n');
          str += '\n\n';
        }
      });
  } else {
    if (debugmessage == true) {
      console.log(`${global.debugstring}Listing Twitter feeds for this guild only`);
    }
    // Get only feeds that post to any channel in this guild
    records
      .filter(record => record.channels.find(c => c.guild_id === msg.guild.id))
      .sort((a, b) => {
        const c = a.screen_name.toLowerCase();
        const d = b.screen_name.toLowerCase();
        if (c < d) return -1;
        if (c > d) return 1;
        return 0;
      })
      .forEach(record => {
        // Only get the specific channels that are posted to in each guild
        const channels = record.channels.filter(channel => channel.guild_id === msg.guild.id)
          .map(channel => msg.client.channels.get(channel.channel_id))
          .filter(y => y);
        if (channels.length > 0) {
          str += `**${Discord.escapeMarkdown(makePossessive(record.screen_name))}** tweets are posted to:\n`;
          str += channels.join('\n');
          str += '\n\n';
        }
      });
  }
  if (!str) {
    msg.channel.send('No Twitter accounts are currently posting tweets to any channels.');
    return;
  }
  msg.channel.send(str, { split: { maxLength: 1800 } });
}

function makePossessive(name) {
  return `${name}'${name.endsWith('s') ? '' : 's'}`;
}
