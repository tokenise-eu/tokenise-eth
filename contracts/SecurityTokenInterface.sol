pragma solidity 0.4.25;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

/**
 *  @notice This contract is an interface of the ERC-884 standard, extended
 *  by Tokenise.eu to fit it to the desired protocol specifications.
 *  The original contract comment follows below.
 *
 *  -
 *
 *  An `ERC20` compatible token that conforms to Delaware State Senate,
 *  149th General Assembly, Senate Bill No. 69: An act to Amend Title 8
 *  of the Delaware Code Relating to the General Corporation Law.
 *
 *  This implementation is based on the ERC-884 standard.
 *
 *  Implementation Details.
 *
 *  An implementation of this token standard SHOULD provide the following:
 *
 *  `name` - for use by wallets and exchanges.
 *  `symbol` - for use by wallets and exchanges.
 *
 *  The implementation MUST take care not to allow unauthorised access to share
 *  transfer functions.
 *
 *  In addition to the above the following optional `ERC20` function MUST be defined.
 *
 *  `decimals` — MUST return `0` as each token represents a single Share and Shares are non-divisible.
 *
 *  @dev Ref https://github.com/ethereum/EIPs/pull/884
 */
contract SecurityTokenInterface is ERC20 {

    /**
     *  This event is emitted when a verified address and associated identity hash are
     *  added to the contract.
     *  @param addr The address that was added.
     *  @param hash The identity hash associated with the address.
     *  @param sender The address that caused the address to be added.
     */
    event VerifiedAddressAdded(
        address indexed addr,
        bytes32 hash,
        address indexed sender
    );

    /**
     *  This event is emitted when a verified address its associated identity hash are
     *  removed from the contract.
     *  @param addr The address that was removed.
     *  @param sender The address that caused the address to be removed.
     */
    event VerifiedAddressRemoved(address indexed addr, address indexed sender);

    /**
     *  This event is emitted when the identity hash associated with a verified address is updated.
     *  @param addr The address whose hash was updated.
     *  @param oldHash The identity hash that was associated with the address.
     *  @param hash The hash now associated with the address.
     *  @param sender The address that caused the hash to be updated.
     */
    event VerifiedAddressUpdated(
        address indexed addr,
        bytes32 oldHash,
        bytes32 hash,
        address indexed sender
    );

    /**
     *  This event is emitted when an address is cancelled and replaced with
     *  a new address.  This happens in the case where a shareholder has
     *  lost access to their original address and needs to have their share
     *  reissued to a new address.  This is the equivalent of issuing replacement
     *  share certificates.
     *  @param original The address being superseded.
     *  @param replacement The new address.
     *  @param sender The address that caused the address to be superseded.
     */
    event VerifiedAddressSuperseded(
        address indexed original,
        address indexed replacement,
        address indexed sender
    );

    /**
     *  This event is emitted when the administrator freezes or unfreezes transfers.
     *  @param frozen Indicates whether the contract was frozen or unfrozen.
     */
    event Freeze(bool frozen);

    /**
     *  This event is emitted when a certain address is locked or unlocked.
     *  @param addr The address that's being locked or unlocked.
     *  @param locked Indicates whether the address was locked or unlocked.
     */
    event Lock(address indexed addr, bool locked);

    /**
     *  This event is emitted when the migration function is called.
     *  This will happen in the event of a security breach, or a platform migration.
     */
    event Migrate();

    /**
     *  Issue an amount of tokens to the specified address. If the address was
     *  not holding any tokens beforehand, they get added to the shareholders array.
     *  @param to The address that will receive the issued tokens.
     *  @param amount The amount of tokens to issue.
     *  @return A boolean that indicates if the operation was successful.
     */
    function issue(address to, uint256 amount) public returns (bool);

    /**
     *  Add a verified address, along with an associated verification hash to the contract.
     *  Upon successful addition of a verified address, the contract must emit
     *  `VerifiedAddressAdded(addr, hash, msg.sender)`.
     *  It MUST throw if the supplied address or hash are zero, or if the address has already been supplied.
     *  @param addr The address of the person represented by the supplied hash.
     *  @param hash A cryptographic hash of the address holder's verified information.
     */
    function addVerified(address addr, bytes32 hash) public;

    /**
     *  Remove a verified address, and the associated verification hash. If the address is
     *  unknown to the contract then this does nothing. If the address is successfully removed, this
     *  function must emit `VerifiedAddressRemoved(addr, msg.sender)`.
     *  It MUST throw if an attempt is made to remove a verifiedAddress that owns Tokens.
     *  @param addr The verified address to be removed.
     */
    function removeVerified(address addr) public;

    /**
     *  Update the hash for a verified address known to the contract.
     *  Upon successful update of a verified address the contract must emit
     *  `VerifiedAddressUpdated(addr, oldHash, hash, msg.sender)`.
     *  If the hash is the same as the value already stored then
     *  no `VerifiedAddressUpdated` event is to be emitted.
     *  It MUST throw if the hash is zero, or if the address is unverified.
     *  @param addr The verified address of the person represented by the supplied hash.
     *  @param hash A new cryptographic hash of the address holder's updated verified information.
     */
    function updateVerified(address addr, bytes32 hash) public;

    /**
     *  Cancel the original address and reissue the Tokens to the replacement address.
     *  Access to this function MUST be strictly controlled.
     *  The `original` address MUST be removed from the set of verified addresses.
     *  Throw if the `original` address supplied is not a shareholder.
     *  Throw if the replacement address is not a verified address.
     *  This function MUST emit the `VerifiedAddressSuperseded` event.
     *  @param original The address to be superseded. This address MUST NOT be reused.
     *  @param replacement The address that supersedes the original. This address MUST be verified.
     */
    function cancelAndReissue(address original, address replacement) public;

    /**
     *  Burn tokens on a specific address. Can only be called by an administrator.
     *  If the amount is equal to the address' holdings, then the function will 
     *  remove it from the shareholders array.
     *  @param from The address to burn the tokens from.
     *  @param amount The amount of tokens to burn.
     */
    function burn(address from, uint256 amount) public;

    /**
     *  Extension to the ERC884 standard, a toggle function allowing the administrator
     *  to freeze/unfreeze all transfers.
     */
    function freeze() public;

    /**
     *  Extension to the ERC884 standard, put in place for migration purposes
     *  in a case of a security breach or similar event. This will essentially paralyze
     *  the token contract into a state where it can not be modified anymore.
     *  @notice The consequences of this function are final and can not be undone. Use with caution.
     */
    function migrate() public;

    /**
     *  Extension to the ERC884 standard, a toggle function allowing the administrator
     *  to freeze funds of a specific individual.
     *  @param addr The address to lock/unlock.
     */
    function lock(address addr) public;

    /**
     *  The number of addresses that own tokens.
     *  @return The number of unique addresses that own tokens.
     */
    function holderCount() public view returns (uint);

    /**
     *  By counting the number of token holders using `holderCount`
     *  you can retrieve the complete list of token holders, one at a time.
     *  It MUST throw if `index >= holderCount()`.
     *  @param index The zero-based index of the holder.
     *  @return The address of the token holder with the given index.
     */
    function holderAt(uint256 index) public view returns (address);

    /**
     *  Tests that the supplied address is known to the contract.
     *  @param addr The address to test.
     *  @return A boolean indicating if the address is known to the contract.
     */
    function isVerified(address addr) public view returns (bool);

    /**
     *  Checks to see if the supplied address is a share holder.
     *  @param addr The address to check.
     *  @return A boolean indicating if the supplied address owns tokens.
     */
    function isHolder(address addr) public view returns (bool);

    /**
     *  Checks that the supplied hash is associated with the given address.
     *  @param addr The address to test.
     *  @param hash The hash to test.
     *  @return A boolean indicating if the hash matches the one supplied with the address in 
     *  `addVerified`, or `updateVerified`.
     */
    function hasHash(address addr, bytes32 hash) public view returns (bool);

    /**
     *  Checks to see if the supplied address was superseded.
     *  @param addr The address to check.
     *  @return A boolean indicating if the supplied address was superseded by another address.
     */
    function isSuperseded(address addr) public view returns (bool);

    /**
     *  Gets the most recent address, given a superseded one.
     *  Addresses may be superseded multiple times, so this function needs to
     *  follow the chain of addresses until it reaches the final, verified address.
     *  @param addr The superseded address.
     *  @return The verified address that ultimately holds the share.
     */
    function getCurrentFor(address addr) public view returns (address);

    /**
     *  Extension to the ERC884 standard to check whether an account is locked or not.
     *  @param addr The address to check locked status for.
     *  @return A boolean indicating whether funds are frozen or not.
     */
    function isLocked(address addr) public view returns (bool);
}
