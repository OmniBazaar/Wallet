/**
 * OmniCoin Integration Configuration
 *
 * This file provides the integration points between the Wallet module
 * and the deployed OmniCoin contracts from the Coin module.
 */

import { ethers } from 'ethers';

/**
 * Contract addresses for different networks
 * These should match the deployed addresses from the Coin module
 */
interface ContractAddresses {
  OmniCoin: string;
  OmniCore: string;
  OmniGovernance: string;
  OmniBridge: string;
  PrivateOmniCoin: string;
  MinimalEscrow: string;
}

export const OMNICOIN_ADDRESSES: Record<string, ContractAddresses> = {
  // Local Hardhat network (chainId: 31337)
  // ⚠️  CRITICAL: These addresses MUST match Coin/deployments/localhost.json
  // Last deployed: 2025-10-22T12:42:57.224Z
  hardhat: {
    OmniCoin: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    OmniCore: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
    OmniGovernance: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
    OmniBridge: '0x0000000000000000000000000000000000000000', // Not yet deployed
    PrivateOmniCoin: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    MinimalEscrow: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
  },

  // COTI Testnet (chainId: 7082400)
  'coti-testnet': {
    OmniCoin: '0x0000000000000000000000000000000000000000', // To be deployed
    OmniCore: '0x0000000000000000000000000000000000000000',
    OmniGovernance: '0x0000000000000000000000000000000000000000',
    OmniBridge: '0x0000000000000000000000000000000000000000',
    PrivateOmniCoin: '0x0000000000000000000000000000000000000000',
    MinimalEscrow: '0x0000000000000000000000000000000000000000',
  },

  // COTI Mainnet (future)
  'coti-mainnet': {
    OmniCoin: '0x0000000000000000000000000000000000000000',
    OmniCore: '0x0000000000000000000000000000000000000000',
    OmniGovernance: '0x0000000000000000000000000000000000000000',
    OmniBridge: '0x0000000000000000000000000000000000000000',
    PrivateOmniCoin: '0x0000000000000000000000000000000000000000',
    MinimalEscrow: '0x0000000000000000000000000000000000000000',
  },
} as const;

/**
 * OmniCoin token metadata
 */
export const OMNICOIN_METADATA = {
  name: 'OmniCoin',
  symbol: 'XOM',
  decimals: 18,
  logo: '/assets/omnicoin-logo.png',
} as const;

/**
 * Get OmniCoin contract address for the current network
 * @param provider Ethers provider instance
 * @returns OmniCoin contract address
 */
export function getOmniCoinAddress(provider: ethers.Provider): string {
  // In ethers v6, network info might be under _network property
  const providerWithNetwork = provider as ethers.Provider & { _network?: { chainId?: number | string } };
  const network = providerWithNetwork._network;
  const chainId = network?.chainId !== undefined ? Number(network.chainId) : undefined;

  if (chainId === undefined || chainId === 0) {
    throw new Error('Cannot determine network chainId from provider');
  }

  switch (chainId) {
    case 31337: // Hardhat
    case 1337: { // Hardhat alternative
      const hardhatAddresses = OMNICOIN_ADDRESSES['hardhat'];
      if (hardhatAddresses === undefined) {
        throw new Error('Hardhat addresses not configured');
      }
      return hardhatAddresses.OmniCoin;
    }
    case 7082400: { // COTI Testnet
      const cotiTestnetAddresses = OMNICOIN_ADDRESSES['coti-testnet'];
      if (cotiTestnetAddresses === undefined) {
        throw new Error('COTI testnet addresses not configured');
      }
      return cotiTestnetAddresses.OmniCoin;
    }
    default:
      // Fallback to environment variable or throw
      if (process.env['OMNICOIN_CONTRACT_ADDRESS'] !== undefined && process.env['OMNICOIN_CONTRACT_ADDRESS'] !== '') {
        return process.env['OMNICOIN_CONTRACT_ADDRESS'];
      }
      throw new Error(`OmniCoin contract not deployed on chain ${chainId}`);
  }
}

/**
 * Get all OmniCoin-related contract addresses for the current network
 * @param provider Ethers provider instance
 * @returns Object containing all OmniCoin contract addresses
 */
export function getOmniCoinContracts(provider: ethers.Provider): ContractAddresses {
  // In ethers v6, network info might be under _network property
  const providerWithNetwork = provider as ethers.Provider & { _network?: { chainId?: number | string } };
  const network = providerWithNetwork._network;
  const chainId = network?.chainId !== undefined ? Number(network.chainId) : undefined;

  if (chainId === undefined || chainId === 0) {
    throw new Error('Cannot determine network chainId from provider');
  }

  switch (chainId) {
    case 31337: // Hardhat
    case 1337: { // Hardhat alternative
      const hardhatAddresses = OMNICOIN_ADDRESSES['hardhat'];
      if (hardhatAddresses === undefined) {
        throw new Error('Hardhat addresses not configured');
      }
      return hardhatAddresses;
    }
    case 7082400: { // COTI Testnet
      const cotiTestnetAddresses = OMNICOIN_ADDRESSES['coti-testnet'];
      if (cotiTestnetAddresses === undefined) {
        throw new Error('COTI testnet addresses not configured');
      }
      return cotiTestnetAddresses;
    }
    default:
      throw new Error(`OmniCoin contracts not deployed on chain ${chainId}`);
  }
}

/**
 * Contract ABIs (imported from Coin module artifacts)
 * In production, these should be imported from the compiled artifacts
 */
export const OMNICOIN_ABIS = {
  OmniCoin: [
    // ERC20 Standard
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',

    // OmniCoin specific
    'function mint(address to, uint256 amount) returns (bool)',
    'function burn(uint256 amount) returns (bool)',
    'function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) returns (bool)',
    'function pause() returns (bool)',
    'function unpause() returns (bool)',
    'function paused() view returns (bool)',

    // Events
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)',
    'event BatchTransfer(address indexed from, address[] recipients, uint256[] amounts)',
  ],

  // Add other contract ABIs as needed
  OmniCore: [
    'function submitMerkleRoot(bytes32 merkleRoot) returns (bool)',
    'function getMerkleRoot() view returns (bytes32)',
    'function verifyMerkleProof(bytes32[] calldata proof, bytes32 leaf) view returns (bool)',
  ],
};

/**
 * Create an OmniCoin contract instance
 * @param provider Ethers provider or signer instance
 * @returns OmniCoin contract instance
 */
export function createOmniCoinContract(
  provider: ethers.Provider | ethers.Signer
): ethers.Contract {
  // Get the actual provider (if signer passed, get its provider)
  const actualProvider = 'provider' in provider && provider.provider !== null
    ? provider.provider
    : provider as ethers.Provider;

  const address = getOmniCoinAddress(actualProvider);

  return new ethers.Contract(
    address,
    OMNICOIN_ABIS.OmniCoin,
    provider
  );
}

/**
 * Helper to check if we're on a supported network
 * @param provider Ethers provider instance
 * @returns True if network is supported
 */
export async function isSupportedNetwork(provider: ethers.Provider): Promise<boolean> {
  try {
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    return chainId === 31337 || // Hardhat
           chainId === 1337 ||  // Hardhat alternative
           chainId === 7082400; // COTI Testnet
  } catch {
    return false;
  }
}

/**
 * Export for backward compatibility
 */
export default {
  addresses: OMNICOIN_ADDRESSES,
  metadata: OMNICOIN_METADATA,
  abis: OMNICOIN_ABIS,
  getOmniCoinAddress,
  getOmniCoinContracts,
  createOmniCoinContract,
  isSupportedNetwork,
};