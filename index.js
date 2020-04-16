const moment = require('moment');
const meow = require('meow');

module.exports = () => {
  const cli = meow(`
    Usage
      $ export NETWORK=<ropsten|mainnet>
      $ export INFURA_KEY=<infura key>
      $ cache_fee_report <address file> --from-date <start_date> --to-date 2020-04-01 <end_date>

    Options
      --from-date,    -f   Filter transfers after from this date           (default: 2014-01-01)
      --to-date,      -t   Filter transfers before this date               (default: now)
      --incoming,     -i   Report fees paid transfering into address list  (default: false)

    Examples
      $ cache_fee_report sample_data/address_sample_outgoing_ropsten.txt --from-date 2020-02-01 --to-date 2020-04-01
      $ cache_fee_report sample_data/address_sample_incoming_ropsten.txt --incoming
    `, {
    flags: {
      'from-date': {
        type: 'string',
        alias: 'f',
        default: (new Date('2014-01-01')).toString()
      },
      'to-date': {
        type: 'string',
        alias: 't',
        default: (moment().subtract(60, 'seconds')).toString()
      },
      incoming: {
        type: 'boolean',
        default: false
      },
      alias: { h: 'help', v: 'version' }
    }
  });

  let args = cli.flags;
  let address_file = cli.input[0];
  if ('h' in args || !address_file) {
    if (!address_file) { console.log("\n  Address file required!\n") };
    console.log(cli.help);
    process.exit();
  }
  require('./src/app.js')(cli.input[0], cli.flags);
};
