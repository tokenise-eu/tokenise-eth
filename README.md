# Tokenise.eu Ethereum Smart Contracts

This repository contains the smart contracts for an Ethereum-based protocol enabling the tokenisation of financial instruments which are fully compliant with regulatory standards.

### Installing and testing

If you want to install the repository and run the tests, start off with these commands:

```bash
git clone https://github.com/tokenise-eu/tokenise-eth
cd tokenise-eth
npm install
```

These commands will ensure you download and fully install the repo. Tests can be ran through the `solidity-coverage` module by running

```bash
./node_modules/.bin/solidity-coverage
```

Alternatively, you can launch an instance of TestRPC/Ganache on your machine and run 

```bash
truffle test
```

for testing without generating a coverage report.

### Specifications

The repository uses `truffle@5.0.0-beta.2` and `solidity-coverage@0.5.11`. OpenZeppelin contracts are taken from the npm package `openzeppelin-solidity@2.0.0` to ensure the highest level of security for our contract base.

A full documentation of the `SecurityToken` contract can be found in the `docs` folder.
