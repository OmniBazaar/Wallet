# OmniBazaar Username Addressing System Design

## Overview

This document outlines the design for implementing ENS-style human-readable addresses in the OmniBazaar ecosystem, allowing users to use `username.omnicoin` or `username.omni` instead of complex blockchain addresses.

## Current State vs. Desired State

### Current State
- Users have complex addresses: `0x742d35Cc9cf3468a8A9...` (Ethereum), `XOMabc123def456...` (OmniCoin)
- Users must copy/paste long addresses for transactions
- High chance of user error in address entry
- Poor user experience for Web2 users

### Desired State
- Users can send to: `johnsmith.omnicoin` or `johnsmith.omni`
- Familiar, Web2-like addressing system
- Reduced transaction errors
- Enhanced user experience

## Technical Implementation Options

### Option 1: On-Chain Registry Contract (Recommended)

**Architecture:**
```
Smart Contract Registry
├── Username Registration
├── Address Resolution
├── Reverse Resolution
└── Ownership Management
```

**Implementation Steps:**
1. Deploy registry contract on OmniCoin blockchain
2. Implement registration fees to prevent squatting
3. Create resolver interface for address lookup
4. Build wallet integration for name resolution

**Contract Structure:**
```solidity
contract OmniNameService {
    mapping(string => address) public names;
    mapping(address => string) public reverseNames;
    mapping(string => bool) public registeredNames;
    
    function register(string memory name) public payable;
    function resolve(string memory name) public view returns (address);
    function reverseResolve(address addr) public view returns (string);
    function transfer(string memory name, address newOwner) public;
}
```

### Option 2: Hybrid On-Chain/Off-Chain System

**Architecture:**
- Primary registry on-chain for ownership
- DNS-like resolution for fast lookups
- Periodic synchronization between systems

### Option 3: DNS Integration with Blockchain Verification

**Architecture:**
- Use actual DNS for `.omnicoin` TLD
- Store ownership proofs on blockchain
- Verify ownership through DNS TXT records

## Implementation Phases

### Phase 1: Core Registry (Weeks 1-2)
- [ ] Deploy OmniNameService contract
- [ ] Implement basic registration/resolution
- [ ] Create admin interface for management
- [ ] Set up registration fees and rules

### Phase 2: Wallet Integration (Weeks 3-4)
- [ ] Integrate name resolution in wallet
- [ ] Update transaction forms to accept usernames
- [ ] Implement reverse resolution for display
- [ ] Add name management UI

### Phase 3: Marketplace Integration (Weeks 5-6)
- [ ] Update marketplace to use usernames
- [ ] Seller profile pages with custom names
- [ ] Username-based messaging system
- [ ] Social features with name display

### Phase 4: Advanced Features (Weeks 7-8)
- [ ] Subdomain support (`store.johnsmith.omnicoin`)
- [ ] Multi-address resolution (different chains)
- [ ] Name expiration and renewal system
- [ ] Transfer marketplace for valuable names

## Technical Specifications

### Name Format Rules
```typescript
interface NameValidation {
  minLength: 3;
  maxLength: 20;
  allowedChars: /^[a-zA-Z0-9_-]+$/;
  reservedNames: ['admin', 'api', 'www', 'omnibazaar', ...];
  extensions: ['.omnicoin', '.omni'];
}
```

### Registration Process
1. **Username Validation**
   - Check format compliance
   - Verify availability
   - Check against reserved names

2. **Payment Processing**
   - Registration fee: 10 XOM
   - Renewal fee: 5 XOM/year
   - Premium names: Auction system

3. **On-Chain Registration**
   - Submit transaction to registry contract
   - Emit registration event
   - Update local cache

### Resolution Process
```typescript
async function resolveName(name: string): Promise<string> {
  // 1. Check local cache
  let address = await cache.get(name);
  if (address) return address;
  
  // 2. Query on-chain registry
  address = await registry.resolve(name);
  if (address) {
    await cache.set(name, address, TTL);
    return address;
  }
  
  // 3. Fallback to DNS (if hybrid system)
  address = await dnsResolve(name);
  return address;
}
```

## Economic Model

