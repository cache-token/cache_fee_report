#!/bin/sh

export NETWORK=ropsten
export INFURA_KEY="FILL_ME_IN"

echo "./bin/cache_fee_report sample_data/address_sample_outgoing_ropsten.txt --from-date 2020-03-01"
./bin/cache_fee_report sample_data/address_sample_outgoing_ropsten.txt --from-date 2020-03-01
