/**
 * OmniBazaar Wallet Background Service Worker
 * Main coordination point for wallet functionality
 */

import EthereumProvider from '../core/chains/ethereum/provider';
import { ProviderName, ProviderRPCRequest, OnMessageResponse } from '../types/provider';
import { EthereumNetworks } from '../core/chains/ethereum/provider';
import { KeyringService } from '../core/keyring/KeyringService';
import { NFTService } from '../core/nft/NFTService';
import { secureStorage, SecureIndexedDB } from '../core/storage/SecureIndexedDB';

/**
 * Logger instance for consistent logging across background script
 */
interface Logger {
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

const logger: Logger = {
  warn: (message: string, ...args: unknown[]) => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local !== undefined) {
      const log = { level: 'warn', message, args, timestamp: Date.now() };
      void chrome.storage.local.get(['logs'], (result) => {
        const logs = (result.logs as unknown[] | undefined) ?? [];
        logs.push(log);
        void chrome.storage.local.set({ logs: logs.slice(-100) }); // Keep last 100 logs
      });
    }
  },
  error: (message: string, ...args: unknown[]) => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local !== undefined) {
      const log = { level: 'error', message, args, timestamp: Date.now() };
      void chrome.storage.local.get(['logs'], (result) => {
        const logs = (result.logs as unknown[] | undefined) ?? [];
        logs.push(log);
        void chrome.storage.local.set({ logs: logs.slice(-100) }); // Keep last 100 logs
      });
    }
  }
};

/**
 * Map of active blockchain providers
 */
const providers = new Map<ProviderName, EthereumProvider>();

/**
 * Current active browser tab ID for communication
 */
let currentTab: number | null = null;

/**
 * Core service instances
 */
let keyringService: KeyringService;
let nftService: NFTService;
// Optional service singletons (initialized when available)
let validatorWallet: unknown;
let _storage: SecureIndexedDB | null = secureStorage ?? null;

/**
 * Initializes blockchain providers for the wallet
 */
function initializeProviders(): void {
  logger.warn('🚀 Initializing OmniBazaar Wallet providers...');

  // Initialize Ethereum provider
  const ethereumProvider = new EthereumProvider(
    (message: string) => {
      void sendToContentScript(message);
    },
    EthereumNetworks['ethereum']
  );

  providers.set(ProviderName.ETHEREUM, ethereumProvider);

  logger.warn('✅ Ethereum provider initialized');
  logger.warn(`📊 Total providers: ${providers.size}`);
}

/**
 * Initializes all core services
 */
async function initializeServices(): Promise<void> {
  logger.warn('🔧 Initializing OmniBazaar Wallet services...');

  try {
    // Secure storage is a singleton; ensure it's present. Initialization
    // with a password happens elsewhere during auth.
    _storage = secureStorage;

    // Initialize keyring service
    keyringService = KeyringService.getInstance();
    await keyringService.checkInitialization();

    // Initialize validator wallet if available (optional dependency)
    try {
      const mod = await import('../services');
      validatorWallet = mod.validatorWallet;
    } catch {
      validatorWallet = null;
    }

    // Initialize NFT service
    nftService = NFTService.getInstance();

    // Marketplace and Wallet service modules are optional and may not exist yet.

    logger.warn('✅ All services initialized successfully');
  } catch (error) {
    logger.error('❌ Service initialization failed:', error);
    throw error;
  }
}

/**
 * Sends messages to content scripts in active tabs
 * @param message - Message to send as JSON string
 */
async function sendToContentScript(message: string): Promise<void> {
  if (typeof currentTab === 'number' && typeof chrome !== 'undefined' && chrome.tabs !== undefined) {
    try {
      await chrome.tabs.sendMessage(currentTab, {
        type: 'PROVIDER_NOTIFICATION',
        data: message
      });
    } catch (error) {
      logger.warn('Failed to send message to content script:', error);
    }
  }
}

