# Code Cleanup TODO Inventory (Wallet/src)

This inventory lists comments and markers indicating incomplete or temporary code, mocks, stubs, or items that need implementation. Use it to plan and track cleanup work. Each item links to a file and line for quick navigation.

## Legend

- Tags: TODO, FIXME, HACK, XXX, WIP, In Production, Mock/Stub, Should/Later/Eventually, Temporary, Not Implemented Yet

---

## High‑Priority TODOs

- Wallet/src/components/transaction/TransactionFlow.vue:276 — TODO: Get from actual wallet
- Wallet/src/hooks/useValidatorWallet.ts:537 — TODO: Implement health check
- Wallet/src/hooks/useValidatorWallet.ts:540 — TODO: Implement health check
- Wallet/src/components/auth/LoginForm.vue:379 — TODO: Check availability with backend
- Wallet/src/components/auth/LoginForm.vue:419 — TODO: Implement password recovery
- Wallet/src/core/keyring/KeyringManager.ts:258 — TODO: Implement OmniCoin address format validation
- Wallet/src/core/keyring/KeyringManager.ts:359 — TODO: Implement backend API call for name registration
- Wallet/src/core/keyring/KeyringManager.ts:369 — TODO: Implement secure storage strategy
- Wallet/src/core/keyring/KeyringManager.ts:374 — TODO: Implement secure storage
- Wallet/src/core/keyring/KeyringManager.ts:518 — TODO: Implement transaction signing
- Wallet/src/core/keyring/KeyringManager.ts:546 — TODO: Implement chain-specific signing
- Wallet/src/core/wallet/Wallet.ts:422 — TODO: Get staking contract from config
- Wallet/src/core/wallet/Wallet.ts:457 — TODO: Get staking contract from config
- Wallet/src/core/wallet/Wallet.ts:496 — TODO: Get staking contract from config
- Wallet/src/core/wallet/Wallet.ts:523 — TODO: Get privacy contract from config
- Wallet/src/core/wallet/Wallet.ts:570 — TODO: Get privacy contract from config
- Wallet/src/core/wallet/Wallet.ts:620 — TODO: Get privacy contract from config
- Wallet/src/core/wallet/Wallet.ts:662 — TODO: Get governance contract from config
- Wallet/src/core/wallet/Wallet.ts:712 — TODO: Get governance contract from config
- Wallet/src/background/background.ts:270 — TODO: Implement transaction history
- Wallet/src/core/transaction/TransactionService.ts:387 — TODO: Implement transaction history retrieval
- Wallet/src/core/payments/routing.ts:442 — TODO: Fetch token info from blockchain
- Wallet/src/core/payments/routing.ts:474 — TODO: Implement ERC20 balance checking
- Wallet/src/core/payments/routing.ts:540 — TODO: Integrate with actual DEX aggregators
- Wallet/src/core/payments/routing.ts:686 — TODO: Implement token approval
- Wallet/src/core/payments/routing.ts:698 — TODO: Implement swap execution

## In‑Production Placeholders (replace with real implementations)

- Wallet/src/core/chains/bitcoin/live-provider.ts:45 — default password handling should be secure in production
- Wallet/src/core/chains/bitcoin/provider.ts:104 — Mock impl; replace with real Bitcoin libraries
- Wallet/src/core/chains/bitcoin/provider.ts:123 — Mock impl; replace with real Bitcoin API
- Wallet/src/core/chains/bitcoin/provider.ts:216 — Mock impl; replace with real signing
- Wallet/src/core/chains/bitcoin/provider.ts:217 — Mock Bitcoin signing; replace
- Wallet/src/core/chains/bitcoin/provider.ts:230 — Mock broadcast; replace with network broadcast
- Wallet/src/core/chains/bitcoin/provider.ts:231 — Mock broadcasting; replace
- Wallet/src/core/chains/bitcoin/provider.ts:380 — Mock message signing; replace
- Wallet/src/core/chains/bitcoin/provider.ts:381 — Mock message signing; replace
- Wallet/src/core/chains/coti/provider.ts:411 — Crypto: use proper library
- Wallet/src/core/chains/coti/provider.ts:422 — Interact with onboard contract
- Wallet/src/core/chains/coti/provider.ts:432 — Decrypt key shares from tx data
- Wallet/src/core/chains/coti/provider.ts:442 — Encryption: use COTI SDK crypto_utils
- Wallet/src/core/chains/coti/provider.ts:458 — String encryption: use crypto_utils
- Wallet/src/core/chains/coti/provider.ts:479 — Decryption: use crypto_utils
- Wallet/src/core/chains/coti/provider.ts:484 — String decryption: use crypto_utils
- Wallet/src/core/chains/omnicoin/provider.ts:292 — Listing should be on-chain
- Wallet/src/core/chains/omnicoin/provider.ts:483 — Node discovery should use DHT
- Wallet/src/core/chains/omnicoin/provider.ts:526 — Migration via contract
- Wallet/src/core/storage/SecureIndexedDB.ts:76 — Unique per-user salt stored securely
- Wallet/src/core/storage/SecureIndexedDB.ts:77 — Master key handling must be secure in prod
- Wallet/src/services/LegacyMigrationService.ts:150 — Load CSV from file in prod
- Wallet/src/services/LegacyMigrationService.ts:283 — Remove demo cache in prod
- Wallet/src/core/wallet/Wallet.ts:556 — Use SecureIndexedDB to store privacy key
- Wallet/src/core/providers/OmniProvider.ts:84 — Node list should be discovered dynamically
- Wallet/src/core/providers/OmniProvider.ts:87 — Discovery should be dynamic
- Wallet/src/core/bridge/BridgeService.ts:185 — Use actual bridge APIs
- Wallet/src/core/bridge/BridgeService.ts:332 — Call specific bridge contract
- Wallet/src/core/bridge/BridgeService.ts:378 — Poll bridge APIs/listen to events
- Wallet/src/services/ParticipationService.ts:627 — Query staking contract
- Wallet/src/services/ParticipationService.ts:636 — Query KYC service (top tier)
- Wallet/src/services/KYCService.ts:511 — Use real WebSDK URL
- Wallet/src/services/KYCService.ts:512 — Return prod URL (not mock)
- Wallet/src/core/storage/ipfs-client.ts:387 — Query decentralized index
- Wallet/src/embedded/integration-example.html:380 — Use production embed URL

