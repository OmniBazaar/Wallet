import { Contract } from 'ethers';
import type { Provider } from 'ethers';
import {
  OMNICOIN_METADATA,
  createOmniCoinContract,
  getOmniCoinAddress,
} from '../../config/omnicoin-integration';

/**
 * OmniCoin token metadata used across the wallet.
 * Now properly integrated with deployed contracts from Coin module.
 */
export const OmniCoinMetadata = OMNICOIN_METADATA;

/**
 * Get the OmniCoin contract address for the current network
 * @param provider Ethers Provider to determine network
 * @returns Contract address
 */
export function getContractAddress(provider: Provider): string {
  return getOmniCoinAddress(provider);
}

/**
 * Read OmniCoin ERC-20 balance using an ethers Provider.
 * @param address EVM address to query
 * @param provider Ethers Provider (JsonRpc/Browser)
 * @returns Promise resolving to the balance in wei
 */
export async function getOmniCoinBalance(
  address: string,
  provider: Provider,
): Promise<bigint> {
  try {
    const contract = createOmniCoinContract(provider);
    const balance = await contract.balanceOf(address);
    return BigInt(balance.toString());
  } catch (error) {
    console.error('Error fetching OmniCoin balance:', error);
    throw error;
  }
}

/**
 * Create an OmniCoin contract instance
 * @param provider Provider or Signer to use
 * @returns Contract instance
 */
export function getOmniCoinContract(provider: Provider): Contract {
  return createOmniCoinContract(provider);
}

export default OmniCoinMetadata;
