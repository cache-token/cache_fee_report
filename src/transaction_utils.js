'use strict';
const fs = require('fs');
const memoize = require("memoizee");
const moment = require('moment');
const path = require('path');
const web3 = require('./web3_inst.js');

const getContractHash = () => {
  return process.env.CONTRACT_HASH;
};

const getCacheContractObject = () => {
  let contractHash = getContractHash();
  const abi_file = path.join(__dirname, '..', 'abi', 'CacheGold.json');
  const parsed = JSON.parse(fs.readFileSync(abi_file));
  return (new web3.eth.Contract(parsed.abi, contractHash));
};

const timestampToDate = (timestamp) => {
  const date = moment.unix(timestamp);
  return date.utc().format();
};

const dateToTimestamp = (date) => {
  return moment(date).unix();
};

// Memoize getting block timestamp
const gbt = async(blockNum) => {
  let block = await web3.eth.getBlock(blockNum);
  return timestampToDate(block.timestamp);
};
const getBlockDate = memoize(gbt);

// Find nearest block to given timestamp, expect timestamp in unix time
const getBlockByTime = async(targetDate) => {
  let targetTimestamp = dateToTimestamp(targetDate);
  let averageBlockTime = 13.5;
  const currentBlockNumber = await web3.eth.getBlockNumber();
  let block = await web3.eth.getBlock(currentBlockNumber);
  let blockNumber = currentBlockNumber;
  while(block.timestamp > targetTimestamp){
    let decreaseBlocks = (block.timestamp - targetTimestamp) / averageBlockTime;
    decreaseBlocks = parseInt(decreaseBlocks) + 1;
    blockNumber -= decreaseBlocks;
    if (blockNumber < 0) {
      blockNumber = 1;
    }
    block = await web3.eth.getBlock(blockNumber);
    if (blockNumber == 1) {
      return block;
    }
  }
  return block;
};

module.exports = {
  getCacheContractObject,
  timestampToDate,
  dateToTimestamp,
  getBlockByTime,
  getBlockDate
};
