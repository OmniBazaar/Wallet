import { OmniCoinMetadata } from '../blockchain/OmniCoin';

export const SupportedAssets = [
  {
    symbol: OmniCoinMetadata.symbol,
    name: OmniCoinMetadata.name,
    decimals: OmniCoinMetadata.decimals,
    contractAddress: OmniCoinMetadata.contractAddress,
    type: 'ERC20',
    icon: '/assets/omnicoin.svg', // Placeholder path
  },
  // Add other assets here as needed
]; 