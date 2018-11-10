'use strict';

const hash = require('./hash');

async function migrate(tokenContract, admin, addresses, info, balances) {
    let addressesLength = addresses.length;
    let infoLength = info.length;
    let balancesLength = balances.length;
    if (!Array.isArray(addresses) || !Array.isArray(info) || !Array.isArray(balances)) {
        throw TypeError('Migration information needs to be in array form');
    } else if ((addressesLength !== infoLength || addressesLength !== balancesLength) && addressesLength !== null) {
        throw TypeError('Array lengths are not identical');
    } else {
        for (let i = 0; i < addresses.length; i++) {
            try {
                let infoHash = hash(info[i]);
                await tokenContract.methods.addVerified(addresses[i], infoHash).send({ from: admin, gas: '1000000'});
                if (balances[i] > 0) {
                    await tokenContract.methods.issue(addresses[i], balances[i]).send({ from: admin, gas: '1000000' });
                }
            } catch (e) {
                throw Error(e.message);
            }
        }
    }
}

module.exports = migrate;