### Registration Fees
- **Standard Names**: 10 XOM (~$50)
- **Premium Names** (3-4 chars): Auction starting at 100 XOM
- **Renewal**: 5 XOM annually
- **Transfer**: 1 XOM

### Revenue Distribution
- 50% - Burn (deflationary mechanism)
- 30% - Development fund
- 20% - Validator rewards

## Security Considerations

### Ownership Protection
```typescript
interface NameOwnership {
  owner: string;           // Current owner address
  registeredAt: number;    // Registration timestamp
  expiresAt: number;       // Expiration timestamp
  transferLock: number;    // Transfer cooldown period
}
```

### Anti-Squatting Measures
1. **Registration Fees** - Economic barrier to mass registration
2. **Use-it-or-lose-it** - Names without activity forfeit after 2 years
3. **Trademark Protection** - Dispute resolution for brand names
4. **Grace Period** - 90-day renewal grace period

### Smart Contract Security
- Multi-sig admin controls
- Upgrade proxy pattern
- Comprehensive testing
- Third-party security audit

## Integration with KeyringManager

### Updated Account Structure
```typescript
interface AccountKeys {
  mnemonic: string;
  privateKey: string;
  publicKey: string;
  address: string;
  omniName?: string;        // Registered username.omnicoin
  displayName: string;      // Username or shortened address
}
```

### Name Resolution in Wallet
```typescript
class NameService {
  async sendTransaction(recipient: string, amount: number) {
    // Resolve recipient if it's a name
    let toAddress = recipient;
    if (recipient.endsWith('.omnicoin') || recipient.endsWith('.omni')) {
      toAddress = await this.resolveName(recipient);
      if (!toAddress) {
        throw new Error(`Name not found: ${recipient}`);
      }
    }
    
    // Proceed with transaction
    return await this.wallet.sendTransaction(toAddress, amount);
  }
}
```

## User Experience Flow

### Registration Flow
1. User logs into OmniBazaar wallet
2. Navigates to "Register Username" 
3. Enters desired username
4. System checks availability in real-time
5. Shows registration fee and terms
6. User confirms and pays fee
7. Transaction submitted to blockchain
8. Confirmation and username activation

### Usage Flow
1. User wants to send money to "johnsmith"
2. Types "johnsmith.omnicoin" in recipient field
3. System resolves to actual address
4. Shows confirmation: "Send to John Smith (johnsmith.omnicoin)"
5. User confirms transaction
6. Money sent to resolved address

## Implementation Timeline

### Immediate (Weeks 1-2)
- Smart contract development
- Basic name resolution
- Integration with existing KeyringManager

### Short Term (Weeks 3-6)
- Full wallet integration
- Marketplace username display
- User registration interface

### Medium Term (Weeks 7-12)
- Advanced features (subdomains, multi-chain)
- Mobile app integration
- Social features

### Long Term (3-6 months)
- ENS compatibility bridge
- Cross-chain name resolution
- Decentralized governance

## Success Metrics

### Adoption Metrics
- Number of registered names
- Daily active name resolutions
- Transaction volume using names vs addresses

### User Experience Metrics
- Reduced transaction errors
- User satisfaction scores
- Support ticket reduction

### Economic Metrics
- Registration fee revenue
- Secondary market volume
- Name renewal rates

## Risk Mitigation

### Technical Risks
- **Smart contract bugs**: Comprehensive testing and audits
- **Network congestion**: Layer 2 scaling solutions
- **Cache synchronization**: Robust caching strategy

### Economic Risks
- **Low adoption**: Competitive pricing and incentives
- **Name squatting**: Anti-squatting mechanisms
- **Market manipulation**: Transparent auction system

### Regulatory Risks
- **Trademark disputes**: Clear dispute resolution process
- **Compliance**: Legal review of naming system
- **International law**: Multi-jurisdiction compliance

## Conclusion

The username.omnicoin addressing system will significantly improve user experience by providing familiar, human-readable addresses while maintaining the security and decentralization of blockchain technology. The phased implementation approach allows for iterative development and risk mitigation while building toward a comprehensive naming system that enhances the entire OmniBazaar ecosystem.