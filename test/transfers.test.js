'use strict';

const SecurityToken = artifacts.require('SecurityToken');
let tokenContract;

const hash = require('./helpers/hash');

contract('Transfers', async (accounts) => {
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

    it('should reject standard payments', async () => {
        try {
            await tokenContract.sendTransaction({ from: accounts[0], value: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should allow transfers between verified accounts', async () => {
        try {
            await tokenContract.transfer(accounts[3], 50, { from: accounts[2], gas: '1000000' });
            assert(true);
        } catch (e) {
            assert(false);
        }
    });

    it('should update holders after transfer', async () => {
        let isHolderAfterTransfer = await tokenContract.isHolder.call(accounts[3]);
        assert(isHolderAfterTransfer);
    });

    it('should update balances after transfer', async () => {
        let holder2Balance = await tokenContract.balanceOf.call(accounts[2]);
        assert.strictEqual(holder2Balance.toString(), '150', 'Contract did not update balance properly for accounts[2]');

        let whitelistedBalance = await tokenContract.balanceOf.call(accounts[3]);
        assert.strictEqual(whitelistedBalance.toString(), '50', 'Contract did not update balance properly for accounts[3]');
    });

    it('should not allow transfers to unverified accounts', async () => {
        try {
            await tokenContract.transfer(accounts[9], 50, { from: accounts[2], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should allow transferFrom functionality', async () => {
        await tokenContract.approve(accounts[1], 50, { from: accounts[3], gas: '1000000' });
        await tokenContract.transferFrom(accounts[3], accounts[2], 50, { from: accounts[1], gas: '1000000' });

        assert(true);
    });

    it('should remove investors as shareholders if they transfer out all of their tokens', async () => {
        await tokenContract.transfer(accounts[3], 100, { from: accounts[1], gas: '1000000' });
        let isHolder = await tokenContract.isHolder.call(accounts[1]);

        assert(!isHolder, 'accounts[1] is still considered a holder with a 0 balance');
    });
});
