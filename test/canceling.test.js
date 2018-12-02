'use strict';

const SecurityToken = artifacts.require('SecurityToken');
let tokenContract;

const hash = require('./helpers/hash');

contract('Canceling/Reissuing', async (accounts) => {
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

    it('should point to the original address on a getCurrentFor call before canceling', async () => {
        let address = await tokenContract.getCurrentFor.call(accounts[2]);

        assert.strictEqual(accounts[2], address);
    });

    it('should transfer all tokens to the new address', async () => {
        await tokenContract.cancelAndReissue(accounts[2], accounts[3], { from: accounts[0], gas: '1000000' });
        let holder2Balance = await tokenContract.balanceOf.call(accounts[2]);
        let whitelistedBalance = await tokenContract.balanceOf.call(accounts[3]);

        assert.strictEqual(holder2Balance.toString(), '0', 'accounts[2] still holds tokens.');
        assert.strictEqual(whitelistedBalance.toString(), '200', 'accounts[3] did not get all tokens.');
    });

    it('should remove the original address from the verified mapping', async () => {
        let verified = await tokenContract.isVerified.call(accounts[2]);

        assert(!verified);
    });

    it('should properly respond to a supersede check', async () => {
        let superseded = await tokenContract.isSuperseded.call(accounts[2]);

        assert(superseded);
    });

    it('should point to the new address on a getCurrentFor call', async () => {
        let current = await tokenContract.getCurrentFor.call(accounts[2]);

        assert.strictEqual(accounts[3], current);
    });

    it('should not allow the admin to cancel and reissue to unverified accounts', async () => {
        try {
            await tokenContract.cancelAndReissue(accounts[1], accounts[9], { from: accounts[0], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should not allow the admin to cancel and reissue for an account that holds no tokens', async () => {
        const infoHash = hash('Test');
        await tokenContract.addVerified(accounts[4], infoHash, { from: accounts[0], gas: '1000000' });
        await tokenContract.addVerified(accounts[5], infoHash, { from: accounts[0], gas: '1000000' });

        try {
            await tokenContract.cancelAndReissue(accounts[4], accounts[5], { from: accounts[0], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should not allow the admin to cancel and reissue to an account that holds tokens already', async () => {
        await tokenContract.issue(accounts[4], 100, { from: accounts[0], gas: '1000000' });
        
        try {
            await tokenContract.cancelAndReissue(accounts[4], accounts[3], { from: accounts[0], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });
    
    it('should not allow anybody else to call the cancel and reissue function', async () => {
        try {
            await tokenContract.cancelAndReissue(accounts[1], accounts[8], { from: accounts[9], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should not allow the admin to re-verify a canceled address', async () => {
        const infoHash = hash('Test');
        try {
            await tokenContract.addVerified(accounts[2], infoHash, { from: accounts[0], gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });
});
