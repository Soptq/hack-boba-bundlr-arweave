// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

contract ArweaveStorageManagerContract {

    address private _owner;
    mapping (address => string) private storages;

    constructor() {
        _owner = msg.sender;
    }

    function set(string memory txid) external {
        storages[msg.sender] = txid;
    }

    function get() external view returns (string memory) {
        return storages[msg.sender];
    }
}