require('./load_config.js').loadConfig();
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const BigNumber = require('bignumber.js');

const balance_client = require('./balance_client.js');
const logger = require('./logging.js');
const utils = require('./transaction_utils.js');

// CGT has 8 decimals
const TOKEN = new BigNumber(10.0**8);
const contract = utils.getCacheContractObject();
const FEE_ADDR = process.env.FEE_ADDR;

// Set BigNumber to round down
BigNumber.config({ ROUNDING_MODE: BigNumber.ROUND_DOWN })


// Globals to be filled in
var totalFees = new BigNumber(0);
var tfeeDiv;
var csvWriter;
var outFile;

// Transfer Fee Divisor
const transferFeeDiv = async() => {
  // transfer fee bips
  let tf_bps = await contract.methods.transferFeeBasisPoints().call();
  // divisor = 10000 / tf_bps
  return BigNumber(10000).div(tf_bps);
};

// Parse tx logs for the sender / receiver in a transaction
// and figure out the relative storage / transfer fee paid
const parseFees = (eventinfo) => {
  let primary;
  let non_primary = [];
  for (let e of eventinfo) {
    if (e.name === 'Transfer' &&
        e.address.toLowerCase() === process.env.CONTRACT_HASH.toLowerCase()) {
      let pair = {};
      for (let item of e.events) {
        pair[item.name] = item.value;
      }
      if (pair.to.toLowerCase() !== FEE_ADDR.toLowerCase()) {
        primary = pair;
      } else {
        non_primary.push(pair);
      }
    }
  }

  // Only happens if someone does a transfer to the fee address
  // Just ignore this case
  if (typeof primary === 'undefined') {
    return null;
  }

  let txFee = BigNumber(primary.value).div(tfeeDiv).toFixed(0);
  let stats = {};
  for (let t of non_primary) {
    if (t.from.toLowerCase() === primary.from.toLowerCase()) {
      let storageFee = BigNumber(t.value).minus(txFee).toFixed(0);
      stats.sender = { 'addr': t.from, 'transfer': txFee, 'storage': storageFee };
    } else {
      stats.receiver = {'addr': t.from, 'storage': t.value };
    }
  }

  if (!stats.hasOwnProperty('sender')) {
    stats.sender = { 'addr': primary.from, 'transfer': 0, 'storage': 0 };
  }

  if (!stats.hasOwnProperty('receiver')) {
    stats.receiver = { 'addr': primary.to, 'transfer': 0, 'storage': 0 };
  }

  return stats;
}

const processTransfer = async(transfer) => {
  if (transfer.returnValues.to.toLowerCase() === FEE_ADDR.toLowerCase()) {
    let amount = transfer.returnValues.value;
    let from = transfer.returnValues.from;
    let blockDate = await utils.getBlockDate(transfer.blockNumber);
    logger.debug(from + " sent " + amount + " in token fees in tx " + transfer.transactionHash);
    totalFees = totalFees.plus(new BigNumber(amount));

    let txinfo = await utils.getTransaction(transfer.transactionHash);
    //logger.info("txinfo " + JSON.stringify(txinfo, null, 4));
    let feeStats = await parseFees(txinfo.decoded);

    if (!feeStats) {
      return;
    }

    const data = [{
      txid: transfer.transactionHash,
      blockNum: transfer.blockNumber,
      time: blockDate,
      address: from,
      total_fee: amount,
      transaction_fee: feeStats.sender.transfer,
      storage_fee: feeStats.sender.storage
    }];
    await csvWriter.writeRecords(data);
  }
};

const getEvents = (options) => {
  return new Promise( (resolve, reject) => {
    contract.getPastEvents('Transfer', options, async(error, events) => {
      if (error) {
        logger.error(error);
        return reject(error);
      }
      return resolve(events);
    });
  });
};

const balance = async(addr, blockNum) => {
  let b = await balance_client.getBalance(addr, blockNum);
  return BigNumber(b);
};

const balanceEvent = async(addr, blockNum) => {
  return await balance_client.getEvent(addr, blockNum);
};

