# Fee Report

Given a list of addresses, report all token fees paid (transfer and storage) in CACHE Gold Token (CGT) originating from the address list (outgoing txs), or from transfers into the address list (incoming txs).

### Install from NPM

```
npm install -g cache_fee_report
```

### Install from Source
```
git clone https://github.com/cache-token/cache_fee_report.git
cd cache_fee_report
npm install
npm link
```

### Usage
```
$ cache_fee_report -h

  Usage
    $ export NETWORK=<ropsten|mainnet>
    $ export INFURA_KEY=<infura key>
    $ cache_fee_report <address file> --from-date <start_date> --to-date <end_date>

  Options
    --from-date,    -f   Filter transfers after from this date           (default: 2014-01-01)
    --to-date,      -t   Filter transfers before this date               (default: now)
    --incoming,     -i   Report fees paid transfering into address list  (default: false)

  Examples
    $ cache_fee_report sample_data/addresses_ropsten.txt --from-date 2020-02-01 --to-date 2020-04-01
    $ cache_fee_report sample_data/addresses_incoming.txt --incoming
```

### Output

The report is generated to ./reports/out.csv
