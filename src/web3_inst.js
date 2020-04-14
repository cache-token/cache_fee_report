'use strict';
const Web3 = require('web3');
const logger = require('./logging.js');

var web3;
const websocket_connection = (process.env.USE_WEBSOCKET === 'true');

const options = {
  transactionBlockTimeout: 600
};

// Simply pick the right web3 config based on
// process.env.NETWORK = ('dev', 'ropsten', 'mainnet')
// AND
// process.env.USE_WEBSOCKET = true || false
// AND
// process.env.USE_INFURA = true || false

if (websocket_connection) {
    if (process.env.NETWORK === 'dev') {
        web3 = new Web3(new Web3.providers.WebsocketProvider('ws://' + process.env.GANACHE_HOST + ':7545'), null, options);
    } else if (process.env.NETWORK === 'ropsten') {
        web3 = new Web3(new Web3.providers.WebsocketProvider('wss://ropsten.infura.io/ws/v3/' +
                                                             process.env.INFURA_KEY), null, options);
    } else if (process.env.NETWORK === 'mainnet') {
        web3 = new Web3(new Web3.providers.WebsocketProvider('wss://mainnet.infura.io/ws/v3/' +
                                                             process.env.INFURA_KEY), null, options);
    } else {
        logger.error("No websocket config for " + process.env.NETWORK);
        process.exit();
    }
} else {
    if (process.env.NETWORK === 'dev') {
        web3 = new Web3(new Web3.providers.HttpProvider('http://' + process.env.GANACHE_HOST + ':7545'), null, options);
    } else if (process.env.NETWORK === 'ropsten') {
        web3 = new Web3(new Web3.providers.HttpProvider('https://ropsten.infura.io/v3/' +
                                                        process.env.INFURA_KEY), null, options);
    } else if (process.env.NETWORK === 'mainnet') {
        web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/' +
                                                        process.env.INFURA_KEY), null, options);
    } else {
        logger.error("No HTTP config for " + process.env.NETWORK);
        process.exit();
    }
}

module.exports = web3;
