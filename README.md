# Tokenise.eu Ethereum Smart Contracts

This repository contains the smart contracts for our Ethereum-based protocol, allowing for the tokenization of financial instruments which are compliant with regulatory standards.

The protocol is still very much under construction. This and other related repositories will be much more expanded and fully documented as development progresses.

### Testing

If you want to run the current tests, go into your terminal and type

```bash
git clone https://github.com/tokenise-eu/tokenise-eth
cd tokenise-eth
npm install
node compile.js
npm run test
```

These commands will ensure you download and fully install the repo, compile the contracts and then run the tests. If you modify anything and would like to run the tests again, remember to run

```bash
node compile.js
```

before running

```bash
npm run test
```

again.