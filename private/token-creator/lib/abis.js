// Version: 1.0173
// Минимални ABI-та за PancakeSwap Router/Factory + ERC20 (за добавяне на ликвидност).
'use strict';

module.exports = {
  ROUTER: [
    'function factory() external view returns (address)',
    'function WETH() external view returns (address)',
    'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)',
  ],
  FACTORY: [
    'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  ],
  ERC20: [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)',
    'function decimals() external view returns (uint8)',
    'function symbol() external view returns (string)',
  ],
};
