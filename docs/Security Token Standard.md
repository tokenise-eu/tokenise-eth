# Tokenise.eu Ethereum Security Token Standard

**N.B. This documentation is still in progress and may be subject to change**

## Overview

The Tokenise.eu Ethereum smart contracts are designed to be regulatory-compliant and made to work in conjunction with the off-chain applications. This documentation is here to provide you with an in-depth explanation of the inner workings of the security tokens themselves, which reside on the blockchain. The contract is based on the ERC-884 standard, with some modest extensions to provide full compliance and flexibility.

1. [Whitelisting](#Whitelisting)
2. [Shareholders](#Shareholders)
3. [Transfers](#Transfers)
4. [Restricting transfers](#Restrictions)
5. [Issuance](#Issuance)
6. [Migration](#Migration)
7. [Burning](#Burning)
8. [Canceling addresses](#Canceling)
9. [Verifying](#Verifying)

## Whitelisting

### Adding investors

The token contract has rules on who is allowed to send/receive/hold the tokens. An individual has to be 'whitelisted' on the contract in order to gain permission. This happens through the `addVerified` function.

```
function addVerified(address addr, bytes32 hash)
    public
    onlyOwner
    isNotClosed
    isNotCancelled(addr)
{
    require(addr != ZERO_ADDRESS, "Invalid address provided.");
    require(hash != ZERO_BYTES, "Invalid data hash provided.");
    require(verified[addr] == ZERO_BYTES, "Address has been verified already.");

    verified[addr] = hash;
    emit VerifiedAddressAdded(addr, hash, msg.sender);
}
```
<sup>• Lines 122-134 in SecurityToken.sol</sup>

As shown above, the function will take an Ethereum address, along with a hash of the individual's information as the function parameters. The information has to match what is stored in the off-chain KYC database, so that exchanges and regulators are able to cross-check the information on the contract with that on the off-chain database. To ensure continuity of data, the information should be hashed with the `web3.utils.soliditySha3` function, and then converted to a byte array through `web3.utils.hexToBytes`. The `onlyOwner` modifier ensures that only an authorized entity can whitelist individuals.

Having the address whitelisted now allows it to pass the check for sending and receiving shares. The address will be mapped to it's data in `mapping(address => bytes32) private verified;` (line 24 in SecurityToken.sol). Consequently, when sending or receiving shares, this check will run:

```
modifier isVerifiedAddress(address addr) {
    require(verified[addr] != ZERO_BYTES, "Not a valid address.");
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
    isNotClosed
    isVerifiedAddress(addr)
{
    require(hash != ZERO_BYTES, "Invalid data hash provided.");

    bytes32 oldHash = verified[addr];
    if (oldHash != hash) {
        verified[addr] = hash;
        emit VerifiedAddressUpdated(addr, oldHash, hash, msg.sender);
    }
}
```
<sup>• Lines 166-179 in SecurityToken.sol</sup>

The function will simply check if the passed data hash is not empty (which would essentially remove the individual from the whitelist) and changes the old one out for the new one. The updated data hash should then match their new KYC info.

### Removing investors

If the need arises to remove an individual from the contract whitelist, `removeVerified` may be called.

```
function removeVerified(address addr)
    public
    onlyOwner
    isNotClosed
{
    require(balances[addr] == 0, "Address still holds tokens. Please empty the account before removing it from the list.");

    if (verified[addr] != ZERO_BYTES) {
        verified[addr] = ZERO_BYTES;
        emit VerifiedAddressRemoved(addr, msg.sender);
    }
}
```
<sup>• Lines 143-154 in SecurityToken.sol</sup>

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
<sup>• Lines 457-463 in SecurityToken.sol</sup>

This function is used if an address receives tokens. If an address is not yet included in the shareholders array, it will get added and an index will get mapped to it, for retrieval purposes later.

The second function is `pruneShareholders`.

```
function pruneShareholders(address addr, uint256 value)
    internal
{
    uint256 balance = balances[addr] - value;
    if (balance > 0) {
        return;
    }

    // If the address is not the last one in the array, swap it
    address lastHolder = shareholders[shareholders.length - 1];
    if (addr != lastHolder) {
        uint256 holderIndex = holderIndices[addr] - 1;

        // Overwrite the addr's slot with the last shareholder
        shareholders[holderIndex] = lastHolder;

        // Also copy over the index (thanks @mohoff for spotting this)
        // ref https://github.com/davesag/ERC884-reference-implementation/issues/20
        holderIndices[lastHolder] = holderIndices[addr];
    }

    // Trim the shareholders array (which drops the last entry)
    shareholders.length--;

    // And zero out the index for addr
    holderIndices[addr] = 0;
}
```
<sup>• Lines 472-498 in SecurityToken.sol</sup>

This function is used when an address has tokens deducted from it. If the address is not the last in the array, it will be swapped out with the last entry and then dropped off the array.

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
    if (super.transfer(to, value)) {
        updateShareholders(to);
        pruneShareholders(msg.sender, value);
        return true;
    }

    return false;
}
```
<sup>• Lines 219-234 in SecurityToken.sol</sup>

The `transferFrom` function is identical (found at lines 243-258 in SecurityToken.sol), apart from the function name, the `from` parameter and the call to `super.transferFrom`. These `super` functions call the standard ERC-20 transfer functions. Before running them, the token contract checks if:
* the contract is not frozen
* both accounts are unlocked
* the receiver is whitelisted

If all these conditions are met, then the function executes. Firstly, the transfer is attempted. If the `transfer` call is successful, the shareholders array is updated accordingly through the `updateShareholders` and `pruneShareholders` functions. The function will then return `true` or `false`, depending on if the `transfer` call was successful.

## Restrictions

As an extension to the ERC-884 standard, the contract allows an administrator to either lock up individual accounts, or to freeze all accounts simultaneously. This is done by simple toggle functions in the controller, which will call the contract's own functions.

### Freezing

```
function freeze() 
    public 
    onlyOwner 
    isNotClosed
{
    frozen = !frozen;
    emit Freeze(frozen);
}
```
<sup>• Lines 280-287 in SecurityToken.sol</sup>

The function will simply toggle the `frozen` value in the contract. The `frozen` value is used in the modifier `isNotFrozen`

```
modifier isNotFrozen() {
    require(!frozen, "Token contract is currently frozen.");
    _;
}
```
<sup>• Lines 54-57 in SecurityToken.sol</sup>

and this modifier is placed on the functions `transfer` and `transferFrom`. As such, when `frozen = true`, the contract should not allow any transfers to happen.

### Locking

```
function lock(address addr)
    public
    onlyOwner
    isNotClosed
{
    locked[addr] = !locked[addr];
    emit Lock(addr, locked[addr]);
}
```
<sup>• Lines 309-316 in SecurityToken.sol</sup>

Another simple toggle function, allowing an individual account to be locked and prohibited from sending and receiving tokens. A locked address will produce `true` if passed to the `locked` mapping, which allows us to have the isNotLocked modifier.

```
modifier isNotLocked(address addr) {
    require(!locked[addr], "Address is currently locked.");
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
<sup>• Lines 426-432 in SecurityToken.sol</sup>

## Issuance

Issuance is quite straight-forward on the contract side. To issue tokens, use the `issue` function.

```
function issue(address to, uint256 amount)
    public
    onlyOwner
    isNotClosed
    isVerifiedAddress(to)
    returns (bool)
{
    if (super.issue(to, amount)) {
        updateShareholders(to);
        return true;
    }

    return false;
}
```
<sup>• Lines 99-112 in SecurityToken.sol</sup>

The passed address will receive the amount of tokens specified. The address will have to be whitelisted beforehand to receive newly issued tokens.

## Migration

As an extension to the ERC-884 standard, the contract has been fitted with the functionality to migrate it's data to another contract. Most of this happens off-chain, but there are some things that will happen on the contract as well that we will go over.

First off, there is a simple public boolean value which will indicate whether or not the contract is still considered the up-to-date ledger for it's tokens. This is denoted with the `closed` value, and will be `false` until migration has been triggered. Functions which will be restricted after migration will fail the `isNotClosed` check.

```
modifier isNotClosed() {
    require(!closed, "Token contract has been migrated and is no longer functional.");
    _;
}
```
<sup>• Lines 64-67 of SecurityToken.sol</sup>

These functions include `issue`, `addVerified`, `removeVerified`, `updateVerified`, `cancelAndReissue`, `burn`, `freeze`, and `lock`. Additionally, upon migration the contract will be frozen as well, stopping transfers from happening. The contract can be set up for migration with the `migrate` function.

```
function migrate()
    public
    onlyOwner
    isNotClosed
{
    frozen = true;
    closed = true;
    emit Migrate();
}
```
<sup>• Lines 295-303 in SecurityToken.sol</sup>

This will freeze and close the contract. Afterwards, the contract is essentially locked down so that nothing about it can be changed. This makes migration a good option in the event a security breach is detected, and will need to be protected from attackers exploiting the contract while a fix is being prepared. As a side effect, the locked contract serves as an immutable snapshot of the contract state at the time of migration, and could aid in transferring data in case of any issues on the off-chain side.

Additionally, the migration function can allow for migrating between blockchains, if so desired by the administrator.

Calling `migrate` will emit a `Migrate` event which will be picked up on by the off-chain applications, which will wrap up their processes, and prepare the databases for migration. This will put the state of the contract at migration into an importable file which can then be used to re-populate an updated contract with. The off-chain application documentation will elaborate on this process, as it is outside of the contract domain.

## Burning

Burning is quite straight-forward, and can only be done by the administrator.

```
function burn(address from, uint256 amount) 
    public
    onlyOwner
    isNotClosed
{
    super._burn(from, amount);
    pruneShareholders(from, amount);
}
```
<sup>• Lines 267-274 in SecurityToken.sol</sup>

This will run `pruneShareholders` to keep the shareholders array up to date, and then make a call to `_burn`.

```
function _burn(address _account, uint256 _amount) internal {
    require(_account != 0, "Invalid address provided.");
    require(_amount <= balances[_account], "Amount exceeds balance.");

    totalSupply_ = totalSupply_.sub(_amount);
    balances[_account] = balances[_account].sub(_amount);
    emit Transfer(_account, address(0), _amount);
}
```
<sup>• Lines 105-112 in StandardToken.sol</sup>

This function will remove the specified `_amount` from `_account`, and emit a `Transfer` event showing that the tokens were burned.

## Canceling

In case of a holder losing access to their account, or in case of any issue with an individual holding tokens, the contract offers the `cancelAndReissue` function as a solution.

```
function cancelAndReissue(address original, address replacement)
    public
    onlyOwner
    isNotClosed
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
    balances[replacement] = balances[original];
    balances[original] = 0;
    emit VerifiedAddressSuperseded(original, replacement, msg.sender);
}
```
<sup>• Lines 191-210 in SecurityToken.sol</sup>

As shown above, the contract will essentially replace one address with another, removing the original from the whitelist and moving it's balance to the replacement address. This function gives the administrator full control over any holder's tokens, and should be used with care.

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
<sup>• Lines 352-358 in SecurityToken.sol</sup>

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
<sup>• Lines 365-371</sup>

This function will return either true or false depending on if the address is included in the shareholders array.

For exchanges and regulators to verify and compare KYC information, they can retrieve the KYC information from the off-chain database, hash it, and make use of the `hasHash` function.

```
function hasHash(address addr, bytes32 hash)
    public
    view
    returns (bool)
{
    if (addr == ZERO_ADDRESS) {
        return false;
    }

    return verified[addr] == hash;
}
```
<sup>• Lines 379-389 in SecurityToken.sol</sup>

The function will return either true or false depending on if the supplied hash matches the one stored in the contract and mapped to `addr`.
