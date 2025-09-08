/**
 * Mock implementation for NFTService
 */

const mockNFTItem = {
  id: 'mock-nft-1',
  tokenId: '1',
  name: 'Mock NFT',
  description: 'A test NFT for development',
  image: 'https://example.com/mock-image.png',
  imageUrl: 'https://example.com/mock-image.png',
  animationUrl: null,
  externalUrl: null,
  attributes: [],
  contract: 'Mock Contract',
  contractAddress: '0x1234567890123456789012345678901234567890',
  tokenStandard: 'ERC721' as const,
  blockchain: 'ethereum',
  owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  creator: undefined,
  royalties: undefined,
  metadata: {},
  isListed: false,
  listingId: undefined,
  price: undefined,
  currency: undefined,
  marketplaceUrl: undefined,
  ipfsHash: undefined,
  metadataUri: undefined
};

const mockWalletNFT = {
  id: 'mock-wallet-nft-1',
  tokenId: '1',
  name: 'Mock Wallet NFT',
  description: 'A test wallet NFT',
  image: 'https://example.com/mock-wallet-image.png',
  contractAddress: '0x1234567890123456789012345678901234567890',
  tokenStandard: 'ERC721',
  blockchain: 'ethereum',
  owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  metadata: {
    name: 'Mock Wallet NFT',
    description: 'A test wallet NFT',
    image: 'https://example.com/mock-wallet-image.png'
  }
};

export class NFTService {
  private static instance: NFTService;

  public static getInstance(): NFTService {
    if (!NFTService.instance) {
      NFTService.instance = new NFTService();
    }
    return NFTService.instance;
  }

  public async getActiveAccountNFTs(): Promise<typeof mockWalletNFT[]> {
    // Return mock data
    return [mockWalletNFT];
  }

  public async getNFTsByContract(contractAddress: string): Promise<typeof mockWalletNFT[]> {
    return [{ ...mockWalletNFT, contractAddress }];
  }

  public async getNFTById(id: string): Promise<typeof mockWalletNFT | null> {
    return { ...mockWalletNFT, id };
  }

  public async transferNFT(
    contractAddress: string,
    tokenId: string,
    toAddress: string
  ): Promise<string> {
    return 'mock-transaction-hash';
  }

  private constructor() {
    // Private constructor for singleton
  }
}