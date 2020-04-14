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

// Globals to be filled in
var totalFees = new BigNumber(0);

const csvWriter = createCsvWriter({
  path: 'reports/out.csv',
  header: [
    {id: 'txid', title: 'txid'},
    {id: 'address', title: 'address'},
    {id: 'amount', title: 'amount'},
    {id: 'blockNum', title: 'blockNum'},
    {id: 'time', title: 'time'},
  ]
});

const processTransfer = async(transfer) => {
  if (transfer.returnValues.to === FEE_ADDR) {
    let amount = transfer.returnValues.value;
    let from = transfer.returnValues.from;
    let blockDate = await utils.getBlockDate(transfer.blockNumber);
    logger.debug(from + " sent " + amount + " in token fees in tx " + transfer.transactionHash);
    totalFees = totalFees.plus(new BigNumber(amount));
    const data = [{
      address: from,
      amount: amount,
      blockNum: transfer.blockNumber,
      time: blockDate,
      txid: transfer.transactionHash
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
    logger.info("\n\nSee reports/out.csv");
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

  await rescanTransfers(addrs, startBlockNum, endBlockNum, incoming);


};

module.exports = run;
