# OmniBazaar Wallet Documentation

## Overview

The OmniBazaar Wallet module provides a wallet interface for managing OmniCoin and other assets. It integrates with EVM-based wallets (e.g., MetaMask) and supports advanced features like staking, privacy, and governance.

## Core Components

### 1. **Wallet Core (`src/core/wallet/Wallet.ts`)**

- **Purpose:**  
  Manages wallet state, transactions, and interactions with the blockchain.
- **Key Features:**  
  - Account management (connect, disconnect, get address, balance)
  - Transaction handling (send, sign)
  - Token management (balance, approve)
  - Network management (switch, add)
  - Advanced OmniCoin features (staking, privacy, governance)

### 2. **OmniCoin Integration (`src/core/blockchain/OmniCoin.ts`)**

- **Purpose:**  
  Provides OmniCoin contract metadata and helper functions.
- **Key Features:**  
  - Contract address and metadata
  - Balance retrieval
  - Transfer functionality

### 3. **Supported Assets (`src/core/wallet/assets.ts`)**

- **Purpose:**  
  Defines the list of supported assets, with OmniCoin as the default.

## Advanced Features

### Staking

- **Methods:**  
  - `stakeOmniCoin(amount)`
  - `unstakeOmniCoin(amount)`
  - `getStakedBalance()`
- **Status:**  
  Placeholder implementation. Logic to be added as contracts are finalized.

### Privacy

- **Methods:**  
  - `createPrivacyAccount()`
  - `closePrivacyAccount()`
  - `getPrivacyBalance()`
- **Status:**  
  Placeholder implementation. Logic to be added as contracts are finalized.

### Governance

- **Methods:**  
  - `proposeGovernanceAction(description, actions)`
  - `voteOnProposal(proposalId, support)`
- **Status:**  
  Placeholder implementation. Logic to be added as contracts are finalized.

## Integration with DePay

The wallet implementation is inspired by the DePay reference implementation. Key components from DePay (e.g., wallet core logic, transaction handling) are adapted and integrated into the OmniBazaar Wallet module.

## TODO

- Implement advanced OmniCoin features (staking, privacy, governance).
- Update UI to expose advanced features.
- Add tests for OmniCoin wallet operations.

## OmniCoin Integration

### Overview

This document outlines the integration of OmniCoin functionality into the wallet application. It includes components for token management, transaction history, and token transfers.

### Components

- **OmniCoinTokenManagement**: Manages token approvals and displays token balances and allowances.
- **OmniCoinTokenTransfer**: Allows users to transfer tokens to another address.
- **OmniCoinTransactionHistory**: Displays a history of transactions.

### Hooks

- **useOmniCoinToken**: Provides functions for token operations such as approval, transfer, balance, and allowance checks.

### Usage

Import the components and hooks from `src/ui/widgets/omnicoin` to use them in your application.

### Development

- Ensure you have the necessary dependencies installed.
- Run the development server using `npm start` or `yarn start`. 