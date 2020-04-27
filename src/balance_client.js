const request = require('request');
const logger = require('./logging.js');

var API;
if (process.env.NETWORK === 'ropsten') {
  API = 'https://balance-ropsten.cachetoken.io/api/';
} else {
  API = 'https://balance.cachetoken.io/api/';
}


const call = (endpoint, addr, blockNum) => {
  return new Promise((resolve, reject) => {
    let url = API + endpoint + '?addr=' + addr;
    if (typeof blockNum !== 'undefined') {
      url += '&blockNum=' + blockNum;
    }
    request(url, async(err, res, body) => {
      if (err) {
        logger.error(err);
        return reject(err);
      }
      return resolve(JSON.parse(body));
    });
  });
};

const getBalance = async(addr, blockNum) => {
  return (await call('balance', addr, blockNum)).balance;
};

const getEvent = async(addr, blockNum) => {
  return (await call('event', addr, blockNum)).event;
};

module.exports = { getBalance, getEvent };
