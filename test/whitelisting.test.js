'use strict';

const SecurityToken = artifacts.require('SecurityToken');
let tokenContract;

const hash = require('./helpers/hash');

contract('Whitelisting', async (accounts) => {
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

    it('should list holders appropriately', async () => {
        let isHolder1 = await tokenContract.isHolder.call(accounts[1]);
        let isHolder2 = await tokenContract.isHolder.call(accounts[2]);
        let isHolder3 = await tokenContract.isHolder.call(accounts[3]);
        let isHolder4 = await tokenContract.isHolder.call(accounts[9]);

        assert(isHolder1 == true 
            && isHolder2 == true 
            && isHolder3 == false 
            && isHolder4 == false);
    });

    it('should list verified addresses appropriately', async () => {
        let isVerified1 = await tokenContract.isVerified.call(accounts[1]);
        let isVerified2 = await tokenContract.isVerified.call(accounts[2]);
        let isVerified3 = await tokenContract.isVerified.call(accounts[3]);
        let isVerified4 = await tokenContract.isVerified.call(accounts[9]);

        assert(isVerified1 == true 
            && isVerified2 == true 
            && isVerified3 == true 
            && isVerified4 == false);
    });

    it('should list the correct balances', async () => {
        let account1Balance = await tokenContract.balanceOf.call(accounts[1]);
        let account2Balance = await tokenContract.balanceOf.call(accounts[2]);
        let account3Balance = await tokenContract.balanceOf.call(accounts[3]);

        assert.strictEqual(account1Balance.toString(), '100', 'accounts[1] balance is not listed properly.');
        assert.strictEqual(account2Balance.toString(), '200', 'accounts[2] balance is not listed properly.');
        assert.strictEqual(account3Balance.toString(), '0', 'accounts[3] balance is not listed properly.');
    });

    it('should correctly update information hashes', async () => {
        let infoHash = hash('Test');
        let hasHash = await tokenContract.hasHash.call(accounts[1], infoHash);

        assert(hasHash, 'holder1 does not have the correct hash on setup.');

        let infoHash2 = hash('Test2');
        await tokenContract.updateVerified(accounts[1], infoHash2, { from: accounts[0], gas: '1000000' });
        let hasHash2 = await tokenContract.hasHash.call(accounts[1], infoHash2);

        assert(hasHash2, 'holder1 information hash not updated properly.');
    });

    it('should throw when providing an empty hash', async () => {
        let emptyHash = hash('');

        try {
            await tokenContract.updateVerified(accounts[1], emptyHash, { from: accounts[0], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should correctly remove accounts from the whitelist', async () => {
        await tokenContract.removeVerified(accounts[3], { from: accounts[0], gas: '1000000' });
        let verified = await tokenContract.isVerified.call(accounts[3]);
    
        assert(!verified);
    });

    it('should not allow the admin to whitelist an account multiple times', async () => {
        try {
            const infoHash = hash('Test');
            await tokenContract.addVerified(accounts[1], infoHash, { from: accounts[0], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should not allow the admin to remove an account while it is still a shareholder', async () => {
        try {
            await tokenContract.removeVerified(accounts[1], { from: accounts[0], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should list the correct address with holderAt', async () => {
        // accounts[2] was added second, so it should be at index 1
        let address = await tokenContract.holderAt.call(1);

        assert.strictEqual(accounts[2], address);
    });

    it('should should throw on calling holderAt with an index that is out of range', async () => {
        try {
            let address = await tokenContract.holderAt.call(25);
            assert(false);
        } catch (e) {
            assert(true);
        }
    });
});
