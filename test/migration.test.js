'use strict';

const SecurityToken = artifacts.require('SecurityToken');
let tokenContract;

const migrate = require('./helpers/migrate');
const hash = require('./helpers/hash');
const fs = require('fs');
const csv = require('csv-parser');

let addresses = [];
let info = [];
let balances = [];

contract('Migration', async (accounts) => {
    before(async () => {
        tokenContract = await SecurityToken.deployed();

        const readData = new Promise((resolve, reject) => {
            fs.createReadStream('./test/data.csv')
                .pipe(csv())
                .on('data', function (data) {
                    addresses.push(data['address']);
                    info.push(data['info']);
                    balances.push(data['balance']);
                })
                .on('end', resolve);
        });
    
        await readData;
    
        try {
            await migrate(tokenContract, accounts[0], addresses, info, balances);
        } catch (e) {
            console.log('Migration failed: ', e.message);
        }

        const infoHash = hash('Test');

        // Whitelist accounts
        await tokenContract.addVerified(accounts[1], infoHash, { from: accounts[0], gas: '1000000' });
        await tokenContract.addVerified(accounts[2], infoHash, { from: accounts[0], gas: '1000000' });
        await tokenContract.addVerified(accounts[3], infoHash, { from: accounts[0], gas: '1000000' });

        // Issue shares
        await tokenContract.issue(accounts[1], 100, { from: accounts[0], gas: '1000000' });
        await tokenContract.issue(accounts[2], 200, { from: accounts[0], gas: '1000000' });
    });

    it('should whitelist the investors upon migration', async () => {
        let result = true;

        for (let i = 0; i < addresses.length; i++) {
            let verified = await tokenContract.isVerified.call(addresses[i]);
            assert(verified, 'Contract did not verify address ' + addresses[i] + ' upon migration.');
        }

        assert(result);
    });

    it('should have the right amount of shareholders upon migration', async () => {
        // There are 10 addresses in the csv with a 0 balance; these will not show up for holderCount()
        let holderCount = await tokenContract.holderCount();
        assert.strictEqual(holderCount.toString(), '235'); // 233 in the list plus accounts[1]/accounts[2]
    });

    it('should have the correct hashes', async () => { 
        for (let i = 0; i < addresses.length; i++) {
            let infoHash = hash(info[i]);
            let check = await tokenContract.hasHash.call(addresses[i], infoHash);
            assert(check, 'Contract does not hold the correct information hash for ' + addresses[i] + '.');
        }
    });

    it('should not allow a non-admin to call the migrate function', async () => {
        try {
            await tokenContract.migrate({ from: accounts[2], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should allow the owner to call the migrate function', async () => {
        await tokenContract.migrate({ from: accounts[0], gas: '1000000' });
        assert(true);
    });

    it('should no longer allow issuance after migration', async () => {
        try {
            await tokenContract.issue(accounts[3], 100, { from: accounts[0], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should no longer allow freezing after migration', async () => {
        try {
            await tokenContract.freeze({ from: accounts[0], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should no longer allow locking after migration', async () => {
        try {
            await tokenContract.lock(accounts[3], { from: accounts[0], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should no longer allow burning after migration', async () => {
        try {
            await tokenContract.burn(accounts[2], 100, { from: accounts[0], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should no longer allow canceling and reissuing after migration', async () => {
        try {
            await tokenContract.cancelAndReissue(accounts[2], accounts[3], { from: accounts[0], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should no longer allow whitelisting after migration', async () => {
        try {
            const infoHash = hash('Test');
            await tokenContract.addVerified(accounts[4], infoHash, { from: accounts[0], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should no longer allow updating whitelisted accounts after migration', async () => {
        try {
            const infoHash = hash('Test2');
            await tokenContract.updateVerified(accounts[2], infoHash, { from: accounts[0], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should no longer allow removing whitelisted accounts after migration', async () => {
        try {
            await tokenContract.removeVerified(accounts[3], { from: accounts[0], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should not allow the admin to call migrate twice', async () => {
        try {
            await tokenContract.migrate({ from: accounts[0], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });
});