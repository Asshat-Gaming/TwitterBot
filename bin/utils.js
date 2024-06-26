'use strict';

const fs = require('fs');

// Similar to Promise.all except it will not reject if one of the promises rejects
// Instead we will get a null result
function promiseSome(array) {
  return new Promise((resolve, reject) => { // eslint-disable-line no-unused-vars
    // Send back the empty array if empty
    if (array.length === 0) {
      resolve(array);
      return;
    }
    // Create an array of the same length as the promise array to hold results
    const results = Array(array.length);
    let num = 0;
    for (let i = 0; i < array.length; i++) {
      // Manually reject the promise with a null result after 30 seconds
      const rejectTimer = setTimeout(() => {
        results[i] = null;
        checkIfDone();
      }, 1000 * 60 * 30);
      Promise.resolve(array[i])
        .then(resolvedResults => {
          if (rejectTimer) clearTimeout(rejectTimer);
          results[i] = resolvedResults;
          checkIfDone();
        })
        .catch(() => {
          if (rejectTimer) clearTimeout(rejectTimer);
          results[i] = null;
          checkIfDone();
        });
    }

    function checkIfDone() {
      num++;
      if (num >= array.length) resolve(results);
    }
  });
}

// Creates a unique folder with the tweet id for easy cleanup
function createDir(location) {
  return new Promise((resolve, reject) => {
    exists(location)
      .then(() => {
        resolve();
      }, () => makeDir(location))
      .then(resolve)
      .catch(reject);
  });
}

function exists(location) {
  return new Promise((resolve, reject) => {
    if (debugmessage == true) {
      console.log(`${global.debugstring}Checking existence of ${location}`);
    }
    fs.access(location, fs.constants.F_OK, err => {
      if (err) {
        if (debugmessage == true) {
          console.log(`${global.debugstring}${location} does not exist`);
        }
        reject(err);
      } else {
        if (debugmessage == true) {
          console.log(`${global.debugstring}${location} exists`);
        }
        resolve(location);
      }
    });
  });
}

function makeDir(location) {
  return new Promise((resolve, reject) => {
    if (debugmessage == true) {
      console.log(`${global.debugstring}Make directory: ${location}`);
    }
    fs.mkdir(location, err => {
      if (err) {
        if (debugmessage == true) {
          console.log(`${global.debugstring}Make directory fail: ${location}`);
        }
        reject(err);
      } else {
        if (debugmessage == true) {
          console.log(`${global.debugstring}Make directory ok: ${location}`);
        }
        resolve();
      }
    });
  });
}

module.exports = {
  promiseSome,
  createDir,
};
