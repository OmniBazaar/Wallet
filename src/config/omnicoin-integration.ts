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
  rpcUrl: string;
  OmniCoin: string;
  OmniCore: string;
  OmniGovernance: string;
  OmniBridge: string;
  PrivateOmniCoin: string;
  MinimalEscrow: string;
  LegacyBalanceClaim: string;
}

export const OMNICOIN_ADDRESSES: Record<string, ContractAddresses> = {
  // Local Hardhat network (chainId: 31337)
  // ⚠️  CRITICAL: These addresses MUST match Coin/deployments/localhost.json
  // Last deployed: 2025-10-22T12:42:57.224Z
  hardhat: {
    rpcUrl: 'http://127.0.0.1:9650/ext/bc/2FYUT2FZenR4bUZUGjVaucXmQgqmDnKmrioLNdPEn7RqPwunMw/rpc',
    OmniCoin: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
    OmniCore: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
    OmniGovernance: '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0',
    OmniBridge: '0x0000000000000000000000000000000000000000', // Not yet deployed
    PrivateOmniCoin: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
    MinimalEscrow: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
    LegacyBalanceClaim: '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE',
  },

  // OmniCoin Fuji Testnet Subnet-EVM (chainId: 131313)
  fuji: {
    rpcUrl: 'http://127.0.0.1:9650/ext/bc/2FYUT2FZenR4bUZUGjVaucXmQgqmDnKmrioLNdPEn7RqPwunMw/rpc',
    OmniCoin: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
    OmniCore: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
    OmniGovernance: '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0',
    OmniBridge: '0x0000000000000000000000000000000000000000',
    PrivateOmniCoin: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
    MinimalEscrow: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
    LegacyBalanceClaim: '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE',
  },

  // COTI Testnet (chainId: 7082400)
  'coti-testnet': {
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    OmniCoin: '0x0000000000000000000000000000000000000000', // To be deployed
    OmniCore: '0x0000000000000000000000000000000000000000',
    OmniGovernance: '0x0000000000000000000000000000000000000000',
    OmniBridge: '0x0000000000000000000000000000000000000000',
    PrivateOmniCoin: '0x0000000000000000000000000000000000000000',
    MinimalEscrow: '0x0000000000000000000000000000000000000000',
    LegacyBalanceClaim: '0x0000000000000000000000000000000000000000',
  },

  // Avalanche Mainnet Subnet-EVM (Production)
  // ⚠️  PLACEHOLDER: Update when deploying to mainnet
  // Will be synchronized from Coin/deployments/mainnet.json
  mainnet: {
    rpcUrl: 'https://mainnet-rpc.omnibazaar.com', // To be updated with actual RPC
    OmniCoin: '0x0000000000000000000000000000000000000000', // To be deployed
    OmniCore: '0x0000000000000000000000000000000000000000', // To be deployed
    OmniGovernance: '0x0000000000000000000000000000000000000000', // To be deployed
    OmniBridge: '0x0000000000000000000000000000000000000000', // To be deployed
    PrivateOmniCoin: '0x0000000000000000000000000000000000000000', // To be deployed
    MinimalEscrow: '0x0000000000000000000000000000000000000000', // To be deployed
    LegacyBalanceClaim: '0x0000000000000000000000000000000000000000', // To be deployed
  },

  // COTI Mainnet (Privacy Layer - Future Integration)
  // ⚠️  PLACEHOLDER: Update when COTI integration is ready
  // Will be synchronized from Coin/deployments/coti-mainnet.json
  'coti-mainnet': {
    rpcUrl: 'https://mainnet.coti.io', // COTI mainnet RPC
    OmniCoin: '0x0000000000000000000000000000000000000000', // To be deployed
    OmniCore: '0x0000000000000000000000000000000000000000', // To be deployed
    OmniGovernance: '0x0000000000000000000000000000000000000000', // To be deployed
    OmniBridge: '0x0000000000000000000000000000000000000000', // Cross-chain bridge
    PrivateOmniCoin: '0x0000000000000000000000000000000000000000', // Privacy token (primary)
    MinimalEscrow: '0x0000000000000000000000000000000000000000', // To be deployed
    LegacyBalanceClaim: '0x0000000000000000000000000000000000000000', // Not applicable
  },
} as const;;

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
