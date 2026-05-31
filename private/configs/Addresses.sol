// Version: 1.0093
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * version v38
 * @title Addresses
 * @dev ЕДИНСТВЕН централен файл с адреси за всички проекти в eco-система.
 * Живее в: private/configs/Addresses.sol
 *
 * Използва се от:
 *   - private/token/contracts/kcy-meme-1.sol
 *   - private/multisig/contracts/SimpleMultiSig.sol
 *   - и двата проекта импортират през "../../configs/Addresses.sol"
 *
 * За промяна на адреси - редактирай САМО ТОЗИ ФАЙЛ!
 */

library Addresses {
    // ===================================================
    // BSC TESTNET (chainId: 97)
    // ===================================================
    address internal constant TESTNET_DEV = 0xCBfA2d3612b7474fF89c0746Ea6bAEee06A61702;
    address internal constant TESTNET_MARKETING = 0x67eDbe18Ad6AB1ff0D57CCc511F56485EfFcabE7;
    address internal constant TESTNET_TEAM = 0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6;
    address internal constant TESTNET_ADVISOR = 0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6;
    address internal constant TESTNET_ROUTER = 0xD99D1c33F9fC3444f8101754aBC46c52416550D1;
    address internal constant TESTNET_FACTORY = 0x6725F303b657a9451d8BA641348b6761A6CC7a17;
    address internal constant TESTNET_WBNB = 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd;

    // ===================================================
    // BSC MAINNET (chainId: 56) - по план addresses1.txt
    // ===================================================
    // DEV = създателят на kcy-meme-1 = Tangem (96M токена при deploy)
    address internal constant MAINNET_DEV = 0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A;
    // MARKETING = Trezor bnbvis
    address internal constant MAINNET_MARKETING = 0xB6CFeed7d42Aa6689faf0b9eB284f2737ac32053;
    // TEAM = Trezor bnbhdn
    address internal constant MAINNET_TEAM = 0xD2D7f9C7aFC2Ae8D4063bcb68E133E98fC2F824d;
    // ADVISOR = Ledger bnb1
    address internal constant MAINNET_ADVISOR = 0x35a57ac45952fd10d73f6b412368db9a6E4886e8;

    // DEX (официални PancakeSwap)
    address internal constant MAINNET_ROUTER = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address internal constant MAINNET_FACTORY = 0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73;
    address internal constant MAINNET_WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;

    // ===================================================
    // MULTI-SIG OWNERS (3-of-5) - по план addresses1.txt
    // ===================================================
    // 1 Trezor + 1 Tangem + 3 Ledger
    address internal constant MULTISIG_OWNER_1_TREZOR  = 0xB6CFeed7d42Aa6689faf0b9eB284f2737ac32053; // bnbvis
    address internal constant MULTISIG_OWNER_2_TANGEM  = 0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A; // BnB
    address internal constant MULTISIG_OWNER_3_LEDGER1 = 0x35a57ac45952fd10d73f6b412368db9a6E4886e8; // bnb1
    address internal constant MULTISIG_OWNER_4_LEDGER2 = 0x35e089F98a263CEDbC23f50946AF9A4fe06Ab083; // bnb2
    address internal constant MULTISIG_OWNER_5_LEDGER3 = 0xb2FEBFb8705B2bD1F9B50bA6f0011C55073b5900; // bnb3

    // ===================================================
    // ДОПЪЛНИТЕЛНИ LEDGER HOLDERS (bnb4-bnb7)
    // ===================================================
    // Не се използват в контрактите - за пост-deploy операции
    // (бонус-distribution, backup, и т.н.). Тук са за reference.
    address internal constant LEDGER_HOLDER_4 = 0x9FE5E19fff564775084b5561b0FE2A99184548C3; // bnb4
    address internal constant LEDGER_HOLDER_5 = 0x679ceE1e6f82890364FBdF3dcE2974ce19A41c1b; // bnb5
    address internal constant LEDGER_HOLDER_6 = 0x24787F86ddDA9D7C32AdD314b1F196b79C5ED247; // bnb6
    address internal constant LEDGER_HOLDER_7 = 0xE1B06c3886B08A5642D9eaD69e95a133e4cF39B9; // bnb7 = ADMIN_ADDRESS за admin-config.js
}
