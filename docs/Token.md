# Tokenise.eu Ethereum Security Token Standard

**N.B. This documentation is still in progress and may be subject to change**

## Overview

The Tokenise.eu Ethereum smart contracts are designed to be regulatory-compliant and made to work in conjunction with the off-chain applications provided by us. This documentation is here to provide you with an in-depth explanation of the inner workings of the security tokens themselves, which reside on the blockchain. The contract is based on the ERC-884 standard, with some modest extensions to provide full compliance and flexibility for the administrator.

1. [Whitelisting](#Whitelisting)
2. [Transfers](#Transfers)
3. [Transfer restrictions](#Restrictions)
4. [Issuance](#Issuance)
5. [Migration](#Migration)
6. [Burning](#Burning)
7. [Admin-level](#Admin-level)

## Whitelisting

### Adding investors

The token contract has rules on who is allowed to send/receive/hold the tokens in order to comply with securities law. An individual has to be 'whitelisted' on the contract in order to gain permission. This happens through the `addVerified` function.

```
function addVerified(address addr, bytes32 hash)
    public
    onlyOwner
    isNotCancelled(addr)
{
    require(addr != ZERO_ADDRESS, "Invalid address provided.");
    require(hash != ZERO_BYTES, "Invalid data hash provided.");
    require(verified[addr] == ZERO_BYTES, "Address has been verified already.");
    verified[addr] = hash;
    emit VerifiedAddressAdded(addr, hash, msg.sender);
}
```
<sup>• Lines 188-199 in SecurityToken.sol</sup>

As shown above, the function will take an Ethereum address, along with a hash of the individual's information as the function parameters. The information has to match what is stored in the off-chain KYC database, so that exchanges and regulators are able to cross-check the information on the contract with that on the off-chain database. To ensure continuity of data, the information should be hashed with the Keccak256 algorhithm after being encoded according to the Solidity ABI (encodePacked). The `onlyOwner` modifier ensures that only an authorized entity can whitelist individuals.

Having the address whitelisted now allows it to pass the check for sending and receiving shares. The address will be mapped to it's data in `mapping(address => bytes32) private verified;` (line 34 in SecurityToken.sol). Consequently, when sending or receiving shares, this check will run:

```
modifier isVerifiedAddress(address addr) {
    require(verified[addr] != ZERO_BYTES, "Not a valid address.");
    _;
}
```
<sup>• Lines 74-77 in SecurityToken.sol</sup>

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
<sup>• Lines 230-242 in SecurityToken.sol</sup>

The function will simply check if the passed data hash is not empty (which would essentially remove the individual from the whitelist) and changes the old one out for the new one. The updated data hash should then match their new KYC info.

### Removing investors

If the need arises to remove an individual from the contract whitelist, `removeVerified` may be called.

```
function removeVerified(address addr)
    public
    onlyOwner
{
    require(balances[addr] == 0, "Address still holds tokens. Please empty the account before removing it from the list.");
    if (verified[addr] != ZERO_BYTES) {
        verified[addr] = ZERO_BYTES;
        emit VerifiedAddressRemoved(addr, msg.sender);
    }
}
```
<sup>• Lines 208-218 in SecurityToken.sol</sup>

`removeVerified` will first check to see if the account is empty, and will throw if this condition is not met. Then, it will proceed to clear out the data hash from the `verified` mapping, preventing it from receiving or sending tokens. Again, the `onlyOwner` modifier ensures that this function can only be called by those authorized to do so.


## Transfers



## Restrictions

As an extension to the ERC-884 standard, the contract allows an administrator to either lock up individual accounts, or to freeze all accounts simultaneously. This is done by simple toggle functions in the contract.

### Freezing

```
function freeze() 
    public 
    onlyOwner 
    isNotClosed
    returns (bool)
{
    if (!frozen) {
        frozen = true;
        emit Freeze();
        return true;
    }

    frozen = false;
    emit Unfreeze();
    return false;
}
```
<sup>• Lines 351-366 in SecurityToken.sol</sup>

The function will simply toggle the `frozen` value in the contract, and then return it. The `frozen` value is used in the modifier `isNotFrozen`

```
modifier isNotFrozen() {
    assert(!frozen);
    _;
}
```
<sup>• Lines 94-97 in SecurityToken.sol</sup>

and this modifier is placed on the functions `transfer` and `transferFrom`. As such, when `frozen = true`, the contract should not allow any transfers to happen (except for admin-level functions involving transfers, such as `burn` and `masterTransfer`).

### Locking

```
function lock(address _addr)
    public
    onlyOwner
    isNotClosed
    returns (bool)
{
    if (locked[_addr]) {
        locked[_addr] = false;
        emit Lock(_addr);
        return false;
    }

    locked[_addr] = true;
    emit Unlock(_addr);
    return true;
}
```
<sup>• Lines 389-404 in SecurityToken.sol</sup>

Another simple toggle function, allowing an individual account to be locked and prohibited from sending and receiving tokens. Much like `freeze`, the function will simply switch a value, and return it. A locked address will produce `true` if passed to the `locked` mapping, which allows us to have the isNotLocked modifier.

```
modifier isNotLocked(address _addr) {
    require(!locked[_addr], "Address is currently locked.");
    _;
}
```
<sup>• Lines 99-102 in SecurityToken.sol</sup>

This modifier is placed on `transfer` and `transferFrom` twice, both for the sender and receiver, and will prevent transfers from being made if either party is currently locked. Again, admin-level functions like `burn` and `masterTransfer` do not need to pass this check. Additionally, anybody can check an account's locked status through `isLocked`.

```
function isLocked(address _addr)
    public
    view
    returns (bool)
{
    if (locked[_addr]) {
        return true;
    }

    return false;
}
```
<sup>• Lines 502-512 in SecurityToken.sol</sup>

## Issuance



## Migration

As an extension to the ERC-884 standard, the contract has been fitted with the functionality to migrate it's data to another contract. Most of this happens off-chain, but there are some things that will happen on the contract as well that we will go over.

First off, there is a simple public boolean value which will indicate whether or not the contract is still considered the up-to-date ledger for it's tokens. This is denoted with the `closed` value, and will be `false` until migration has been triggered. Functions which will be restricted after migration will fail the `isNotClosed` check.

```
modifier isNotClosed() {
    require(!closed, "This contract has migrated. Please update your pointers.");
    _;
}
```
<sup>• Lines 104-107 of SecurityToken.sol</sup>

These functions include `mint`, `addVerified`, `removeVerified`, `updateVerified`, `cancelAndReissue`, `masterTransfer`, `burn`, `freeze`, and `lock`. Additionally, upon migration the contract will be frozen as well, stopping transfers from happening. The contract can be set up for migration with the `freezeSuper` function.

```
function freezeSuper()
    public
    onlyOwner
    isNotClosed
{
    frozen = true;
    closed = true;
    emit Migrate();
}
```
<sup>• Lines 374-382 in SecurityToken.sol</sup>

This will set the values appropriately. Afterwards, the contract is essentially locked down so that nothing about it can be changed. This makes migration a good option in the event a security breach is detected, and will need to be protected from attackers exploiting the contract while a fix is being prepared.

Additionally, the migration function can allow for crossing between platforms, if so desired by the administrator, or in the event of a platform going obsolete.

Calling `freezeSuper` will emit a `Migrate` event which will be picked up on by the off-chain applications, which will wrap up their processes, and prepare the databases for migration. This will put the state of the contract at migration into an importable file which can then be used to re-populate an updated contract with. The off-chain application documentation will elaborate on this.

## Burning



## Admin-level


