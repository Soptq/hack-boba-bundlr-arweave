// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

library SafeMath {
    /**
     * @dev Returns the addition of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     *
     * - Addition cannot overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting with custom message on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    /**
     * @dev Returns the multiplication of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     *
     * - Multiplication cannot overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts with custom message on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b > 0, errorMessage);
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts with custom message when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }
}

contract ArweaveStorageManagerContract {
    using SafeMath for uint256;

    struct ArweaveStorage {
        string pointer;
        uint256 lastUpdated;
        uint256 nonce;
    }

    struct WhitelistUser {
        string pubkey;
        bool harvested;
        uint256 blocknum;
        uint256 nonceOwner;
        uint256 fee;
    }

    address private _owner;
    uint8 private taxRate = 10;

    // `storages` stores arweave pointer to the real data.
    mapping (address => ArweaveStorage) private storages;

    // `sharing` indicates whether the user's storage is OK for sharing to others.
    mapping (address => bool) private sharing;

    // `fee` indicates how much other users have to pay in order to add themselves to the whitelist of the file.
    mapping (address => uint256) private fee;

    // `whitelist` stores other users' public key for encrypted file sharing.
    mapping (address => mapping (address => bool)) private isWhitelisted;
    mapping (address => mapping (address => uint256)) private whitelistIndex;
    mapping (address => WhitelistUser[]) private whitelist;

    // collected fees;
    mapping (address => uint256) private collectedFees;

    constructor() {
        _owner = msg.sender;
    }

    function transferOwner(address newOwner) external {
        require(_owner == msg.sender, "Ownable: caller is not the owner");
        _owner = newOwner;
    }

    function setTaxRate(uint8 _taxRate) external {
        require(_owner == msg.sender, "Ownable: caller is not the owner");
        taxRate = _taxRate;
    }

    // get msg.sender's pointer
    function get(address owner) external view returns (string memory) {
        require(owner == msg.sender || isWhitelisted[owner][msg.sender], "no access");
        return storages[owner].pointer;
    }

    // set msg.sender's pointer
    function set(string memory txid) external {
        ArweaveStorage memory arweaveStorage;
        arweaveStorage.pointer = txid;
        arweaveStorage.lastUpdated = block.number;
        arweaveStorage.nonce = storages[msg.sender].nonce + 1;
        storages[msg.sender] = arweaveStorage;
    }

    function isPublic(address owner) external view returns (bool) {
        return sharing[owner];
    }

    function getFee(address owner) external view returns (uint256) {
        if (!sharing[owner]) {
            return 0;
        }
        return fee[owner];
    }

    function permitSharing(uint256 requiredFee) external {
        require(!sharing[msg.sender], "file is shared");
        sharing[msg.sender] = true;
        fee[msg.sender] = requiredFee;
    }

    function closeSharing() external {
        require(sharing[msg.sender], "file is not shared");
        delete sharing[msg.sender];
        delete fee[msg.sender];
    }

    function checkWhitelisted(address owner) external view returns (bool) {
        return owner == msg.sender || isWhitelisted[owner][msg.sender];
    }

    // get whitelist. Whitelist can only be checked by file owner or whitelisted users.
    function getWhitelist() external view returns (WhitelistUser[] memory) {
        return whitelist[msg.sender];
    }

    function getPubkeys() external view returns (string[] memory) {
        string[] memory pubkeys = new string[](whitelist[msg.sender].length);
        for (uint256 i = 0; i < whitelist[msg.sender].length; i++) {
            pubkeys[i] = whitelist[msg.sender][i].pubkey;
        }
        return pubkeys;
    }

    // any unwhitelisted user can add himself to the whitelist of a shared file if he pays required fee.
    function addWhitelist(address owner, string memory pubkey) external payable {
        require(sharing[owner], "file is not shared");
        require(owner != msg.sender && !isWhitelisted[owner][msg.sender], "already whitelisted");
        require(msg.value >= fee[owner], "fee is not enough");
        if (msg.value > fee[owner]) {
            // refund
            (bool sent, bytes memory data) = payable(msg.sender).call{value: msg.value.sub(fee[owner])}("");
            require(sent, "Failed to send Ether");
        }
        isWhitelisted[owner][msg.sender] = true;
        whitelistIndex[owner][msg.sender] = whitelist[owner].length;

        WhitelistUser memory whitelistUser;
        whitelistUser.pubkey = pubkey;
        whitelistUser.harvested = false;
        whitelistUser.blocknum = block.number;
        whitelistUser.nonceOwner = storages[owner].nonce + 1;
        whitelistUser.fee = fee[owner];
        whitelist[owner].push(whitelistUser);
    }

    function getUnharvested(address owner) external view returns (uint256) {
        require(sharing[owner], "file is not shared");
        uint256 collectable = 0;
        for (uint256 i = 0; i < whitelist[owner].length; i++) {
            // 20160 blocks is roughly a week. That is, fees can only be collected after updating contents for 1 week.
            if (!whitelist[owner][i].harvested
            && storages[owner].lastUpdated > whitelist[owner][i].blocknum.add(20160)
            && storages[owner].nonce > whitelist[owner][i].nonceOwner.add(7)) {
                collectable.add(fee[owner]);
            }
        }
        return collectable;
    }

    // file owner can harvest collected fees from those who have access to his content.
    function harvest() external {
        uint256 collectable = 0;
        for (uint256 i = 0; i < whitelist[msg.sender].length; i++) {
            // 20160 blocks is roughly a week. That is, fees can only be collected after updating contents for 1 week.
            if (!whitelist[msg.sender][i].harvested
            && storages[msg.sender].lastUpdated > whitelist[msg.sender][i].blocknum.add(20160)
            && storages[msg.sender].nonce > whitelist[msg.sender][i].nonceOwner.add(7)) {
                collectable.add(fee[msg.sender]);
                whitelist[msg.sender][i].harvested = true;
            }
        }
        if (collectable == 0) {
            return;
        }
        collectable = collectable.mul(taxRate).div(100);
        (bool sent, bytes memory data) = payable(msg.sender).call{value: collectable}("");
        require(sent, "Failed to send Ether");
    }

    function withdraw(address owner) external {
        require(isWhitelisted[owner][msg.sender], "must be whitelisted");
        uint256 index = whitelistIndex[owner][msg.sender];
        if (!whitelist[owner][index].harvested
        && (storages[owner].lastUpdated < whitelist[owner][index].blocknum.add(20160)
        || storages[owner].nonce < whitelist[owner][index].nonceOwner.add(7))) {
            delete isWhitelisted[owner][msg.sender];
            (bool sent, bytes memory data) = payable(msg.sender).call{value: whitelist[owner][index].fee}("");
            require(sent, "Failed to send Ether");
            delete whitelist[owner][index];
        }
    }
}