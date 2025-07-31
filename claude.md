# Wallet Module

## Purpose

The Wallet module that is being built in this repository is a combination of the best parts of DePay wallet, Rainbow wallet, Enkrypt wallet, and Frame wallet.
- Provide a simple, user-friendly wallet for OmniBazaar users who don't have any other web3 wallet
- Provide wallet services within OmniBazaar marketplace, DEX (CryptoBazaar), staking services, and cross-chain bridging
- Provide an interface for legacy OmniCoin users to migrate their balances to the new OmniCoin
- Store users listings (as OmniCoin NFTs), other NFTs from many different chains, and crytp balances from other platforms/chains

## Key Context

Development Plan: C:\Users\rickc\OmniBazaar\Wallet\WALLET_DEVELOPMENT_PLAN.md
Project Status: C:\Users\rickc\OmniBazaar\Wallet\PROJECT_STATUS.md
TODO: C:\Users\rickc\OmniBazaar\Wallet\TODO.md
Legacy OmniBazaar UI Implementation: C:\Users\rickc\OmniBazaar\OmniCoin-v1--UI
Legacy OmniBazaar DHT Implementation: C:\Users\rickc\OmniBazaar\OmniCoin-v1--DHT2
New OmniCoin module: C:\Users\rickc\OmniBazaar\Coin
OmniBazaar logo image files: C:\Users\rickc\OmniBazaar\Wallet\static\images

## NFT Minting

Notice: when implementing NFT minting of new user listings, we will want to mint on the OmniCoin blockchain. When displaying NFTs in the marketplace, we will want to support as many chains as is practically possible.

## References

Review the legacy DHT system and user interface for hints on what metadata to store for listings,  how to index and search for it, and how to display it in the UI.

See this file for important general rules and context: C:\Users\rickc\OmniBazaar\claude.md