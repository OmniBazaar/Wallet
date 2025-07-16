# ENS Integration Strategy for OmniCoin Username Resolution

## Overview

This document summarizes the research and strategic decisions regarding implementing username.omnicoin addresses that work in external wallets (MetaMask, Ledger, etc.) while maintaining zero per-user costs on Ethereum.

## Key Decisions Made

### 1. **No Per-User ETH Gas Fees**
- We will NOT store individual user registrations on Ethereum
- All user data lives on OmniCoin/COTI V2 blockchain
- Zero ETH gas costs per user registration

### 2. **Stateless Resolution Approach**
- Deploy a single resolver contract on Ethereum
- Contract queries OmniCoin chain for address resolution
- No storage of user data on Ethereum

## COTI V2 Research Findings (As of July 2025)

### Technical Capabilities
1. **Mainnet Launch**: COTI V2 mainnet launched March 2025
2. **Performance**: 
   - 1,000 TPS for native transactions
   - 40 TPS for encrypted transactions
   - 3,000x faster than competing privacy solutions
3. **EVM Compatibility**: Full Ethereum compatibility with privacy features
4. **Cross-Chain Support**: Plans to span 70+ blockchains

### Infrastructure Available
- **Developer SDK**: TypeScript and Python SDKs available
- **Documentation**: Comprehensive docs at https://docs.coti.io
- **Oracle Integration**: Band Protocol provides encrypted data feeds
- **Gas Costs**: 5,000,000 wei base fee, significantly cheaper than Ethereum

### What's Still Unclear
- Specific cross-chain query capabilities from Ethereum to COTI
- Whether COTI provides built-in stateless query infrastructure
- Exact gas costs for cross-chain operations

## Recommended Implementation Strategy

### Phase 1: OmniCoin Native Registry
```solidity
// Deploy on COTI V2 (OmniCoin blockchain)
contract OmniNameRegistry {
    mapping(string => address) public names;
    uint256 public registrationFee = 1; // 1 XOM (~$0.01)
    
    function register(string memory username) public {
        require(names[username] == address(0), "Name taken");
        names[username] = msg.sender;
        // OmniBazaar pays the 1 XOM fee
    }
}
```

### Phase 2: Stateless Ethereum Resolver
```solidity
// Deploy on Ethereum (one-time cost ~$200)
contract OmniResolver {
    // No storage - pure query contract
    
    function resolve(string memory name) public view returns (address) {
        // Option 1: If COTI provides cross-chain queries
        return ICOTIBridge(cotiBridge).query(omniRegistry, "resolve", name);
        
        // Option 2: Oracle-based resolution
        // Nodes provide answers via view functions
    }
}
```

### Phase 3: ENS Integration
1. Register available ENS domain (xom.eth, omni.eth, or omnibazaar.eth)
2. Point ENS to our stateless resolver
3. Enable MetaMask compatibility

## Node Architecture (No ETH Costs)

```javascript
class OmniNode {
  // Nodes provide resolution service
  async handleNameQuery(username) {
    // Query COTI V2 chain (cheap gas)
    const address = await this.cotiProvider.queryRegistry(username);
    
    // Cache for performance
    await this.cache.set(username, address);
    
    // Earn XOM rewards (no ETH spending)
    await this.claimReward(0.1); // 0.1 XOM per query
  }
}
```

## Cost Structure

### One-Time Costs
- ENS domain: $5-640/year (depending on length)
- Resolver deployment: ~$200 in ETH gas
- Total: < $1,000 initial investment

### Per-User Costs
- Registration: 1 XOM (~$0.01) - OmniBazaar pays
- ETH gas: $0 (stateless resolution)
- Total user cost: **FREE**

### Node Operator Costs
- ETH gas: $0 (no on-chain storage)
- COTI gas: Minimal (covered by XOM rewards)
- Net result: Nodes earn money, don't spend it

## Implementation Timeline

### Week 1-2: COTI Research & Testing
- Test cross-chain query capabilities
- Verify stateless resolution feasibility
- Prototype on COTI testnet

### Week 3-4: Deploy Core Components
- Deploy OmniNameRegistry on COTI V2
- Deploy stateless resolver on Ethereum
- Integrate with node network

### Week 5-6: ENS Integration & Testing
- Register ENS domain
- Configure resolver
- Test with MetaMask

## Action Items

1. **Immediate**:
   - Contact COTI team about cross-chain query support
   - Test COTI V2 SDK capabilities
   - Check ENS domain availability

2. **Short-term**:
   - Prototype stateless resolver
   - Design node reward structure
   - Create integration tests

3. **Medium-term**:
   - Deploy production contracts
   - Launch with initial users
   - Monitor performance

## Key Benefits

1. **Zero User Costs**: Free registration and usage
2. **No ETH for Nodes**: Nodes earn XOM, don't spend ETH
3. **Scalable**: No per-user storage on expensive chains
4. **Privacy**: Leverages COTI's privacy features
5. **Cross-Chain**: Works with 70+ blockchains

## Risks & Mitigations

1. **COTI Bridge Limitations**:
   - Mitigation: Use oracle-based backup solution
   
2. **ENS Domain Unavailability**:
   - Mitigation: Multiple domain options (xom.eth, omni.eth, etc.)
   
3. **Gas Price Spikes**:
   - Mitigation: Stateless design minimizes exposure

## Conclusion

By using stateless resolution and leveraging COTI V2's infrastructure, we can deliver username.omnicoin functionality in external wallets with:
- Zero per-user costs
- No ETH gas for node operators
- Full MetaMask compatibility
- Scalable architecture

The key is avoiding on-chain storage on Ethereum while using COTI V2's cheaper infrastructure for actual data storage.