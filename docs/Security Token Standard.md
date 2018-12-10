# Tokenise.eu Ethereum Security Token Standard

## Overview

The Tokenise.eu Ethereum smart contracts are designed to be regulatory-compliant and made to work in conjunction with the off-chain applications. This documentation is here to provide you with an in-depth explanation of the inner workings of the `SecurityToken.sol` contract. The contract is based on the ERC-884 standard, with some modest extensions to provide full compliance and flexibility. The repository also includes an interface contract of `SecurityToken.sol` at `SecurityTokenInterface.sol`.

1. [Basic Specifications](#Basics)
2. [Whitelisting](#Whitelisting)
3. [Shareholders](#Shareholders)
4. [Transfers](#Transfers)
5. [Restricting transfers](#Restrictions)
6. [Issuance](#Issuance)
7. [Migration](#Migration)
8. [Burning](#Burning)
9. [Canceling addresses](#Canceling)
10. [Verifying](#Verifying)

## Basics

The contract starts off with a few basic global variables.

```
bytes32 constant private ZERO_BYTES = bytes32(0);
address constant private ZERO_ADDRESS = address(0);

uint8 public decimals = 0; // Has to be zero in all cases
string public name;
string public symbol;

mapping(address => bytes32) private verified;
mapping(address => address) private cancellations;
mapping(address => uint256) private holderIndices;
mapping(address => bool) private locked;

address[] private shareholders;

bool public frozen = false;
bool public migrated = false;
```
<sup>• Lines 17-32 in SecurityToken.sol</sup>

This section declares the zero values for a hash and an address, for convenience later on. It also declares the `decimals` as 0 outright, as it will need to be set to zero (shares are indivisible). Below this it has the `name` and `symbol`, as seen on any standard ERC-20 contract. These two variables are set in the constructor.

Four mappings are declared beneath this: 
* `verified`, holding all the whitelisted addresses and a hash of their info
* `cancellations`, holding cancelled addresses and their replacement addresses
* `holderIndices`, holding the index of an address in the `shareholders` array (declared below)
* `locked`, indicating the lock status of an address

The `shareholders` array is declared below, and holds all of the addresses who are holding tokens at any given time.

Lastly, `frozen` and `migrated` are declared, used for freezing and migrating the contract.

Then, we have a constructor and a fallback function.

```
constructor(string _name, string _symbol) 
    public 
{
    name = _name;
    symbol = _symbol;
}
```
<sup>• Lines 74-79 in SecurityToken.sol</sup>

This constructor will simply set the name and symbol in the contract.

```
function()
    public
    payable
{
    revert("This contract does not accept payments");
}
```

A simple fallback function that reverts any payment made to it.

## Whitelisting

### Adding investors

The token contract has rules on who is allowed to send/receive/hold the tokens. An individual has to be 'whitelisted' on the contract in order to gain permission. This happens through the `addVerified` function.

```
function addVerified(address addr, bytes32 hash)
    public
    onlyOwner
    isNotMigrated
    isNotCancelled(addr)
{
    require(addr != ZERO_ADDRESS, "Invalid address provided.");
    require(hash != ZERO_BYTES, "Invalid data hash provided.");
    require(verified[addr] == ZERO_BYTES, "Address has been verified already.");

    verified[addr] = hash;
    emit VerifiedAddressAdded(addr, hash, msg.sender);
}
```
<sup>• Lines 117-129 in SecurityToken.sol</sup>

As shown above, the function will take an Ethereum address, along with a hash of the individual's information as the function parameters. The information has to match what is stored in the off-chain KYC database, so that exchanges and regulators are able to cross-check the information on the contract with that on the off-chain database. To ensure continuity of data, the information should be hashed with the `web3.utils.soliditySha3` function, and then converted to a byte array through `web3.utils.hexToBytes`. The `onlyOwner` modifier ensures that only an authorized entity can whitelist individuals.

Having the address whitelisted now allows it to pass the check for sending and receiving shares. The address will be mapped to it's data in `mapping(address => bytes32) private verified;` (line 24 in SecurityToken.sol). Consequently, when sending or receiving shares, this check will run:

```
modifier isVerifiedAddress(address addr) {
    require(verified[addr] != ZERO_BYTES, "Not a valid address");
    _;
}
```
<sup>• Lines 34-37 in SecurityToken.sol</sup>

This proves that the address is known to the contract and has KYC information associated with it.

### Updating investor info

If an individual's KYC information changes while they are already whitelisted (for example in the event of relocation), the information can be updated through the `updateVerified` function.

```
function updateVerified(address addr, bytes32 hash)
    public
    onlyOwner
    isNotMigrated
    isVerifiedAddress(addr)
{
    require(hash != ZERO_BYTES, "Invalid data hash provided");

    bytes32 oldHash = verified[addr];
    if (oldHash != hash) {
        verified[addr] = hash;
        emit VerifiedAddressUpdated(addr, oldHash, hash, msg.sender);
    }
}
```
<sup>• Lines 161-174 in SecurityToken.sol</sup>

The function will simply check if the passed data hash is not empty (which would essentially remove the individual from the whitelist) and changes the old one out for the new one. The updated data hash should then match their new KYC info. This function is also guarded by an `onlyOwner` modifier.

### Removing investors

If the need arises to remove an individual from the contract whitelist, `removeVerified` may be called.

```
function removeVerified(address addr)
    public
    onlyOwner
    isNotMigrated
{
    require(balances[addr] == 0, "Address still holds tokens - please empty the account before removing it from the list");

    if (verified[addr] != ZERO_BYTES) {
        verified[addr] = ZERO_BYTES;
        emit VerifiedAddressRemoved(addr, msg.sender);
    }
}
```
<sup>• Lines 138-149 in SecurityToken.sol</sup>

`removeVerified` will first check to see if the account is empty, and will throw if this condition is not met. Then, it will proceed to clear out the data hash from the `verified` mapping, preventing it from receiving or sending tokens. Again, the `onlyOwner` modifier ensures that this function can only be called by those authorized to do so.

## Shareholders

The token contract keeps a seperate record of addresses who are holding tokens. This is known as the shareholders array. There are two functions that govern the shareholders array. The first one is `updateShareholders`.

```
function updateShareholders(address addr)
    internal
{
    if (holderIndices[addr] == 0) {
        holderIndices[addr] = shareholders.push(addr);
    }
}
```
<sup>• Lines 442-448 in SecurityToken.sol</sup>

This function is used if an address receives tokens. If an address is not yet included in the shareholders array, it will get added and an index will get mapped to it, for retrieval purposes later.

The second function is `pruneShareholders`.

```
function pruneShareholders(address addr, uint256 value)
    internal
{
    uint256 balance = super.balanceOf(addr);
    if ((balance - value) > 0) {
        return;
    }

    address lastHolder = shareholders[shareholders.length - 1];
    uint256 holderIndex = holderIndices[addr] - 1;

    // Overwrite the addr's slot with the last shareholder
    shareholders[holderIndex] = lastHolder;

    // Also copy over the index (thanks @mohoff for spotting this)
    // ref https://github.com/davesag/ERC884-reference-implementation/issues/20
    holderIndices[lastHolder] = holderIndices[addr];

    // Trim the shareholders array (which drops the last entry)
    shareholders.length--;

    // And zero out the index for addr
    holderIndices[addr] = 0;
}
```
<sup>• Lines 458-481 in SecurityToken.sol</sup>

This function is used when an address has tokens deducted from it, and will remove an address from the shareholders array by swapping it with the last entry and then cutting the length by one. The index is also swapped, to retain data continuity.

## Transfers

Like a standard token contract, transfers can be made through the `transfer` and `transferFrom` methods available on the contract.

```
function transfer(address to, uint256 value)
    public
    isNotFrozen
    isNotLocked(msg.sender)
    isNotLocked(to)
    isVerifiedAddress(to)
    returns (bool)
{
    updateShareholders(to);
    pruneShareholders(msg.sender, value);
    return super.transfer(to, value);
}
```
<sup>• Lines 216-227 in SecurityToken.sol</sup>

The `transferFrom` function is identical (found at lines 240-251 in SecurityToken.sol), apart from the function name, the addition of a `from` parameter and the call to `super.transferFrom`. These `super` functions call the standard ERC-20 transfer functions. Before running them, the token contract checks if:
* the contract is not frozen
* both accounts are unlocked
* the receiver is whitelisted

If all these conditions are met, then the function executes. Firstly, the shareholders array is updated accordingly through the `updateShareholders` and `pruneShareholders` functions. Then, the transfer is attempted. The function should then return `true` if the transfer was successful. If not, the function will throw and state will be reverted.

## Restrictions

As an extension to the ERC-884 standard, the contract allows an administrator to either lock up individual accounts, or to freeze all accounts simultaneously. This is done by simple toggle functions in the contract.

### Freezing

```
function freeze() 
    public 
    onlyOwner 
    isNotMigrated
{
    frozen = !frozen;
    emit Freeze(frozen);
}
```
<sup>• Lines 273-280 in SecurityToken.sol</sup>

The function will simply toggle the `frozen` value in the contract. The `frozen` value is used in the modifier `isNotFrozen`

```
modifier isNotFrozen() {
    require(!frozen, "Token contract is currently frozen");
    _;
}
```
<sup>• Lines 54-57 in SecurityToken.sol</sup>

and this modifier is placed on the functions `transfer` and `transferFrom`. As such, when `frozen == true`, the contract should not allow any transfers to happen.

### Locking

```
function lock(address addr)
    public
    onlyOwner
    isNotMigrated
{
    locked[addr] = !locked[addr];
    emit Lock(addr, locked[addr]);
}
```
<sup>• Lines 303-310 in SecurityToken.sol</sup>

Another simple toggle function, allowing an individual account to be locked and prohibited from sending and receiving tokens. A locked address will produce `true` if passed to the `locked` mapping, which allows us to have the isNotLocked modifier.

```
modifier isNotLocked(address addr) {
    require(!locked[addr], "Address is currently locked");
    _;
}
```
<sup>• Lines 59-62 in SecurityToken.sol</sup>

This modifier is placed on `transfer` and `transferFrom` twice, both for the sender and receiver, and will prevent transfers from being made if either party is currently locked. Additionally, anybody can check an account's locked status through `isLocked`.

```
function isLocked(address addr)
    public
    view
    returns (bool)
{
    return locked[addr];
}
```
<sup>• Lines 419-425 in SecurityToken.sol</sup>

## Issuance

Issuance is quite straight-forward. To issue tokens, use the `issue` function.

```
function issue(address to, uint256 amount)
    public
    onlyOwner
    isNotMigrated
    isVerifiedAddress(to)
    returns (bool)
{
    updateShareholders(to);
    return super.mint(to, amount);
}
```
<sup>• Lines 98-107 in SecurityToken.sol</sup>

The passed address will receive the amount of tokens specified. The address will have to be whitelisted beforehand to receive newly issued tokens. A call to `updateShareholders` is also made, as the address is receiving tokens.

## Migration

As an extension to the ERC-884 standard, the contract has been fitted with the functionality to migrate it's data to another contract. Most of this happens off-chain, but there are some things that will happen on the contract as well that we will go over.

First off, there is a simple public boolean value which will indicate whether or not the contract is still considered the up-to-date ledger for it's tokens. This is denoted with the `migrated` value, and will be `false` until migration has been triggered. Functions which will be restricted after migration will fail the `isNotMigrated` check.

```
modifier isNotMigrated() {
    require(!migrated, "Token contract has been migrated and is no longer functional.");
    _;
}
```
<sup>• Lines 64-67 of SecurityToken.sol</sup>

These functions include `issue`, `addVerified`, `removeVerified`, `updateVerified`, `cancelAndReissue`, `burn`, `freeze`, `migrate` and `lock`. Additionally, upon migration the contract will be frozen as well, stopping transfers from happening. The contract can be set up for migration with the `migrate` function.

```
function migrate()
    public
    onlyOwner
    isNotMigrated
{
    frozen = true;
    migrated = true;
    emit Migrate();
}
```
<sup>• Lines 288-296 in SecurityToken.sol</sup>

This will freeze and close the contract. Afterwards, the contract is essentially locked down so that nothing about it can be changed. This makes migration a good option in the event a security breach is detected, and will need to be protected from attackers exploiting the contract while a fix is being prepared. As a side effect, the locked contract serves as an immutable snapshot of the contract state at the time of migration, and could aid in transferring data in case of any issues on the off-chain side.

Additionally, the migration function can allow for migrating between blockchains, if so desired by the administrator.

Calling `migrate` will emit a `Migrate` event which will be picked up on by the off-chain applications, which will wrap up their processes, and prepare the databases for migration. This will put the state of the contract at migration into an importable file which can then be used to re-populate an updated contract with. The off-chain application documentation will elaborate on this process, as it is outside of the scope of this documentation.

## Burning

Burning is quite straight-forward, and can only be done by the administrator.

```
function burn(address from, uint256 amount) 
    public
    onlyOwner
    isNotMigrated
{
    pruneShareholders(from, amount);
    super._burn(from, amount);
}
```
<sup>• Lines 260-267 in SecurityToken.sol</sup>

This will run `pruneShareholders` to keep the shareholders array up to date, and then make a call to `_burn`.

## Canceling

In case of a holder losing access to their account, or in case of any issue with an individual holding tokens requiring intervention, the contract offers the `cancelAndReissue` function as a solution.

```
function cancelAndReissue(address original, address replacement)
    public
    onlyOwner
    isNotMigrated
    isShareholder(original)
    isNotShareholder(replacement)
    isVerifiedAddress(replacement)
{
    // Replace the original address in the shareholders array
    // and update all the associated mappings.
    verified[original] = ZERO_BYTES;
    cancellations[original] = replacement;
    uint256 holderIndex = holderIndices[original] - 1;
    shareholders[holderIndex] = replacement;
    holderIndices[replacement] = holderIndices[original];
    holderIndices[original] = 0;
    super._transfer(original, replacement, balanceOf(original));
    emit VerifiedAddressSuperseded(original, replacement, msg.sender);
}
```
<sup>• Lines 186-204 in SecurityToken.sol</sup>

As shown above, the contract will essentially replace one address with another, removing the original from the whitelist and moving it's balance to the replacement address. This function gives the administrator full control over any holder's tokens, and should be used with care.

The `isSuperseded` function can be used to directly check if an address has been canceled.

```
function isSuperseded(address addr)
    public
    view
    onlyOwner
    returns (bool)
{
    return cancellations[addr] != ZERO_ADDRESS;
}
```
<sup>• Lines 389-396 in SecurityToken.sol</sup>

Additionally, the currently used address for a canceled one can also be retrieved from the contract through the `getCurrentFor` function.

```
function getCurrentFor(address addr)
    public
    view
    onlyOwner
    returns (address)
{
    return findCurrentFor(addr);
}
```
<sup>• Lines 405-412 in SecurityToken.sol</sup>

This will make a call to the internal `findCurrentFor` function.

```
function findCurrentFor(address addr)
    internal
    view
    returns (address)
{
    address candidate = cancellations[addr];
    if (candidate == ZERO_ADDRESS) {
        return addr;
    }

    return findCurrentFor(candidate);
}
```
<sup>• Lines 432-443 in SecurityToken.sol</sup>

This function will recursively dig through cancelled addresses until it has found the most recent one, and returns it.

## Verifying

The contract has a pair of public functions which can be used to check whether an address is verified and is holding shares, and a function which can be used to cross-check the KYC information hash stored on the contract.

First off, the simple checks:

```
function isVerified(address addr)
    public
    view
    returns (bool)
{
    return verified[addr] != ZERO_BYTES;
}
```
<sup>• Lines 346-352 in SecurityToken.sol</sup>

A simple function to check if an address is known to the contract. It will return either true or false depending on whether the contract has an information hash stored with the address.

```
function isHolder(address addr)
    public
    view
    returns (bool)
{
    return holderIndices[addr] != 0;
}
```
<sup>• Lines 359-365</sup>

This function will return either true or false depending on if the address is included in the shareholders array.

For exchanges and regulators to verify and compare KYC information, they can retrieve the KYC information from the off-chain database, hash it, and make use of the `hasHash` function.

```
function hasHash(address addr, bytes32 hash)
    public
    view
    returns (bool)
{
    require(addr != ZERO_ADDRESS, "Invalid address");

    return verified[addr] == hash;
}
```
<sup>• Lines 374-382 in SecurityToken.sol</sup>

The function will return either true or false depending on if the supplied hash matches the one stored in the contract and mapped to `addr`.
