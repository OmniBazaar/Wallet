/**
 * NFTGallery Component Tests
 * Tests for the NFT gallery display component
 */

import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import NFTGallery from '../../src/components/NFTGallery.vue';
import { useNFTStore } from '../../src/stores/nfts';
import { mockNFT } from '../setup';

describe('NFTGallery Component', () => {
  let wrapper: VueWrapper;
  let nftStore: ReturnType<typeof useNFTStore>;

  const mockNFTs = [
    {
      ...mockNFT,
      tokenId: '1',
      name: 'Cool NFT #1',
      image: 'https://example.com/nft1.png',
      collection: 'Cool Collection',
      chain: 'ethereum'
    },
    {
      ...mockNFT,
      tokenId: '2',
      name: 'Cool NFT #2',
      image: 'https://example.com/nft2.png',
      collection: 'Cool Collection',
      chain: 'avalanche'
    },
    {
      ...mockNFT,
      tokenId: '3',
      name: 'Rare NFT',
      image: 'https://example.com/nft3.mp4',
      collection: 'Rare Collection',
      chain: 'polygon',
      animation_url: 'https://example.com/nft3.mp4'
    }
  ];

  beforeEach(() => {
    setActivePinia(createPinia());
    nftStore = useNFTStore();
    nftStore.nfts = mockNFTs;
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  describe('NFT Display', () => {
    it('should render all NFTs in grid', () => {
      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      const nftCards = wrapper.findAll('[data-testid="nft-card"]');
      expect(nftCards).toHaveLength(3);
    });

    it('should display NFT information', () => {
      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      const firstNFT = wrapper.find('[data-testid="nft-card-0"]');
      
      expect(firstNFT.find('[data-testid="nft-name"]').text()).toBe('Cool NFT #1');
      expect(firstNFT.find('[data-testid="nft-collection"]').text()).toBe('Cool Collection');
      expect(firstNFT.find('[data-testid="nft-chain"]').text()).toContain('Ethereum');
    });

    it('should handle video NFTs', () => {
      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      const videoNFT = wrapper.find('[data-testid="nft-card-2"]');
      expect(videoNFT.find('video').exists()).toBe(true);
      expect(videoNFT.find('video').attributes('src')).toBe('https://example.com/nft3.mp4');
    });

    it('should switch between grid and list view', async () => {
      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      expect(wrapper.find('[data-testid="nft-grid"]').exists()).toBe(true);
      
      await wrapper.find('[data-testid="view-toggle"]').trigger('click');
      
      expect(wrapper.find('[data-testid="nft-list"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="nft-grid"]').exists()).toBe(false);
    });
  });

  describe('NFT Filtering', () => {
    it('should filter by collection', async () => {
      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      const collectionFilter = wrapper.find('[data-testid="collection-filter"]');
      await collectionFilter.setValue('Cool Collection');

      const visibleNFTs = wrapper.findAll('[data-testid="nft-card"]:visible');
      expect(visibleNFTs).toHaveLength(2);
    });

    it('should filter by chain', async () => {
      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="chain-filter-ethereum"]').trigger('click');

      const visibleNFTs = wrapper.findAll('[data-testid="nft-card"]:visible');
      expect(visibleNFTs).toHaveLength(1);
      expect(visibleNFTs[0].find('[data-testid="nft-name"]').text()).toBe('Cool NFT #1');
    });

    it('should search NFTs by name', async () => {
      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      const searchInput = wrapper.find('[data-testid="nft-search"]');
      await searchInput.setValue('Rare');

      const visibleNFTs = wrapper.findAll('[data-testid="nft-card"]:visible');
      expect(visibleNFTs).toHaveLength(1);
      expect(visibleNFTs[0].find('[data-testid="nft-name"]').text()).toBe('Rare NFT');
    });

    it('should show only listed NFTs', async () => {
      nftStore.nfts[0].isListed = true;
      nftStore.nfts[1].isListed = false;
      nftStore.nfts[2].isListed = true;

      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="filter-listed"]').trigger('click');

      const visibleNFTs = wrapper.findAll('[data-testid="nft-card"]:visible');
      expect(visibleNFTs).toHaveLength(2);
    });
  });

  describe('NFT Actions', () => {
    it('should open NFT detail modal on click', async () => {
      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="nft-card-0"]').trigger('click');
      
      const modal = wrapper.find('[data-testid="nft-detail-modal"]');
      expect(modal.exists()).toBe(true);
      expect(modal.find('[data-testid="modal-nft-name"]').text()).toBe('Cool NFT #1');
    });

    it('should list NFT for sale', async () => {
      const listNFTSpy = vi.spyOn(nftStore, 'listNFT');

      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="nft-card-0"]').trigger('click');
      await wrapper.find('[data-testid="list-nft-button"]').trigger('click');
      
      const listingModal = wrapper.find('[data-testid="listing-modal"]');
      await listingModal.find('[data-testid="price-input"]').setValue('100');
      await listingModal.find('[data-testid="currency-select"]').setValue('XOM');
      await listingModal.find('[data-testid="confirm-listing"]').trigger('click');
      
      expect(listNFTSpy).toHaveBeenCalledWith({
        tokenId: '1',
        contractAddress: mockNFT.contractAddress,
        price: '100',
        currency: 'XOM'
      });
    });

    it('should transfer NFT', async () => {
      const transferNFTSpy = vi.spyOn(nftStore, 'transferNFT');

      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="nft-card-0"]').trigger('click');
      await wrapper.find('[data-testid="transfer-nft-button"]').trigger('click');
      
      const transferModal = wrapper.find('[data-testid="transfer-modal"]');
      await transferModal.find('[data-testid="recipient-input"]').setValue('0xrecipient...');
      await transferModal.find('[data-testid="confirm-transfer"]').trigger('click');
      
      expect(transferNFTSpy).toHaveBeenCalledWith({
        tokenId: '1',
        contractAddress: mockNFT.contractAddress,
        to: '0xrecipient...'
      });
    });

    it('should refresh NFT metadata', async () => {
      const refreshMetadataSpy = vi.spyOn(nftStore, 'refreshMetadata');

      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="nft-card-0"]').trigger('click');
      await wrapper.find('[data-testid="refresh-metadata"]').trigger('click');
      
      expect(refreshMetadataSpy).toHaveBeenCalledWith(
        mockNFT.contractAddress,
        '1'
      );
    });
  });

  describe('Sorting', () => {
    it('should sort by name', async () => {
      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="sort-select"]').setValue('name-asc');

      const nftNames = wrapper.findAll('[data-testid="nft-name"]')
        .map(el => el.text());
      
      expect(nftNames).toEqual(['Cool NFT #1', 'Cool NFT #2', 'Rare NFT']);
    });

    it('should sort by recently added', async () => {
      nftStore.nfts[0].addedAt = Date.now() - 1000;
      nftStore.nfts[1].addedAt = Date.now();
      nftStore.nfts[2].addedAt = Date.now() - 2000;

      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="sort-select"]').setValue('recent');

      const nftNames = wrapper.findAll('[data-testid="nft-name"]')
        .map(el => el.text());
      
      expect(nftNames[0]).toBe('Cool NFT #2');
    });
  });

  describe('Bulk Actions', () => {
    it('should select multiple NFTs', async () => {
      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="bulk-select-mode"]').trigger('click');
      
      await wrapper.find('[data-testid="nft-checkbox-0"]').setChecked(true);
      await wrapper.find('[data-testid="nft-checkbox-2"]').setChecked(true);

      expect(wrapper.find('[data-testid="selected-count"]').text()).toBe('2 selected');
    });

    it('should bulk transfer NFTs', async () => {
      const bulkTransferSpy = vi.spyOn(nftStore, 'bulkTransfer');

      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="bulk-select-mode"]').trigger('click');
      await wrapper.find('[data-testid="nft-checkbox-0"]').setChecked(true);
      await wrapper.find('[data-testid="nft-checkbox-1"]').setChecked(true);
      
      await wrapper.find('[data-testid="bulk-transfer"]').trigger('click');
      
      const modal = wrapper.find('[data-testid="bulk-transfer-modal"]');
      await modal.find('[data-testid="recipient-input"]').setValue('0xrecipient...');
      await modal.find('[data-testid="confirm-bulk-transfer"]').trigger('click');
      
      expect(bulkTransferSpy).toHaveBeenCalledWith(
        ['1', '2'],
        '0xrecipient...'
      );
    });
  });

  describe('Loading and Error States', () => {
    it('should show loading state', () => {
      nftStore.isLoading = true;

      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      expect(wrapper.findAll('[data-testid="nft-skeleton"]').length).toBeGreaterThan(0);
    });

    it('should show empty state', () => {
      nftStore.nfts = [];

      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="browse-marketplace"]').exists()).toBe(true);
    });

    it('should show error state', () => {
      nftStore.error = 'Failed to load NFTs';

      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      expect(wrapper.find('[data-testid="error-state"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="error-message"]').text())
        .toContain('Failed to load NFTs');
    });
  });

  describe('NFT Details Modal', () => {
    it('should show NFT attributes', async () => {
      nftStore.nfts[0].attributes = [
        { trait_type: 'Color', value: 'Blue' },
        { trait_type: 'Rarity', value: 'Rare' }
      ];

      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="nft-card-0"]').trigger('click');
      
      const attributes = wrapper.findAll('[data-testid="nft-attribute"]');
      expect(attributes).toHaveLength(2);
      expect(attributes[0].text()).toContain('Color');
      expect(attributes[0].text()).toContain('Blue');
    });

    it('should show price history', async () => {
      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="nft-card-0"]').trigger('click');
      await wrapper.find('[data-testid="view-history-tab"]').trigger('click');
      
      expect(wrapper.find('[data-testid="price-history"]').exists()).toBe(true);
    });

    it('should show on-chain data', async () => {
      wrapper = mount(NFTGallery, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="nft-card-0"]').trigger('click');
      
      expect(wrapper.find('[data-testid="contract-address"]').text())
        .toContain(mockNFT.contractAddress);
      expect(wrapper.find('[data-testid="token-id"]').text())
        .toContain('1');
      expect(wrapper.find('[data-testid="token-standard"]').text())
        .toContain('ERC-721');
    });
  });
});