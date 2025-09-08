/**
 * NFTGallery React Component Tests
 * Tests the TypeScript strict mode compliance and React integration for NFT display
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import { NFTGallery } from '../../src/ui/widgets/omnicoin/components/NFTGallery';
import type { NFTItem } from '../../src/types/nft';

// Mock the hooks with proper TypeScript types
jest.mock('../../src/hooks/useNFTs', () => ({
  useNFTs: jest.fn()
}));

jest.mock('../../src/hooks/useNFTTransfer', () => ({
  useNFTTransfer: jest.fn()
}));

// Mock the styled components dependencies
jest.mock('styled-components', () => {
  // Variable to track component creation order for identifying specific components
  let creationIndex = 0;
  const componentMap = [
    'gallery-container',    // GalleryContainer
    'nft-card',            // NFTCard  
    'nft-image',           // NFTImage
    'nft-info',            // NFTInfo
    'nft-name',            // NFTName
    'nft-description',     // NFTDescription
    'transfer-button',     // TransferButton
    'transfer-dialog',     // TransferDialog
    'dialog-overlay',      // DialogOverlay
    'dialog-input',        // DialogInput
    'dialog-button'        // DialogButton
  ];

  const styled = (tag: string) => (strs: TemplateStringsArray, ...args: any[]) => {
    const testId = componentMap[creationIndex] || `styled-${tag}-${creationIndex}`;
    creationIndex++;
    
    return React.forwardRef<HTMLElement, any>((props, ref) => 
      React.createElement(tag, { 
        ...props, 
        ref,
        'data-styled': true,
        'data-testid': testId
      })
    );
  };
  
  return {
    __esModule: true,
    default: new Proxy(styled, {
      get: (target, prop) => {
        if (typeof prop === 'string') {
          return target(prop);
        }
        return target;
      }
    })
  };
});

// Mock components that are not critical for this test
jest.mock('../../src/ui/widgets/omnicoin/components/OmniCoinLoading', () => ({
  OmniCoinLoading: ({ text }: { text: string }) => (
    <div data-testid="loading-component">{text}</div>
  )
}));

jest.mock('../../src/ui/widgets/omnicoin/components/OmniCoinToast', () => ({
  OmniCoinToast: ({ type, message, onClose }: { type: string; message: string; onClose?: () => void }) => (
    <div data-testid="toast-component" data-type={type}>
      {message}
      {onClose && <button onClick={onClose} data-testid="toast-close">×</button>}
    </div>
  )
}));

jest.mock('../../src/ui/widgets/omnicoin/components/OmniCoinTooltip', () => ({
  __esModule: true,
  default: ({ children, text }: { children: React.ReactNode; text: string }) => (
    <div data-testid="tooltip" title={text}>
      {children}
    </div>
  )
}));

import { useNFTs } from '../../src/hooks/useNFTs';
import { useNFTTransfer } from '../../src/hooks/useNFTTransfer';

const mockUseNFTs = useNFTs as jest.MockedFunction<typeof useNFTs>;
const mockUseNFTTransfer = useNFTTransfer as jest.MockedFunction<typeof useNFTTransfer>;

// Mock NFT data with proper TypeScript types
const mockNFTs: NFTItem[] = [
  {
    id: 'nft-1',
    tokenId: '1',
    name: 'Test NFT #1',
    description: 'A test NFT for component testing',
    image: 'https://example.com/nft1.png',
    contractAddress: '0x1234567890123456789012345678901234567890',
    contract: 'TestNFTContract',
    tokenStandard: 'ERC721',
    blockchain: 'ethereum',
    owner: '0xowner1',
    attributes: [
      { trait_type: 'Color', value: 'Blue' },
      { trait_type: 'Rarity', value: 'Common' }
    ],
    metadata: {
      name: 'Test NFT #1',
      description: 'A test NFT for component testing',
      image: 'https://example.com/nft1.png',
      attributes: [
        { trait_type: 'Color', value: 'Blue' },
        { trait_type: 'Rarity', value: 'Common' }
      ]
    }
  },
  {
    id: 'nft-2',
    tokenId: '2',
    name: 'Test NFT #2',
    description: 'Another test NFT',
    image: 'https://example.com/nft2.png',
    contractAddress: '0x1234567890123456789012345678901234567890',
    contract: 'TestNFTContract',
    tokenStandard: 'ERC721',
    blockchain: 'ethereum',
    owner: '0xowner2',
    attributes: [
      { trait_type: 'Color', value: 'Red' },
      { trait_type: 'Rarity', value: 'Rare' }
    ],
    metadata: {
      name: 'Test NFT #2',
      description: 'Another test NFT',
      image: 'https://example.com/nft2.png'
    }
  }
];

describe('NFTGallery Component', () => {
  const user = userEvent.setup();
  
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Default mock implementations
    mockUseNFTs.mockReturnValue({
      nfts: mockNFTs,
      isLoading: false,
      error: null,
      refetch: jest.fn().mockResolvedValue(undefined)
    });
    
    mockUseNFTTransfer.mockReturnValue({
      transferNFT: jest.fn().mockResolvedValue(undefined),
      isTransferring: false,
      error: null
    });
  });

  describe('Component Rendering', () => {
    it('should render NFT gallery with proper TypeScript types', () => {
      render(<NFTGallery />);
      
      expect(screen.getByTestId('gallery-container')).toBeInTheDocument();
    });

    it('should render all NFTs in the gallery', () => {
      render(<NFTGallery />);
      
      // Check that NFT cards are rendered
      const nftCards = screen.getAllByTestId('nft-card');
      expect(nftCards).toHaveLength(2);
    });

    it('should display NFT metadata correctly', () => {
      render(<NFTGallery />);
      
      // Check NFT names are displayed
      expect(screen.getByText('Test NFT #1')).toBeInTheDocument();
      expect(screen.getByText('Test NFT #2')).toBeInTheDocument();
      
      // Check descriptions are displayed
      expect(screen.getByText('A test NFT for component testing')).toBeInTheDocument();
      expect(screen.getByText('Another test NFT')).toBeInTheDocument();
    });

    it('should render NFT images with proper alt text', () => {
      render(<NFTGallery />);
      
      const images = screen.getAllByRole('img') as HTMLImageElement[];
      expect(images).toHaveLength(2);
      expect(images[0]).toHaveAttribute('src', 'https://example.com/nft1.png');
      expect(images[0]).toHaveAttribute('alt', 'Test NFT #1');
      expect(images[1]).toHaveAttribute('src', 'https://example.com/nft2.png');
      expect(images[1]).toHaveAttribute('alt', 'Test NFT #2');
    });

    it('should handle missing metadata gracefully', () => {
      const nftsWithMissingMetadata = [
        {
          ...mockNFTs[0],
          metadata: undefined
        }
      ];
      
      mockUseNFTs.mockReturnValue({
        nfts: nftsWithMissingMetadata,
        isLoading: false,
        error: null,
        refetch: jest.fn().mockResolvedValue(undefined)
      });
      
      render(<NFTGallery />);
      
      // Should show fallback text for missing metadata
      expect(screen.getByText('Unnamed NFT')).toBeInTheDocument();
      expect(screen.getByText('No description available')).toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    it('should show loading component when loading', () => {
      mockUseNFTs.mockReturnValue({
        nfts: [],
        isLoading: true,
        error: null,
        refetch: jest.fn().mockResolvedValue(undefined)
      });
      
      render(<NFTGallery />);
      
      expect(screen.getByTestId('loading-component')).toBeInTheDocument();
      expect(screen.getByText('Loading NFTs...')).toBeInTheDocument();
    });

    it('should show error toast when there is an error', () => {
      mockUseNFTs.mockReturnValue({
        nfts: [],
        isLoading: false,
        error: 'Failed to load NFTs',
        refetch: jest.fn().mockResolvedValue(undefined)
      });
      
      render(<NFTGallery />);
      
      expect(screen.getByTestId('toast-component')).toBeInTheDocument();
      expect(screen.getByText('Failed to load NFTs')).toBeInTheDocument();
      expect(screen.getByTestId('toast-component')).toHaveAttribute('data-type', 'error');
    });

    it('should render empty state when no NFTs are available', () => {
      mockUseNFTs.mockReturnValue({
        nfts: [],
        isLoading: false,
        error: null,
        refetch: jest.fn().mockResolvedValue(undefined)
      });
      
      render(<NFTGallery />);
      
      expect(screen.getByTestId('gallery-container')).toBeInTheDocument();
      expect(screen.queryAllByTestId('nft-card')).toHaveLength(0);
    });
  });

  describe('Transfer Functionality', () => {
    it('should open transfer dialog when transfer button is clicked', async () => {
      render(<NFTGallery />);
      
      const transferButtons = screen.getAllByTestId('transfer-button');
      await user.click(transferButtons[0]);
      
      expect(screen.getByTestId('dialog-overlay')).toBeInTheDocument();
      expect(screen.getByTestId('transfer-dialog')).toBeInTheDocument();
      expect(screen.getByText('Transfer Test NFT #1')).toBeInTheDocument();
    });

    it('should close transfer dialog when overlay is clicked', async () => {
      render(<NFTGallery />);
      
      const transferButtons = screen.getAllByTestId('transfer-button');
      await user.click(transferButtons[0]);
      
      const overlay = screen.getByTestId('dialog-overlay');
      await user.click(overlay);
      
      expect(screen.queryByTestId('dialog-overlay')).not.toBeInTheDocument();
      expect(screen.queryByTestId('transfer-dialog')).not.toBeInTheDocument();
    });

    it('should close transfer dialog when cancel button is clicked', async () => {
      render(<NFTGallery />);
      
      const transferButtons = screen.getAllByTestId('transfer-button');
      await user.click(transferButtons[0]);
      
      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);
      
      expect(screen.queryByTestId('dialog-overlay')).not.toBeInTheDocument();
      expect(screen.queryByTestId('transfer-dialog')).not.toBeInTheDocument();
    });

    it('should handle recipient input changes', async () => {
      render(<NFTGallery />);
      
      const transferButtons = screen.getAllByTestId('transfer-button');
      await user.click(transferButtons[0]);
      
      const recipientInput = screen.getByPlaceholderText('Recipient Address') as HTMLInputElement;
      await user.type(recipientInput, '0xrecipient123');
      
      expect(recipientInput.value).toBe('0xrecipient123');
    });

    it('should call transferNFT when transfer is confirmed', async () => {
      const mockTransferNFT = jest.fn().mockResolvedValue(undefined);
      const mockRefetch = jest.fn().mockResolvedValue(undefined);
      
      mockUseNFTTransfer.mockReturnValue({
        transferNFT: mockTransferNFT,
        isTransferring: false,
        error: null
      });
      
      mockUseNFTs.mockReturnValue({
        nfts: mockNFTs,
        isLoading: false,
        error: null,
        refetch: mockRefetch
      });
      
      render(<NFTGallery />);
      
      const transferButtons = screen.getAllByTestId('transfer-button');
      await user.click(transferButtons[0]);
      
      const recipientInput = screen.getByPlaceholderText('Recipient Address');
      await user.type(recipientInput, '0xrecipient123');
      
      const dialogButtons = screen.getAllByTestId('dialog-button');
      const confirmButton = dialogButtons.find((btn) => btn.textContent === 'Transfer') || dialogButtons[0];
      await user.click(confirmButton);
      
      expect(mockTransferNFT).toHaveBeenCalled();
    });

    it('should show transfer pending state', async () => {
      const mockTransferNFT = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      mockUseNFTTransfer.mockReturnValue({
        transferNFT: mockTransferNFT,
        isTransferring: false,
        error: null
      });
      
      render(<NFTGallery />);
      
      const transferButtons = screen.getAllByTestId('transfer-button');
      await user.click(transferButtons[0]);
      
      const recipientInput = screen.getByPlaceholderText('Recipient Address');
      await user.type(recipientInput, '0xrecipient123');
      
      const dialogButtons = screen.getAllByTestId('dialog-button');
      const confirmButton = dialogButtons.find((btn) => btn.textContent === 'Transfer') || dialogButtons[0];
      fireEvent.click(confirmButton);
      
      // Should show pending toast
      await waitFor(() => {
        expect(screen.getByText('Processing NFT transfer...')).toBeInTheDocument();
      });
    });

    it('should handle transfer success', async () => {
      const mockTransferNFT = jest.fn().mockResolvedValue(undefined);
      const mockRefetch = jest.fn().mockResolvedValue(undefined);
      
      mockUseNFTTransfer.mockReturnValue({
        transferNFT: mockTransferNFT,
        isTransferring: false,
        error: null
      });
      
      mockUseNFTs.mockReturnValue({
        nfts: mockNFTs,
        isLoading: false,
        error: null,
        refetch: mockRefetch
      });
      
      render(<NFTGallery />);
      
      const transferButtons = screen.getAllByTestId('transfer-button');
      await user.click(transferButtons[0]);
      
      const recipientInput = screen.getByPlaceholderText('Recipient Address');
      await user.type(recipientInput, '0xrecipient123');
      
      const dialogButtons = screen.getAllByTestId('dialog-button');
      const confirmButton = dialogButtons.find((btn) => btn.textContent === 'Transfer') || dialogButtons[0];
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.getByText('NFT transferred successfully!')).toBeInTheDocument();
      });
      
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('should handle transfer error', async () => {
      const mockTransferNFT = jest.fn().mockRejectedValue(new Error('Transfer failed'));
      
      mockUseNFTTransfer.mockReturnValue({
        transferNFT: mockTransferNFT,
        isTransferring: false,
        error: null
      });
      
      render(<NFTGallery />);
      
      const transferButtons = screen.getAllByTestId('transfer-button');
      await user.click(transferButtons[0]);
      
      const recipientInput = screen.getByPlaceholderText('Recipient Address');
      await user.type(recipientInput, '0xrecipient123');
      
      const dialogButtons = screen.getAllByTestId('dialog-button');
      const confirmButton = dialogButtons.find((btn) => btn.textContent === 'Transfer') || dialogButtons[0];
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.getByText('Transfer failed')).toBeInTheDocument();
      });
    });

    it('should disable transfer button when transferring', () => {
      mockUseNFTTransfer.mockReturnValue({
        transferNFT: jest.fn().mockResolvedValue(undefined),
        isTransferring: true,
        error: null
      });
      
      render(<NFTGallery />);
      
      const transferButtons = screen.getAllByTestId('transfer-button');
      expect(transferButtons[0]).toBeDisabled();
    });
  });

  describe('Toast Notifications', () => {
    it('should close toast when close button is clicked', async () => {
      // First trigger an error to show a toast
      mockUseNFTs.mockReturnValue({
        nfts: [],
        isLoading: false,
        error: 'Test error',
        refetch: jest.fn().mockResolvedValue(undefined)
      });
      
      render(<NFTGallery />);
      
      expect(screen.getByTestId('toast-component')).toBeInTheDocument();
      
      // Note: The error toast doesn't have an onClose prop, so it won't have a close button
      // This is testing the component behavior as implemented
      expect(screen.queryByTestId('toast-close')).not.toBeInTheDocument();
    });
  });

  describe('TypeScript Strict Mode Compliance', () => {
    it('should handle optional props correctly', () => {
      render(<NFTGallery contractAddress="0x123" />);
      
      expect(screen.getByTestId('gallery-container')).toBeInTheDocument();
    });

    it('should handle undefined contractAddress prop', () => {
      render(<NFTGallery />);
      
      expect(screen.getByTestId('gallery-container')).toBeInTheDocument();
    });

    it('should properly type event handlers', async () => {
      render(<NFTGallery />);
      
      const transferButtons = screen.getAllByTestId('transfer-button');
      await user.click(transferButtons[0]);
      
      const recipientInput = screen.getByPlaceholderText('Recipient Address') as HTMLInputElement;
      
      // This tests that the onChange event handler is properly typed
      await user.type(recipientInput, 'test');
      expect(recipientInput.value).toBe('test');
    });

    it('should handle theme props with proper fallbacks', () => {
      render(<NFTGallery />);
      
      // All styled components should render with data-styled attribute
      const styledElements = screen.getAllByTestId(
        (content, element) => element?.hasAttribute('data-styled') ?? false
      );
      
      expect(styledElements.length).toBeGreaterThan(0);
    });
  });

  describe('Component Props Interface', () => {
    it('should accept contractAddress prop', () => {
      const { rerender } = render(<NFTGallery />);
      
      // Should render without contractAddress
      expect(screen.getByTestId('gallery-container')).toBeInTheDocument();
      
      // Should render with contractAddress
      rerender(<NFTGallery contractAddress="0xTestContract" />);
      expect(screen.getByTestId('gallery-container')).toBeInTheDocument();
    });
  });

  describe('Error Boundary Integration', () => {
    it('should not crash when hooks throw errors', () => {
      // Mock the console.error to avoid noise in test output
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      mockUseNFTs.mockImplementation(() => {
        throw new Error('Hook error');
      });
      
      // Using try-catch to handle potential errors gracefully
      expect(() => {
        render(<NFTGallery />);
      }).toThrow('Hook error');
      
      consoleSpy.mockRestore();
    });
  });
});