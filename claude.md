# Wallet Module

## General Rules

IMPORTANT: Follow all project coding standards found here: C:\Users\rickc\OmniBazaar\CLAUDE.md

- Don't "reinvent the wheel". USE the WORKING tools, code, templates, references, and examples provided in C:\Users\rickc\OmniBazaar\Wallet\DePay. DO NOT write your own new code if you can refactor, modify, or translate some existing code. Integrate DePay's funtionalities into our application. Reference the working designs and code. That's what it is there for.

- Create tests that actually test the functionality and interoperability of the contracts. If testing shows issues in the code, fix the code. Don't modify the tests for the sake of getting the code to pass the tests. Instead modify the code to pass the tests.

- DO NOT USE STUB OR MOCKS. Do actual integration of components and modules. Tight integration is critical in OmniBazaar/OmniCoin/OmniWallet/CryptoBazaar. Do the work NOW to create the actual account, service, component or function you need. Mocks and stubs are LAZY programming. DO THE WORK. DON'T PUT IT OFF. If you must use mocks or stubs in a TEST, mark it clearly.

- If you find any instances in the code where mocks, stubs, or "todos" exist, replace those with the code required to make the function or feature actually work.

- ALWAYS NatSpec comment your code when you write it. DON'T put it off.

- PERSEVERE. STAY ON TASK. CONFRONT DIFFICULT TASKS. Don't look for shortcuts. Find the problem and fix it.

- Fix all warnings in addition to fixing the errors. Add NatSpec documentation, fix sequencing issues, complexity, line length, and shadow declarations. Check all "not-rely-on-time" instances to be sure the business case really needs them. If so, you may disable the warning with solhint-disable-line comments. Fix every warning you can. Don't put it off for "later".

- For off-chain data, consider the greater efficiency of achieving consensus by database synchronization rather than each node recomputing the database state from the stream of events.

CRITICAL: Tokenomics, fees, and reputation instructions are here: OmniBazaar Design Checkpoint.txt

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