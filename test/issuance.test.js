'use strict';

const SecurityToken = artifacts.require('SecurityToken');
let tokenContract;

const hash = require('./helpers/hash');

contract('Issuance', async (accounts) => {
    before(async () => {
        tokenContract = await SecurityToken.deployed();

        const infoHash = hash('Test');

        // Whitelist accounts
        await tokenContract.addVerified(accounts[1], infoHash, { from: accounts[0], gas: '1000000' });
        await tokenContract.addVerified(accounts[2], infoHash, { from: accounts[0], gas: '1000000' });
        await tokenContract.addVerified(accounts[3], infoHash, { from: accounts[0], gas: '1000000' });

        // Issue shares
        await tokenContract.issue(accounts[1], 100, { from: accounts[0], gas: '1000000' });
        await tokenContract.issue(accounts[2], 200, { from: accounts[0], gas: '1000000' });
    });

    it('should allow the administrator to issue more tokens to verified accounts', async () => {
        await tokenContract.issue(accounts[3], 500, { from: accounts[0], gas: '1000000' });
        let balance = await tokenContract.balanceOf.call(accounts[3]);

        assert.strictEqual(balance.toString(), '500');
    });

    it('should not allow anybody else to issue tokens', async () => {
        try {
            await tokenContract.issue(accounts[3], 500, { from: accounts[9], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should not allow the administrator to issue tokens to an unverified account', async () => {
        try {
            await tokenContract.issue(accounts[9], 500, { from: accounts[0], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });
});
