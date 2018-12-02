'use strict';

const SecurityToken = artifacts.require('SecurityToken');
let tokenContract;

const hash = require('./helpers/hash');

contract('Locking/Freezing', async (accounts) => {
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

    it('should allow the admin to lock an account', async () => {
        await tokenContract.lock(accounts[1], { from: accounts[0], gas: '1000000' });
        let locked = await tokenContract.isLocked.call(accounts[1]);

        assert(locked);
    });

    it('should not allow transfers to locked account', async () => {
        try {
            await tokenContract.transfer(accounts[1], 50, { from: accounts[2], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should not allow transfers from locked account', async () => {
        try {
            await tokenContract.transfer(accounts[2], 50, { from: accounts[1], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should allow the admin to unlock an account', async () => {
        await tokenContract.lock(accounts[1], { from: accounts[0], gas: '1000000' });
        let locked = await tokenContract.isLocked.call(accounts[1]);

        assert(!locked);
    });

    it('should allow the admin to freeze the contract', async () => {
        await tokenContract.freeze({ from: accounts[0], gas: '1000000' });
        let frozen = await tokenContract.frozen();

        assert(frozen);
    });

    it('should not allow transfers while the contract is frozen', async () => {
        try {
            await tokenContract.transfer(accounts[1], 50, { from: accounts[2], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should allow the admin to unfreeze the contract', async () => {
        await tokenContract.freeze({ from: accounts[0], gas: '1000000' });
        let frozen = await tokenContract.frozen();

        assert(!frozen);
    });
});
