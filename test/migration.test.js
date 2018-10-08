'use strict';

const ganache = require('ganache-cli');
const provider = ganache.provider({ gasLimit: 10000000 });
const Web3 = require('web3');
const web3 = new Web3(provider);

const scripts = require('../scripts');
const fs = require('fs');
const csv = require('csv-parser');

const assert = require('assert');

let deployer;
let manager;

let controller;
let tokenContract;

let addresses = [];
let info = [];
let balances = [];

describe('Migration', async function() {
    before(async function() {
        this.timeout(0);
        addresses = [];
        info = [];
        balances = [];
        let accounts = await web3.eth.getAccounts();
        deployer = accounts[0];
        manager = accounts[1];
    
        let result = await scripts.Deploy(provider);
        let controllerAddress = result.tokenInterface;
        let tokenContractAddress = result.tokenContract;
    
        const compiledController = require('../build/SecurityController.json');
        const compiledToken = require('../build/SecurityToken.json');
    
        controller = new web3.eth.Contract(JSON.parse(compiledController.interface), controllerAddress);
        tokenContract = new web3.eth.Contract(JSON.parse(compiledToken.interface), tokenContractAddress);
    
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
            await scripts.Migrate(controller, deployer, manager, addresses, info, balances);
        } catch (e) {
            console.log('Migration failed: ', e.message);
        }
    });

    it('should whitelist the investors upon migration', async function() {
        this.timeout(0);
        let result = true;

        for (let i = 0; i < addresses.length; i++) {
            let verified = await tokenContract.methods.isVerified(addresses[i]).call();
            if (verified === false) {
                result = false;
            }
        }

        assert(result);
    });

    it('should have the right amount of shareholders upon migration', async () => {
        // There are 10 addresses in the csv with a 0 balance; these will not show up for holderCount()
        let holderCount = await tokenContract.methods.holderCount().call();
        assert.equal(holderCount, 233);
    });

    it('should have the correct hashes', async function() {
        this.timeout(0);
        let result = true;

        for (let i = 0; i < addresses.length; i++) {
            let check = await controller.methods.check(addresses[i], info[i]).call();
            if (check === false) {
                result = false;
            }
        }

        assert(result);
    });
});