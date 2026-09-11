// Version: 3.0000
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./PupikesV2Base.sol";

/**
 * PupikesGuardTokenV2 — чист ERC-20 БЕЗ такси и лимити, с флагманската защита „Vault Guard" (таймлок на големите
 * преводи пер-държател с възможност за отмяна) + всички V2 защити от PupikesV2Base (блокиране, затворена/спряна
 * търговия, задържане на подозрителни преводи, оператор, втори одобряващ, възстановяване, спасяване).
 * Освободени тук: собственикът (текущият) и самият договор.
 */
contract PupikesGuardTokenV2 is PupikesV2Base {
    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _initialSupply,     // в най-малки единици (вече * 10**decimals от викащия)
        uint256 _defaultThreshold,  // 0 = защитата изкл. по подразбиране
        uint64  _defaultDelay       // напр. 3600 (1 час)
    ) PupikesV2Base(_name, _symbol, _decimals, _initialSupply, _defaultThreshold, _defaultDelay) {}

    function _exempt(address a) internal view override returns (bool) { return a == owner || a == address(this); }
    function _deliver(address from, address to, uint256 value, bool deducted) internal override {
        if (!deducted) balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}
