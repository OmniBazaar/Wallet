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
    '0x0000000000000000000000000000000000000000',
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
): Promise<string> {
  const contract = new Contract(OmniCoinMetadata.contractAddress, ERC20_ABI, provider) as any;
  const bal: bigint = await contract['balanceOf'](address);
  return bal.toString();
}

export default OmniCoinMetadata;