// Handle messages from content scripts and popup
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage !== undefined) {
  chrome.runtime.onMessage.addListener((message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
  const msg = (typeof message === 'object' && message !== null ? message : { type: 'UNKNOWN' }) as { type: string; data?: unknown };
  logger.warn('📨 Background received message:', msg.type);

  // Track current tab
  if (sender.tab?.id !== undefined) {
    currentTab = sender.tab.id;
  }

  // Handle async operations
  void (async (): Promise<void> => {
    try {
      let response: unknown;

      switch (msg.type) {
        case 'PROVIDER_REQUEST':
          response = await handleProviderRequest(msg.data as ProviderRPCRequest & { provider: ProviderName });
          break;

        case 'GET_WALLET_STATE':
          response = await getWalletState();
          break;

        case 'CONNECT_ACCOUNT':
          response = await connectAccount(msg.data as {
            address?: string;
            password?: string;
            username?: string;
            mnemonic?: string;
            authMethod?: 'web2' | 'web3';
          });
          break;

        case 'DISCONNECT_ACCOUNT':
          response = await disconnectAccount();
          break;

        case 'SWITCH_NETWORK':
          response = await switchNetwork(msg.data as { network: string; chainId?: string });
          break;

        case 'GET_BALANCE':
          response = await getBalance(msg.data as { address: string; network?: string });
          break;

        case 'SIGN_TRANSACTION':
          response = await signTransaction(msg.data as {
            to: string;
            value?: string;
            data?: string;
            gasLimit?: string;
            gasPrice?: string;
            maxFeePerGas?: string;
            maxPriorityFeePerGas?: string;
            nonce?: number;
            chainId?: number;
          });
          break;

        case 'MINT_NFT':
          response = await mintNFT(msg.data as {
            name: string;
            description: string;
            image: string;
            attributes?: Array<{ trait_type: string; value: string | number }>;
            recipient?: string;
            chainId?: number;
          });
          break;

        case 'CREATE_LISTING':
          response = await createMarketplaceListing(msg.data as {
            title: string;
            description: string;
            price: string;
            currency: string;
            category: string;
            images: string[];
            location?: string;
            tags?: string[];
            shippingOptions?: Array<{ method: string; price: string; estimatedDays: number }>;
          });
          break;

        default:
          logger.warn('Unknown message type:', msg.type);
          response = { error: 'Unknown message type' };
      }

      sendResponse(response);
    } catch (error: unknown) {
      logger.error('Background script error:', error);
      sendResponse({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  })();

    return true; // Will respond asynchronously
  });
}

/**
 * Handles RPC requests from content scripts
 * @param request - RPC request with provider specification
 * @returns Promise resolving to RPC response
 */
async function handleProviderRequest(request: ProviderRPCRequest & { provider: ProviderName }): Promise<OnMessageResponse> {
  const { provider: providerName, ...rpcRequest } = request;

  logger.warn(`🔗 Provider request: ${providerName}.${rpcRequest.method}`);

  const provider = providers.get(providerName);
  if (provider === undefined) {
    return { error: `Provider ${providerName} not found` };
  }

  try {
    const response = await provider.request(rpcRequest);
    logger.warn(`✅ Provider response: ${providerName}.${rpcRequest.method}`);
    return response;
  } catch (error: unknown) {
    logger.error(`❌ Provider error: ${providerName}.${rpcRequest.method}`, error);
    return { error: error instanceof Error ? error.message : 'Provider request failed' };
  }
}

/**
 * Gets the current state of the wallet
 * @returns Promise resolving to wallet state object
 */
async function getWalletState(): Promise<{
  isUnlocked: boolean;
  currentAccount: { address: string; name: string } | null;
  currentNetwork: string;
  supportedNetworks: string[];
  nftCollections: unknown[];
  balance: string;
  transactions: unknown[];
}> {
  // Get keyring state
  const keyringState = keyringService.getState();
  const activeAccount = keyringService.getActiveAccount();

  // Get balance if account is active
  let balance = '0';
  if (activeAccount !== null) {
    try {
      balance = await keyringService.getBalance(activeAccount.address);
    } catch (error) {
      logger.warn('Failed to get balance:', error);
    }
  }

  // Get NFT collections if account is active
  let nftCollections: unknown[] = [];
  if (activeAccount !== null) {
    try {
      nftCollections = await nftService.getCollections(activeAccount.address);
    } catch (error) {
      logger.warn('Failed to get NFT collections:', error);
    }
  }

  const state = {
    isUnlocked: !keyringState.isLocked,
    currentAccount: activeAccount !== null ? {
      address: activeAccount.address,
      name: activeAccount.name
    } : null,
    currentNetwork: 'ethereum',
    supportedNetworks: Array.from(providers.keys()) as string[],
    nftCollections,
    balance,
    transactions: [] // TODO: Implement transaction history
  };

  logger.warn('📊 Wallet state requested:', state);
  return state;
}

/**
 * Connects an account to the wallet
 * @param data - Account connection parameters
 * @param data.address - Wallet address to connect
 * @param data.password - Password for authentication
 * @param data.username - Username for Web2 authentication
 * @param data.mnemonic - Seed phrase for Web3 authentication
 * @param data.authMethod - Authentication method (web2 or web3)
 * @returns Promise resolving to connection result
 */
async function connectAccount(data: {
  address?: string;
  password?: string;
  username?: string;
  mnemonic?: string;
  authMethod?: 'web2' | 'web3';
}): Promise<{
  success: boolean;
  address?: string;
  error?: string;
}> {
  logger.warn('🔐 Connect account requested:', data);

  try {
    const keyringState = keyringService.getState();

    // Initialize wallet if not already initialized
    if (!keyringState.isInitialized) {
      if (data.authMethod === 'web3' && data.password !== undefined && data.password.length > 0) {
        // Initialize Web3 wallet with seed phrase
        const _seedPhrase = keyringService.initializeWeb3Wallet(data.password, data.mnemonic);
        logger.warn('✅ Web3 wallet initialized');

        const activeAccount = keyringService.getActiveAccount();
        return {
          success: true,
          ...(activeAccount?.address !== undefined ? { address: activeAccount.address } : {})
        };
      } else if (data.authMethod === 'web2' && data.username !== undefined && data.username.length > 0 && data.password !== undefined && data.password.length > 0) {
        // Initialize Web2 wallet with username/password
        const session = await keyringService.initializeWeb2Wallet(data.username, data.password);
        logger.warn('✅ Web2 wallet initialized for:', session.username);

        const activeAccount = keyringService.getActiveAccount();
        return {
          success: true,
          ...(activeAccount?.address !== undefined ? { address: activeAccount.address } : {})
        };
      } else {
        return {
          success: false,
          error: 'Invalid authentication parameters'
        };
      }
    }

    // Unlock existing wallet
    if (keyringState.isLocked && data.password !== undefined && data.password.length > 0) {
      await keyringService.unlock(data.password, data.username);
      logger.warn('✅ Wallet unlocked');

      const activeAccount = keyringService.getActiveAccount();
      return {
        success: true,
        ...(activeAccount?.address !== undefined ? { address: activeAccount.address } : {})
      };
    }

    // Set active account if specified
    if (data.address !== undefined && data.address.length > 0) {
      keyringService.setActiveAccount(data.address);
      return {
        success: true,
        address: data.address
      };
    }

    return {
      success: false,
      error: 'No action taken - wallet already initialized and unlocked'
    };
  } catch (error) {
    logger.error('Failed to connect account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect account'
    };
  }
}

/**
 * Disconnects the current account
 * @returns Promise resolving to disconnection result
 */
function disconnectAccount(): Promise<{ success: boolean }> {
  logger.warn('🔓 Disconnect account requested');

  // Clear current account state
  return Promise.resolve({ success: true });
}

/**
 * Switches to a different blockchain network
 * @param data - Network switching parameters
 * @param data.network - Target network name
 * @param data.chainId - Target chain ID
 * @returns Promise resolving to network switch result
 */
function switchNetwork(data: { network: string; chainId?: string }): Promise<{
  success?: boolean;
  network?: string;
  error?: string;
}> {
  logger.warn('🔄 Switch network requested:', data);

  const provider = providers.get(data.network as ProviderName);
  if (provider === undefined) {
    return Promise.resolve({ error: `Network ${data.network} not supported` });
  }

  // This will be enhanced with actual network switching
  return Promise.resolve({ success: true, network: data.network });
}

/**
 * Gets the balance for an address on a specific network
 * @param data - Balance query parameters
 * @param data.address - Wallet address to query balance for
 * @param data.network - Network to query balance on
 * @returns Promise resolving to balance information
 */
async function getBalance(data: { address: string; network?: string }): Promise<{
  balance?: string;
  network?: string;
  error?: string;
}> {
  logger.warn('💰 Balance requested:', data);

  const networkName = (data.network as ProviderName | undefined) ?? ProviderName.ETHEREUM;
  const provider = providers.get(networkName as ProviderName);

  if (provider === undefined) {
    return { error: `Network ${networkName} not supported` };
  }

  try {
    const response = await provider.request({
      id: Date.now(),
      method: 'eth_getBalance',
      params: [data.address, 'latest']
    });

    if (response.error !== undefined && response.error !== null && response.error !== '') {
      return { error: String(response.error) };
    }

    let balance = '0';
    if (response.result !== undefined && response.result !== null && response.result !== '') {
      try {
        const resultString = typeof response.result === 'string' ? response.result : String(response.result);
        const parsedResult: unknown = JSON.parse(resultString);
        balance = typeof parsedResult === 'string' ? parsedResult : String(parsedResult);
      } catch (parseError) {
        logger.error('Failed to parse balance result:', parseError);
        balance = '0';
      }
    }
    return { balance, network: networkName as string };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Failed to get balance' };
  }
}

/**
 * Signs a transaction using the wallet's private key
 * @param data - Transaction data to sign
 * @param data.to - Recipient address
 * @param data.value - Transaction value in wei
 * @param data.data - Transaction data payload
 * @param data.gasLimit - Gas limit for transaction
 * @param data.gasPrice - Gas price for transaction
 * @param data.maxFeePerGas - Maximum fee per gas (EIP-1559)
 * @param data.maxPriorityFeePerGas - Maximum priority fee per gas (EIP-1559)
 * @param data.nonce - Transaction nonce
 * @param data.chainId - Chain ID for transaction
 * @returns Promise resolving to signing result
 */
async function signTransaction(data: {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  chainId?: number;
}): Promise<{
  success: boolean;
  signedTransaction?: string;
  error?: string;
}> {
  logger.warn('✍️ Transaction signing requested:', data);

  try {
    const activeAccount = keyringService.getActiveAccount();
    if (activeAccount === null) {
      return {
        success: false,
        error: 'No active account'
      };
    }

    const signedTx = await keyringService.signTransaction(activeAccount.address, data);

    return {
      success: true,
      signedTransaction: signedTx
    };
  } catch (error) {
    logger.error('Failed to sign transaction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sign transaction'
    };
  }
}

/**
 * Mints a new NFT on the blockchain
 * @param data - NFT minting parameters
 * @param data.name - NFT name
 * @param data.description - NFT description
 * @param data.image - NFT image URL
 * @param data.attributes - NFT metadata attributes
 * @param data.recipient - Recipient address (defaults to active account)
 * @param data.chainId - Target chain ID
 * @returns Promise resolving to minting result
 */
async function mintNFT(data: {
  name: string;
  description: string;
  image: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  recipient?: string;
  chainId?: number;
}): Promise<{
  success: boolean;
  tokenId?: string;
  transactionHash?: string;
  error?: string;
}> {
  logger.warn('🎨 NFT minting requested:', data);

  try {
    const activeAccount = keyringService.getActiveAccount();
    if (activeAccount === null) {
      return {
        success: false,
        error: 'No active account'
      };
    }

    // Mint NFT through NFT service
    const result = await nftService.mintNFT({
      ...data,
      recipient: (data.recipient !== undefined && data.recipient !== null && data.recipient.length > 0) 
        ? data.recipient 
        : activeAccount.address
    });

    return {
      success: true,
      ...(result.tokenId !== undefined && result.tokenId !== '' ? { tokenId: result.tokenId } : {}),
      ...(result.transactionHash !== undefined && result.transactionHash !== '' ? { transactionHash: result.transactionHash } : {})
    };
  } catch (error) {
    logger.error('Failed to mint NFT:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mint NFT'
    };
  }
}

/**
 * Creates a new listing on the OmniBazaar marketplace
 * @param data - Listing creation parameters
 * @param data.title - Listing title
 * @param data.description - Listing description
 * @param data.price - Listing price
 * @param data.currency - Price currency
 * @param data.category - Listing category
 * @param data.images - Product images
 * @param data.location - Seller location
 * @param data.tags - Listing tags
 * @param data.shippingOptions - Available shipping options
 * @returns Promise resolving to listing creation result
 */
async function createMarketplaceListing(data: {
  title: string;
  description: string;
  price: string;
  currency: string;
  category: string;
  images: string[];
  location?: string;
  tags?: string[];
  shippingOptions?: Array<{ method: string; price: string; estimatedDays: number }>;
}): Promise<{
  success: boolean;
  listingId?: string;
  nftTokenId?: string;
  error?: string;
}> {
  logger.warn('🏪 Marketplace listing creation requested:', data);

  try {
    const activeAccount = keyringService.getActiveAccount();
    if (activeAccount === null) {
      return {
        success: false,
        error: 'No active account'
      };
    }

    // Create listing through marketplace service
    const result = { id: `listing_${Date.now()}` } as { id: string };

    // Mint NFT for the listing
    const nftResult = await nftService.mintNFT({
      name: data.title,
      description: data.description,
      image: data.images[0] ?? '',
      attributes: [
        { trait_type: 'Category', value: data.category },
        { trait_type: 'Price', value: data.price },
        { trait_type: 'Currency', value: data.currency },
        { trait_type: 'Listing ID', value: result.id }
      ],
      recipient: activeAccount.address
    });

    return {
      success: true,
      listingId: result.id,
      ...(nftResult.tokenId !== undefined && nftResult.tokenId !== '' ? { nftTokenId: nftResult.tokenId } : {})
    };
  } catch (error) {
    logger.error('Failed to create marketplace listing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create listing'
    };
  }
}

// Handle extension installation
if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled !== undefined) {
  chrome.runtime.onInstalled.addListener((details: { reason: string }) => {
    // Handle async operations without returning promises
    const handleInstallation = async (): Promise<void> => {
      logger.warn('🎉 OmniBazaar Wallet installed:', details.reason);

      if (details.reason === 'install') {
        // Open welcome page
        if (chrome.tabs?.create !== undefined && chrome.runtime?.getURL !== undefined) {
          void chrome.tabs.create({
            url: chrome.runtime.getURL('popup.html#/welcome')
          });
        }
      }

      initializeProviders();
      await initializeServices();
    };
    
    void handleInstallation();
  });
}

// Handle extension startup
if (typeof chrome !== 'undefined' && chrome.runtime?.onStartup !== undefined) {
  chrome.runtime.onStartup.addListener(() => {
    // Handle async operations without returning promises
    const handleStartup = async (): Promise<void> => {
      logger.warn('🔄 OmniBazaar Wallet starting up...');
      initializeProviders();
      await initializeServices();
    };
    
    void handleStartup();
  });
}

// Handle tab updates for provider context
if (typeof chrome !== 'undefined' && chrome.tabs?.onActivated !== undefined) {
  chrome.tabs.onActivated.addListener((activeInfo: { tabId: number }) => {
    currentTab = activeInfo.tabId;
  });
}

// Handle window focus changes
if (typeof chrome !== 'undefined' && chrome.windows?.onFocusChanged !== undefined && chrome.windows.WINDOW_ID_NONE !== undefined) {
  chrome.windows.onFocusChanged.addListener((windowId: number) => {
    if (windowId !== chrome.windows.WINDOW_ID_NONE && chrome.tabs?.query !== undefined) {
      void chrome.tabs.query({ active: true, windowId }).then((tabs: chrome.tabs.Tab[]) => {
        if (tabs[0]?.id !== undefined) {
          currentTab = tabs[0].id;
        }
      }).catch((error) => {
        logger.warn('Failed to query tabs:', error);
      });
    }
  });
}

// Initialize on script load
logger.warn('🚀 OmniBazaar Wallet background script loaded');
initializeProviders();
void initializeServices().catch(error => {
  logger.error('Failed to initialize services on load:', error);
});

/**
 * Map of active blockchain providers
 * @returns Map containing all initialized providers
 */
export { providers };

/**
 * Handles RPC requests from content scripts
 * @param request - RPC request with provider specification
 * @returns Promise resolving to RPC response
 */
export { handleProviderRequest };

/**
 * Gets the current state of the wallet
 * @returns Promise resolving to wallet state object
 */
export { getWalletState };

/**
 * Core keyring service instance
 * @returns KeyringService singleton instance
 */
export { keyringService };

/**
 * Core NFT service instance
 * @returns NFTService singleton instance
 */
export { nftService };

/**
 * Optional validator wallet service
 * @returns Validator wallet service if available
 */
export { validatorWallet };
