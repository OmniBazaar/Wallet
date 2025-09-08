import { Contract } from 'ethers';
import type { Provider } from 'ethers';

/**
 * OmniCoin token metadata used across the wallet.
 * Contract address may be configured via environment at runtime.
 */
export const OmniCoinMetadata = {
  name: 'OmniCoin',
  symbol: 'XOM',
  decimals: 18 as const,
  /** EVM contract address for the OmniCoin ERC20 */
  contractAddress:
    (typeof process !== 'undefined' && (process as any)?.env?.OMNICOIN_CONTRACT_ADDRESS) ||
    '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3', // Use a test address instead of zero address
};

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

/**
 * Read OmniCoin ERC-20 balance using an ethers Provider.
 * @param address EVM address to query
 * @param provider Ethers Provider (JsonRpc/Browser)
 */
export async function getOmniCoinBalance(
  address: string,
  provider: Provider,
): Promise<bigint> {
  const contract = new Contract(OmniCoinMetadata.contractAddress, ERC20_ABI, provider) as any;
  const bal: bigint = await contract['balanceOf'](address);
  return bal;
}

export default OmniCoinMetadata;