const scanBalance = async(addrs, fromBlock, fromBlockTime, toBlock, toBlockTime) => {

  for (let addr of addrs) {
    let startBalance = BigNumber(0);
    let startEvent = await balanceEvent(addr, fromBlock);
    if (startEvent.balance) {
      startBalance = BigNumber(startEvent.balance);
    }

    const incoming_options = {
      fromBlock: fromBlock,
      toBlock: toBlock,
      filter: {
        to: [addr]
      }
    };
    const outgoing_options = {
      fromBlock: fromBlock,
      toBlock: toBlock,
      filter: {
        from: [addr]
      }
    };
    const incoming_events = await getEvents(incoming_options);
    const outgoing_events = await getEvents(outgoing_options);
    const incoming_blockNums = new Set(incoming_events.map(e => e.blockNumber));
    const outgoing_blockNums = new Set(outgoing_events.map(e => e.blockNumber));
    const blockNums = new Set([...incoming_blockNums, ...outgoing_blockNums]);
    logger.debug(addr + " had a balance change on " + blockNums.size + " blocks");
    const total_time = (toBlockTime - fromBlockTime);

    let lastTime = fromBlockTime;
    let lastBlock = fromBlock;
    let lastBalance = startBalance;
    let avg = BigNumber(0);
    blockNums.add(toBlock);
    for (let blockNum of Array.from(blockNums).sort()) {
      let newBalanceEvent = await balanceEvent(addr, blockNum);
      let timestamp = newBalanceEvent.timestamp;
      if (!timestamp) {
        // Should only happen on last item
        let block = await utils.getBlock(blockNum);
        timestamp = block.timestamp;
      }
      let time_diff = timestamp - lastTime;
      let perc = BigNumber(time_diff).div(total_time);
      avg = avg.plus(lastBalance.times(perc));
     // console.log("Balance " + lastBalance.toString() + " from " + lastTime + " to " + timestamp + " (" + perc.times(100).toFixed(2) + " percent of time)");
      let data = [{
        addr: addr,
        fromBlock: lastBlock,
        fromTime: utils.timestampToDate(lastTime),
        toBlock: blockNum,
        toTime: utils.timestampToDate(timestamp),
        timespan: time_diff,
        balance: lastBalance.div(TOKEN).toFixed(8),
        percent: perc.times(100).toFixed(6)
      }];
      await csvWriter.writeRecords(data);

      lastBalance = BigNumber(newBalanceEvent.balance);
      lastTime = timestamp;
      lastBlock = blockNum;
    }
    logger.info(addr + " average balance during this period was " + avg.div(TOKEN).toFixed(8) + " CGT");
    let data = [{ addr: addr, avg: avg.div(TOKEN).toString() }];
    await csvWriter.writeRecords(data);
  }

  logger.info("Done.\n\nSee " + outFile);
  process.exit();
};

const scanFees = async(addrs, fromBlock, toBlock, incoming) => {

  var from_filter;
  // If incoming flag set, need to figure out the list of addresses
  // transfering to our known addresses and then find their other transfer
  // events where they paid transaction fees.
  if (incoming) {
   const options = {
      fromBlock: fromBlock,
      toBlock: toBlock,
      filter: {
        to: addrs
      }
    };
    let events =  await getEvents(options);
    logger.info("Detected " + events.length + " transfers to incoming address list");
    from_filter = Array.from(new Set(events.map(e => e.returnValues.from)));
    logger.info("There were " + addrs.length + " unqiue addresses transfering to incoming address list");
  } else {
    from_filter = addrs;
  }

  const options = {
    fromBlock: fromBlock,
    toBlock: toBlock,
    filter: {
      from: from_filter,
      to: [FEE_ADDR]
    }
  };
  let events = await getEvents(options);
  logger.info("There were " + events.length + " transfers to fee address from associated address list.");
  for (let e of events) {
    await processTransfer(e);
  }

  logger.info("A total of " + totalFees.div(TOKEN).toString() + " CGT were paid in fees from address list during this period.");
  logger.info("\n\nSee " + outFile);
  process.exit();
};

const parseAddresses = (file) => {
  return fs.readFileSync(file).toString('utf-8').split("\n").filter(String);
};

const run = async(address_file, args) => {
  let addrs = parseAddresses(address_file);
  let startDate = new Date(args.fromDate);
  let endDate = new Date(args.toDate);
  let incoming = args.incoming;
  let balance = args.balance;
  outFile = args.out;

  const startBlock = (await utils.getBlockByTime(startDate));
  const endBlock = (await utils.getBlockByTime(endDate));
  const startBlockNum = startBlock.number;
  const endBlockNum = endBlock.number;
  const startBlockTime = utils.timestampToDate(startBlock.timestamp);
  const endBlockTime = utils.timestampToDate(endBlock.timestamp);


  logger.info("Using CACHE contract hash " + contract.options.address + " on network " + process.env.NETWORK);
  logger.info("Scanning " + addrs.length + " addresses from block " +
              startBlockNum + " (" + startBlockTime + ")" + " to " +
              endBlockNum + " (" + endBlockTime + ")");

  tfeeDiv = await transferFeeDiv();
  if (balance) {
    csvWriter = createCsvWriter({
      path: outFile,
      header: [
        {id: 'addr', title: 'Address'},
        {id: 'fromBlock', title: 'From Block Number'},
        {id: 'fromTime', title: 'From Time'},
        {id: 'toBlock', title: 'To Block Number'},
        {id: 'toTime', title: 'To Time'},
        {id: 'timespan', title: 'Timespan in Seconds'},
        {id: 'balance', title: 'Balance at Block'},
        {id: 'percent', title: 'Percent of Time At Balance'},
        {id: 'avg', title: 'Average Balance'}
      ]
    });
    await scanBalance(addrs, startBlockNum, startBlock.timestamp, endBlockNum, endBlock.timestamp);
  } else {
    csvWriter = createCsvWriter({
      path: outFile,
      header: [
        {id: 'txid', title: 'txid'},
        {id: 'blockNum', title: 'blockNum'},
        {id: 'time', title: 'time'},
        {id: 'address', title: 'address'},
        {id: 'total_fee', title: 'total_fee'},
        {id: 'transaction_fee', title: 'transaction_fee'},
        {id: 'storage_fee', title: 'storage_fee'},
      ]
    });
    await scanFees(addrs, startBlockNum, endBlockNum, incoming);
  }

};

module.exports = run;
