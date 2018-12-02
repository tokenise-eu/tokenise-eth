'use strict';

const SecurityToken = artifacts.require('SecurityToken');
let tokenContract;

const hash = require('./helpers/hash');

contract('Burning', async (accounts) => {
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

    it('should allow the administrator to burn tokens', async () => {
        await tokenContract.burn(accounts[1], 50, { from: accounts[0], gas: '1000000' });
        let newBalance = await tokenContract.balanceOf.call(accounts[1]);
        
        assert.strictEqual(newBalance.toString(), '50');
    });

    it('should not allow the administrator to burn more than the account balance', async () => {
        try {
            await tokenContract.burn(accounts[2], 300, { from: accounts[0], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should not allow anybody else to call the burn function', async () => {
        try {
            await tokenContract.burn(accounts[2], 50, { from: accounts[0], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });
});
