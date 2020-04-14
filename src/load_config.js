/*eslint no-console: 0*/
'use strict';
const dotenv = require('dotenv');
const path = require('path');


/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
exports.loadConfig = function() {
    if (!process.env.NETWORK) {
        console.log("Need to set NETWORK environment variable to one of dev|ropsten|mainnet");
        process.exit();
    }
    if (!process.env.INFURA_KEY) {
        console.log("Need to set INFURA_KEY environment variable");
        process.exit();
    }
    if (process.env.NETWORK === 'dev') {
        dotenv.load({ path: path.join(__dirname, '..', '.env.dev') });
    } else if (process.env.NETWORK === 'ropsten') {
        dotenv.load({ path: path.join(__dirname, '..', '.env.ropsten') });
    } else if (process.env.NETWORK === 'mainnet') {
        dotenv.load({ path: path.join(__dirname, '..', '.env.mainnet') });
    } else {
        console.log("NETWORK " + process.env.NETWORK + " not recognized, exiting...");
        process.exit();
    }
};
