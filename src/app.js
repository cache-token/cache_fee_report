require('./load_config.js').loadConfig();
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const BigNumber = require('bignumber.js');

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
var txidSeen = new Set();
var csvWriter;
var outFile;

// Transfer Fee Divisor
const transferFeeDiv = async() => {
  // transfer fee bips
  let tf_bps = await contract.methods.transferFeeBasisPoints().call();
  // divisor = 10000 / tf_bps
  return BigNumber(10000).div(tf_bps);
}

// Parse tx logs for the sender / receiver in a transaction
// and figure out the relative storage / transfer fee paid
const parseFees = (eventinfo) => {
  let primary;
  let non_primary = [];
  for (let e of eventinfo) {
    if (e.name === 'Transfer' &&
        e.address.toLowerCase() === process.env.CONTRACT_HASH.toLowerCase()) {
      let pair = {}
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
  let txFee = BigNumber(primary.value).div(tfeeDiv).toFixed(0);
  let stats = {}
  for (let t of non_primary) {
    if (t.from.toLowerCase() === primary.from.toLowerCase()) {
      let storageFee = BigNumber(t.value).minus(txFee).toFixed(0);
      stats.sender = { 'addr': t.from, 'transfer': txFee, 'storage': storageFee }
    } else {
      stats.receiver = {'addr': t.from, 'storage': t.value }
    }
  }

  if (!stats.hasOwnProperty('sender')) {
    stats.sender = { 'addr': primary.from, 'transfer': 0, 'storage': 0 }
  }

  if (!stats.hasOwnProperty('receiver')) {
    stats.receiver = { 'addr': primary.to, 'transfer': 0, 'storage': 0 }
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

const rescanTransfers = async(addrs, fromBlock, toBlock, incoming) => {

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
    contract.getPastEvents('Transfer', options, async(error, events) => {
      if (error) {
        logger.error(error);
        process.exit();
      }
      logger.info("Detected " + events.length + " transfers to incoming address list");
      from_filter = Array.from(new Set(events.map(e => e.returnValues.from)));
      logger.info("There were " + addrs.length + " unqiue addresses transfering to incoming address list");
    });
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
  contract.getPastEvents('Transfer', options, async(error, events) => {
    if (error) {
      logger.error(error);
      process.exit();
    }
    logger.info("There were " + events.length + " transfers to fee address from associated address list.");
    for (let e of events) {
      await processTransfer(e);
    }

    logger.info("A total of " + totalFees.div(TOKEN).toString() + " CGT were paid in fees from address list during this period.");
    logger.info("\n\nSee " + outFile);
    process.exit();
  });
};

const parseAddresses = (file) => {
  return fs.readFileSync(file).toString('utf-8').split("\n").filter(String);
};

const run = async(address_file, args) => {
  let addrs = parseAddresses(address_file);
  let startDate = new Date(args.fromDate);
  let endDate = new Date(args.toDate);
  let incoming = args.incoming;
  outFile = args.out;

  // Add a day to end date, to make it inclusive of that day
  endDate.setDate(endDate.getDate() + 1);

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

  tfeeDiv = await transferFeeDiv();
  await rescanTransfers(addrs, startBlockNum, endBlockNum, incoming);


};

module.exports = run;