## Mock / Stub References (replace or isolate to tests)

- Wallet/src/core/chains/bitcoin/provider.ts:3 — Mock implementation
- Wallet/src/utils/nft.ts:106 — Mock IPFS/HTTP fetch
- Wallet/src/core/storage/ipfs-client.ts:197 — Fallback mock for development
- Wallet/src/core/storage/ipfs-client.ts:388 — Return mock data
- Wallet/src/core/storage/ipfs-client.ts:546 — Generate mock IPFS hash
- Wallet/src/core/chains/omnicoin/live-provider.ts:161 — Mock validator client
- Wallet/src/core/nft/display/multi-chain-display.ts:346 — Generate mock NFTs
- Wallet/src/core/nft/display/multi-chain-display.ts:387 — Generate mock collections
- Wallet/src/core/nft/minting/simple-minter.ts:227 — Generate mock IPFS hash
- Wallet/src/core/nft/minting/simple-minter.ts:269 — Generate mock tx hash
- Wallet/src/services/ParticipationService.ts:623 — Get staking amount (mock)
- Wallet/src/services/ParticipationService.ts:632 — Check KYC status (mock)
- Wallet/src/core/payments/routing.ts:541 — Return mock swap route
- Wallet/src/core/payments/routing.ts:549 — Mock swap calculation
- Wallet/src/popup/pages/Home.vue:235 — Mock ETH/USD rate

(Test files with mocks are expected; included here for awareness only.)

## “Should/Later/Eventually” Markers

- Wallet/src/popup/pages/Home.vue:203 — Network status will be dynamic later
- Wallet/src/core/keyring/KeyringManager.ts:363 — Registration can be retried later (review retry policy)
- Wallet/src/core/utils/units.ts:34 — Error message guidance uses “should be”
- Wallet/src/core/chains/bitcoin/live-provider.ts:45 — Password handling should be secure
- Wallet/src/embedded/EmbeddedWalletCore.ts:498 — Store resolve/reject for later (ensure cleanup)

## Temporary Implementations

- Wallet/src/core/utils/memory-storage.ts:5 — Temporary storage (non-persistent)
- Wallet/src/lib/mock/transaction.js:13 — Temporary placeholder variable

## Not Implemented Yet / WIP

- Wallet/src/lib/client/platforms/solana/rpcRequest.js:5 — not implemented yet
- Wallet/src/core/nft/minting/omnicoin-minter.ts:1 — TODO: implement ethers integration
- Wallet/src/types/hooks.ts:1 — TODO: implement provider integration
- Wallet/src/types/hooks.ts:3 — TODO: implement transaction integration

## NFT / SimpleHash Replacement TODOs

- Wallet/src/core/nft/galleryNfts.ts:123 — Restore when SimpleHash replacement is found
- Wallet/src/core/nft/nftsForCollection.ts:187 — Restore when SimpleHash replacement is found
- Wallet/src/core/nft/collections.ts:194 — Restore when SimpleHash replacement is found
- Wallet/src/core/nft/useNft.ts:47 — Restore when SimpleHash replacement is found

## OmniCoin UI Hooks (to implement)

- Wallet/src/ui/widgets/omnicoin/hooks/useOmniCoinTransaction.js:21 — Implement actual tx logic
- Wallet/src/ui/widgets/omnicoin/hooks/useOmniCoinToken.js:20 — Implement approval logic
- Wallet/src/ui/widgets/omnicoin/hooks/useOmniCoinToken.js:48 — Implement transfer logic
- Wallet/src/ui/widgets/omnicoin/hooks/useOmniCoinToken.js:69 — Implement balance check
- Wallet/src/ui/widgets/omnicoin/hooks/useOmniCoinToken.js:87 — Implement allowance check
- Wallet/src/ui/widgets/omnicoin/components/OmniCoinTokenManagement.jsx:98 — Implement send token flow
- Wallet/src/ui/contexts/WalletContext.tsx:219 — Implement explorer integration

## Imports / Feature Flags / Stubs

- Wallet/src/core/chains/evm/multi-chain-provider.ts:4 — KeyringService import TODO (feature decision)
- Wallet/src/core/nft/minting/omnicoin-minter.ts:396 — Integrate with marketplace listing service
- Wallet/src/core/wallet/Wallet.ts:3 — SupportedAssets import TODO

---

## Suggested Next Steps

1) Replace “in production” placeholders with real implementations (security-sensitive first: key storage, passwords, signing, broadcasting).
2) Implement the high‑priority TODOs in core wallet, keyring, and routing.
3) Remove or isolate mocks into test-only code paths; ensure production paths use real services.
4) Address OmniCoin UI hooks by wiring to actual contracts/providers.
5) Revisit NFT SimpleHash TODOs and select a replacement indexer/provider.

If you’d like, I can tackle a category (e.g., “In‑Production Placeholders”) and submit concrete code fixes next.
