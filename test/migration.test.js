'use strict';

const ganache = require('ganache-cli');
const provider = ganache.provider({ gasLimit: 10000000 });
const Web3 = require('web3');
const web3 = new Web3(provider);

const utils = require('../utils');
const fs = require('fs');
const csv = require('csv-parser');

const assert = require('assert');

let admin;

let tokenContract;

let addresses = [];
let info = [];
let balances = [];

describe('Migration', () => {
    before(async function() {
        this.timeout(0);
        addresses = [];
        info = [];
        balances = [];
        let accounts = await web3.eth.getAccounts();
        admin = accounts[0];
    
        const compiledToken = require('../build/SecurityToken.json');
        tokenContract = await new web3.eth.Contract(JSON.parse(compiledToken.interface))
            .deploy({ data: compiledToken.bytecode, arguments: ['Test', 'TST'] })
            .send({ from: admin, gas: '7000000' });
    
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
            await utils.Migrate(tokenContract, admin, addresses, info, balances);
        } catch (e) {
            console.log('Migration failed: ', e.message);
        }
    });

    it('should whitelist the investors upon migration', async function() {
        this.timeout(0);
        let result = true;

        for (let i = 0; i < addresses.length; i++) {
            let verified = await tokenContract.methods.isVerified(addresses[i]).call();
            assert(verified, 'Contract did not verify address ' + addresses[i] + ' upon migration.');
        }

        assert(result);
    });

    it('should have the right amount of shareholders upon migration', async () => {
        // There are 10 addresses in the csv with a 0 balance; these will not show up for holderCount()
        let holderCount = await tokenContract.methods.holderCount().call();
        assert.strictEqual(holderCount, '233');
    });

    it('should have the correct hashes', async function() {
        this.timeout(0);
 
        for (let i = 0; i < addresses.length; i++) {
            let infoHash = utils.Hash(info[i]);
            let check = await tokenContract.methods.hasHash(addresses[i], infoHash).call();
            assert(check, 'Contract does not hold the correct information hash for ' + addresses[i] + '.');
        }
    });
});