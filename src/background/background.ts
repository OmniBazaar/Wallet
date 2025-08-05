// OmniBazaar Wallet Background Service Worker
// Main coordination point for wallet functionality

import EthereumProvider from '@/core/chains/ethereum/provider';
import { ProviderName, ProviderRPCRequest, OnMessageResponse } from '@/types/provider';
import { EthereumNetworks } from '@/core/chains/ethereum/provider';

// Declare global chrome API
declare const chrome: {
  runtime: {
    onMessage: {
      addListener: (callback: (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => void | boolean) => void;
    };
    onInstalled: {
      addListener: (callback: (details: chrome.runtime.InstalledDetails) => void) => void;
    };
    onStartup: {
      addListener: (callback: () => void) => void;
    };
    getURL: (path: string) => string;
  };
  tabs: {
    sendMessage: (tabId: number, message: unknown) => Promise<void>;
    create: (createProperties: { url: string }) => void;
    query: (queryInfo: { active: boolean; windowId: number }) => Promise<chrome.tabs.Tab[]>;
    onActivated: {
      addListener: (callback: (activeInfo: chrome.tabs.TabActiveInfo) => void) => void;
    };
  };
  windows: {
    onFocusChanged: {
      addListener: (callback: (windowId: number) => void) => void;
    };
    WINDOW_ID_NONE: number;
  };
};

// Background provider instances
const providers = new Map<ProviderName, EthereumProvider>();
let currentTab: number | null = null;

// Initialize providers
function initializeProviders(): void {
  console.warn('🚀 Initializing OmniBazaar Wallet providers...');
  
  // Initialize Ethereum provider
  const ethereumProvider = new EthereumProvider(
    (message: string) => sendToContentScript(message),
    EthereumNetworks.ethereum
  );
  
  providers.set(ProviderName.ethereum, ethereumProvider);
  
  console.warn('✅ Ethereum provider initialized');
  console.warn(`📊 Total providers: ${providers.size}`);
}

// Send message to content script
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
chrome.runtime.onMessage.addListener(async (message: { type: string; data?: unknown }, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
  console.warn('📨 Background received message:', message.type);
  
  // Track current tab
  if (sender.tab?.id) {
    currentTab = sender.tab.id;
  }
  
  try {
    let response;
    
    switch (message.type) {
      case 'PROVIDER_REQUEST':
        response = await handleProviderRequest(message.data);
        break;
        
      case 'GET_WALLET_STATE':
        response = await getWalletState();
        break;
        
      case 'CONNECT_ACCOUNT':
        response = await connectAccount(message.data);
        break;
        
      case 'DISCONNECT_ACCOUNT':
        response = await disconnectAccount();
        break;
        
      case 'SWITCH_NETWORK':
        response = await switchNetwork(message.data);
        break;
        
      case 'GET_BALANCE':
        response = await getBalance(message.data);
        break;
        
      case 'SIGN_TRANSACTION':
        response = await signTransaction(message.data);
        break;
        
      case 'MINT_NFT':
        response = await mintNFT(message.data);
        break;
        
      case 'CREATE_LISTING':
        response = await createMarketplaceListing(message.data);
        break;
        
      default:
        console.warn('Unknown message type:', message.type);
        response = { error: 'Unknown message type' };
    }
    
    sendResponse(response);
  } catch (error: unknown) {
    console.error('Background script error:', error);
    sendResponse({ error: error instanceof Error ? error.message : 'Internal error' });
  }
  
  return true; // Will respond asynchronously
});

// Handle provider RPC requests
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

// Get current wallet state
async function getWalletState(): Promise<{
  isUnlocked: boolean;
  currentAccount: null;
  currentNetwork: string;
  supportedNetworks: string[];
  nftCollections: unknown[];
  balance: string;
  transactions: unknown[];
}> {
  const state = {
    isUnlocked: false, // Will be implemented with keyring
    currentAccount: null,
    currentNetwork: 'ethereum',
    supportedNetworks: Array.from(providers.keys()),
    nftCollections: [],
    balance: '0',
    transactions: []
  };
  
  console.warn('📊 Wallet state requested:', state);
  return state;
}

// Connect account
async function connectAccount(data: { address?: string }): Promise<{
  success: boolean;
  error?: string;
}> {
  console.warn('🔐 Connect account requested:', data);
  
  // This will be implemented with keyring integration
  // For now, return a placeholder
  return {
    success: false,
    error: 'Account management not yet implemented - requires keyring integration'
  };
}

// Disconnect account
async function disconnectAccount(): Promise<{ success: boolean }> {
  console.warn('🔓 Disconnect account requested');
  
  // Clear current account state
  return { success: true };
}

// Switch network
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

// Get balance
async function getBalance(data: { address: string; network?: string }): Promise<{
  balance?: string;
  network?: string;
  error?: string;
}> {
  console.warn('💰 Balance requested:', data);
  
  const networkName = data.network || ProviderName.ethereum;
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

// Sign transaction
async function signTransaction(data: unknown): Promise<{
  success: boolean;
  error?: string;
}> {
  console.warn('✍️ Transaction signing requested:', data);
  
  // This will be implemented with keyring integration
  return {
    success: false,
    error: 'Transaction signing not yet implemented - requires keyring integration'
  };
}

// Mint NFT
async function mintNFT(data: unknown): Promise<{
  success: boolean;
  error?: string;
}> {
  console.warn('🎨 NFT minting requested:', data);
  
  // This will be implemented with NFT integration
  return {
    success: false,
    error: 'NFT minting not yet implemented - requires NFT component integration'
  };
}

// Create marketplace listing
async function createMarketplaceListing(data: unknown): Promise<{
  success: boolean;
  error?: string;
}> {
  console.warn('🏪 Marketplace listing creation requested:', data);
  
  // This will be implemented with marketplace integration
  return {
    success: false,
    error: 'Marketplace listing not yet implemented - requires marketplace integration'
  };
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details: chrome.runtime.InstalledDetails) => {
  console.warn('🎉 OmniBazaar Wallet installed:', details.reason);
  
  if (details.reason === 'install') {
    // Open welcome page
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html#/welcome')
    });
  }
  
  initializeProviders();
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.warn('🔄 OmniBazaar Wallet starting up...');
  initializeProviders();
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

// Export for testing
export { providers, handleProviderRequest, getWalletState }; 