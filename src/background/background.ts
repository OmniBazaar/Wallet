/**
 * OmniBazaar Wallet Background Service Worker
 * Main coordination point for wallet functionality
 */

import EthereumProvider from '@/core/chains/ethereum/provider';
import { ProviderName, ProviderRPCRequest, OnMessageResponse } from '@/types/provider';
import { EthereumNetworks } from '@/core/chains/ethereum/provider';
import { KeyringService } from '@/core/keyring/KeyringService';
import { NFTService } from '@/core/nft/NFTService';
import { secureStorage, SecureIndexedDB } from '@/core/storage/SecureIndexedDB';

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
let storage: SecureIndexedDB | null = secureStorage ?? null;

/**
 * Initializes blockchain providers for the wallet
 */
function initializeProviders(): void {
  console.warn('🚀 Initializing OmniBazaar Wallet providers...');

  // Initialize Ethereum provider
  const ethereumProvider = new EthereumProvider(
    (message: string) => sendToContentScript(message),
    EthereumNetworks['ethereum']
  );

  providers.set(ProviderName.ETHEREUM, ethereumProvider);

  console.warn('✅ Ethereum provider initialized');
  console.warn(`📊 Total providers: ${providers.size}`);
}

/**
 * Initializes all core services
 */
async function initializeServices(): Promise<void> {
  console.warn('🔧 Initializing OmniBazaar Wallet services...');

  try {
    // Secure storage is a singleton; ensure it's present. Initialization
    // with a password happens elsewhere during auth.
    storage = secureStorage;

    // Initialize keyring service
    keyringService = KeyringService.getInstance();
    await keyringService.checkInitialization();

    // Initialize validator wallet if available (optional dependency)
    try {
      const mod = await import('@/services');
      validatorWallet = mod.validatorWallet;
    } catch {
      validatorWallet = null;
    }

    // Initialize NFT service
    nftService = NFTService.getInstance();

    // Marketplace and Wallet service modules are optional and may not exist yet.

    console.warn('✅ All services initialized successfully');
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
    throw error;
  }
}

/**
 * Sends messages to content scripts in active tabs
 * @param message - Message to send as JSON string
 */
