// Version: 1.0173
// Минимални ABI-та за наблюдение + pause.
'use strict';

module.exports = {
  TOKEN: [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function isPaused() view returns (bool)',
    'function pause()',                       // onlyAdmin — викаме с guardian
    'function isBlacklisted(address) view returns (bool)',
  ],
  PAIR: [
    'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function token0() view returns (address)',
    'function token1() view returns (address)',
  ],
  FACTORY: [
    'function getPair(address tokenA, address tokenB) view returns (address pair)',
  ],
};
