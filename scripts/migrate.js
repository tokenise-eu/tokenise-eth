'use strict';

async function migrate(controller, deployer, manager, addresses, info, balances) {
    if (!addresses && !info && !balances) {
        await controller.methods.finishMigration(manager).send({ from: deployer, gas: '1000000' });
    } else {
        let addressesLength = addresses.length;
        let infoLength = info.length;
        let balancesLength = balances.length;
        if (!Array.isArray(addresses) || !Array.isArray(info) || !Array.isArray(balances)) {
            throw TypeError('Migration information needs to be in array form');
        } else if ((addressesLength !== infoLength || addressesLength !== balancesLength) && addressesLength !== null) {
            throw TypeError('Array lengths are not identical');
        } else {
            try {
                for (let i = 0; i < addresses.length; i++) {
                    try {
                        await controller.methods.migrate(addresses[i], info[i], balances[i]).send({ from: deployer, gas: '1000000'});
                    } catch (e) {
                        throw Error(e.message);
                    }
                }
                await controller.methods.finishMigration(manager).send({ from: deployer, gas: '1000000' });
            } catch (e) {
                throw Error(e.message);
            }
        }
    }
}

module.exports = migrate;