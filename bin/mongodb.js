'use strict';

const mongoose = require('mongoose');

if (debugmessage == true) {
  console.log(`${global.debugstring}Loading mongodb.js`);
}

// Kill the process if the mongodb has a connection error within the first few seconds of launch
// Likely this is a format error with the MONGO_URI
const haltTimer = setTimeout(() => {
}, 1000 * 5);

// When successfully connected
mongoose.connection.on('connected', () => {
  console.log(`${global.infostring}Mongodb: connection success`);
  if (debugmessage == true) {
    console.log(`${global.debugstring}Stopping mongodb haltTimer`);
  }
  if (haltTimer) clearTimeout(haltTimer);
});

// If the connection throws an error
mongoose.connection.on('error', err => {
  console.log(`${global.errorstring}Mongodb: connection error`);
  console.log(global.errorstring + err);
  if (haltTimer) {
    console.log(`${global.errorstring}Error connecting to the mongodb in a timely manor. Please check the \'MONGO_URI\' for format/credential errors`);
    process.exit(1);
  }
});

// When the connection is disconnected
mongoose.connection.on('disconnected', () => {
  console.log(`${global.warnstring}Mongodb: connection disconnected`);
});

// Connect
console.log(`${global.infostring}Mongodb: connecting...`);
mongoose.connect(process.env.MONGO_URI, {
  connectTimeoutMS: 30000,
});

module.exports = mongoose;