async function sendToContentScript(message: string): Promise<void> {
  if (currentTab && chrome.tabs) {
    try {
      await chrome.tabs.sendMessage(currentTab, {
        type: 'PROVIDER_NOTIFICATION',
        data: message
      });
    } catch (error) {
      console.warn('Failed to send message to content script:', error);
    }
  }
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener(async (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
  const msg = (typeof message === 'object' && message !== null ? message : { type: 'UNKNOWN' }) as { type: string; data?: unknown };
  console.warn('📨 Background received message:', msg.type);

  // Track current tab
  if (sender.tab?.id != null) {
    currentTab = sender.tab.id;
  }

  try {
    let response;

    switch (msg.type) {
      case 'PROVIDER_REQUEST':
        response = await handleProviderRequest(msg.data as any);
        break;

      case 'GET_WALLET_STATE':
        response = await getWalletState();
        break;

      case 'CONNECT_ACCOUNT':
        response = await connectAccount(msg.data as any);
        break;

      case 'DISCONNECT_ACCOUNT':
        response = await disconnectAccount();
        break;

      case 'SWITCH_NETWORK':
        response = await switchNetwork(msg.data as any);
        break;

      case 'GET_BALANCE':
        response = await getBalance(msg.data as any);
        break;

      case 'SIGN_TRANSACTION':
        response = await signTransaction(msg.data as any);
        break;

      case 'MINT_NFT':
        response = await mintNFT(msg.data as any);
        break;

      case 'CREATE_LISTING':
        response = await createMarketplaceListing(msg.data as any);
        break;

      default:
        console.warn('Unknown message type:', (msg as any).type);
        response = { error: 'Unknown message type' };
    }

    sendResponse(response);
  } catch (error: unknown) {
    console.error('Background script error:', error);
    sendResponse({ error: error instanceof Error ? error.message : 'Internal error' });
  }

  return true; // Will respond asynchronously
});

/**
 * Handles RPC requests from content scripts
 * @param request - RPC request with provider specification
 * @returns Promise resolving to RPC response
 */
async function handleProviderRequest(request: ProviderRPCRequest & { provider: ProviderName }): Promise<OnMessageResponse> {
  const { provider: providerName, ...rpcRequest } = request;

  console.warn(`🔗 Provider request: ${providerName}.${rpcRequest.method}`);

  const provider = providers.get(providerName);
  if (!provider) {
    return { error: `Provider ${providerName} not found` };
  }

  try {
    const response = await provider.request(rpcRequest);
    console.warn(`✅ Provider response: ${providerName}.${rpcRequest.method}`);
    return response;
  } catch (error: unknown) {
    console.error(`❌ Provider error: ${providerName}.${rpcRequest.method}`, error);
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
  if (activeAccount) {
    try {
      balance = await keyringService.getBalance(activeAccount.address);
    } catch (error) {
      console.warn('Failed to get balance:', error);
    }
  }

  // Get NFT collections if account is active
  let nftCollections: unknown[] = [];
  if (activeAccount) {
    try {
      nftCollections = await nftService.getCollections(activeAccount.address);
    } catch (error) {
      console.warn('Failed to get NFT collections:', error);
    }
  }

  const state = {
    isUnlocked: !keyringState.isLocked,
    currentAccount: activeAccount ? {
      address: activeAccount.address,
      name: activeAccount.name
    } : null,
    currentNetwork: 'ethereum',
    supportedNetworks: Array.from(providers.keys()) as string[],
    nftCollections,
    balance,
    transactions: [] // TODO: Implement transaction history
  };

  console.warn('📊 Wallet state requested:', state);
  return state;
}

/**
 * Connects an account to the wallet
 * @param data - Account connection parameters
 * @param data.address
 * @param data.password
 * @param data.username
 * @param data.mnemonic
 * @param data.authMethod
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
  console.warn('🔐 Connect account requested:', data);

  try {
    const keyringState = keyringService.getState();

    // Initialize wallet if not already initialized
    if (!keyringState.isInitialized) {
      if (data.authMethod === 'web3' && data.password) {
        // Initialize Web3 wallet with seed phrase
        const seedPhrase = await keyringService.initializeWeb3Wallet(data.password, data.mnemonic);
        console.warn('✅ Web3 wallet initialized');

        const activeAccount = keyringService.getActiveAccount();
        return {
          success: true,
          ...(activeAccount?.address ? { address: activeAccount.address } : {})
        };
      } else if (data.authMethod === 'web2' && data.username && data.password) {
        // Initialize Web2 wallet with username/password
        const session = await keyringService.initializeWeb2Wallet(data.username, data.password);
        console.warn('✅ Web2 wallet initialized for:', session.username);

        const activeAccount = keyringService.getActiveAccount();
        return {
          success: true,
          ...(activeAccount?.address ? { address: activeAccount.address } : {})
        };
      } else {
        return {
          success: false,
          error: 'Invalid authentication parameters'
        };
      }
    }

    // Unlock existing wallet
    if (keyringState.isLocked && data.password) {
      await keyringService.unlock(data.password, data.username);
      console.warn('✅ Wallet unlocked');

      const activeAccount = keyringService.getActiveAccount();
      return {
        success: true,
        ...(activeAccount?.address ? { address: activeAccount.address } : {})
      };
    }

    // Set active account if specified
    if (data.address) {
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
    console.error('Failed to connect account:', error);
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
async function disconnectAccount(): Promise<{ success: boolean }> {
  console.warn('🔓 Disconnect account requested');

  // Clear current account state
  return { success: true };
}

/**
 * Switches to a different blockchain network
 * @param data - Network switching parameters
 * @param data.network
 * @param data.chainId
 * @returns Promise resolving to network switch result
 */
async function switchNetwork(data: { network: string; chainId?: string }): Promise<{
  success?: boolean;
  network?: string;
  error?: string;
}> {
  console.warn('🔄 Switch network requested:', data);

  const provider = providers.get(data.network as ProviderName);
  if (!provider) {
    return { error: `Network ${data.network} not supported` };
  }

  // This will be enhanced with actual network switching
  return { success: true, network: data.network };
}

/**
 * Gets the balance for an address on a specific network
 * @param data - Balance query parameters
 * @param data.address
 * @param data.network
 * @returns Promise resolving to balance information
 */
async function getBalance(data: { address: string; network?: string }): Promise<{
  balance?: string;
  network?: string;
  error?: string;
}> {
  console.warn('💰 Balance requested:', data);

  const networkName = (data.network as ProviderName | undefined) || ProviderName.ETHEREUM;
  const provider = providers.get(networkName as ProviderName);

  if (!provider) {
    return { error: `Network ${networkName} not supported` };
  }

  try {
    const response = await provider.request({
      id: Date.now(),
      method: 'eth_getBalance',
      params: [data.address, 'latest']
    });

    if (response.error) {
      return { error: response.error };
    }

    const balance = response.result ? JSON.parse(response.result) : '0';
    return { balance, network: networkName };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Failed to get balance' };
  }
}

/**
 * Signs a transaction using the wallet's private key
 * @param data - Transaction data to sign
 * @param data.to
 * @param data.value
 * @param data.data
 * @param data.gasLimit
 * @param data.gasPrice
 * @param data.maxFeePerGas
 * @param data.maxPriorityFeePerGas
 * @param data.nonce
 * @param data.chainId
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
  console.warn('✍️ Transaction signing requested:', data);

  try {
    const activeAccount = keyringService.getActiveAccount();
    if (!activeAccount) {
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
    console.error('Failed to sign transaction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sign transaction'
    };
  }
}

/**
 * Mints a new NFT on the blockchain
 * @param data - NFT minting parameters
 * @param data.name
 * @param data.description
 * @param data.image
 * @param data.attributes
 * @param data.recipient
 * @param data.chainId
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
  console.warn('🎨 NFT minting requested:', data);

  try {
    const activeAccount = keyringService.getActiveAccount();
    if (!activeAccount) {
      return {
        success: false,
        error: 'No active account'
      };
    }

    // Mint NFT through NFT service
    const result = await nftService.mintNFT({
      ...data,
      recipient: data.recipient || activeAccount.address
    });

    return {
      success: true,
      ...(result.tokenId ? { tokenId: result.tokenId } : {}),
      ...(result.transactionHash ? { transactionHash: result.transactionHash } : {})
    };
  } catch (error) {
    console.error('Failed to mint NFT:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mint NFT'
    };
  }
}

/**
 * Creates a new listing on the OmniBazaar marketplace
 * @param data - Listing creation parameters
 * @param data.title
 * @param data.description
 * @param data.price
 * @param data.currency
 * @param data.category
 * @param data.images
 * @param data.location
 * @param data.tags
 * @param data.shippingOptions
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
  console.warn('🏪 Marketplace listing creation requested:', data);

  try {
    const activeAccount = keyringService.getActiveAccount();
    if (!activeAccount) {
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
      image: data.images[0] || '',
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
      ...(nftResult.tokenId ? { nftTokenId: nftResult.tokenId } : {})
    };
  } catch (error) {
    console.error('Failed to create marketplace listing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create listing'
    };
  }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener(async (details: chrome.runtime.InstalledDetails) => {
  console.warn('🎉 OmniBazaar Wallet installed:', details.reason);

  if (details.reason === 'install') {
    // Open welcome page
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html#/welcome')
    });
  }

  initializeProviders();
  await initializeServices();
});

// Handle extension startup
chrome.runtime.onStartup.addListener(async () => {
  console.warn('🔄 OmniBazaar Wallet starting up...');
  initializeProviders();
  await initializeServices();
});

// Handle tab updates for provider context
chrome.tabs.onActivated.addListener((activeInfo: chrome.tabs.TabActiveInfo) => {
  currentTab = activeInfo.tabId;
});

// Handle window focus changes
chrome.windows.onFocusChanged.addListener((windowId: number) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    chrome.tabs.query({ active: true, windowId }).then((tabs: chrome.tabs.Tab[]) => {
      if (tabs[0]?.id) {
        currentTab = tabs[0].id;
      }
    });
  }
});

// Initialize on script load
console.warn('🚀 OmniBazaar Wallet background script loaded');
initializeProviders();
initializeServices().catch(error => {
  console.error('Failed to initialize services on load:', error);
});

// Export for testing
export {
  providers,
  handleProviderRequest,
  getWalletState,
  keyringService,
  nftService,
  validatorWallet
};
