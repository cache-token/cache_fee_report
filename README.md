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
    --from-date,    -f   Filter transfers after from this date        (default: 2014-01-01)
    --to-date,      -t   Filter transfers before this date            (default: now)
    --incoming,     -i   Report fees paid transfering into
                         the provided address list                    (default: false)
    --balance       -b   Report time weighted average CGT balance
                         of the provided address list                 (default: false)
    --out,          -o   The output filename                          (default: report.csv)

  Examples
    $ cache_fee_report sample_data/address_sample_outgoing_ropsten.txt --from-date 2020-02-01 --to-date 2020-04-01
    $ cache_fee_report sample_data/address_sample_incoming_ropsten.txt --incoming
    $ cache_fee_report sample_data/address_sample_balance_ropsten.txt --balance
```

Also see [./example.sh](./example.sh)

### Output

The report is generated to ./report.csv
