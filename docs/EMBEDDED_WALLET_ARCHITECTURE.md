# OmniBazaar Embedded Wallet Architecture

**Created:** 2025-08-06  
**Purpose:** Enable browser-based wallet access without requiring extension installation

## Executive Summary

This document outlines the architecture for implementing an embedded wallet solution in OmniBazaar that allows users to access full wallet functionality through a web browser without installing an extension, while still offering the extension as an enhanced option for power users.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User Access Methods                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐        ┌──────────────┐                   │
│  │   Extension  │        │   Browser    │                   │
│  │   (Optional) │        │  (Required)  │                   │
│  └──────┬───────┘        └──────┬───────┘                   │
│         │                        │                           │
│         ▼                        ▼                           │
│  ┌──────────────────────────────────────────┐               │
│  │        Unified Wallet Interface          │               │
│  └──────────────────────────────────────────┘               │
│         │                        │                           │
│         ▼                        ▼                           │
│  ┌──────────────┐        ┌──────────────┐                   │
│  │  Direct API  │        │   Embedded   │                   │
│  │   (Extension)│        │    iframe    │                   │
│  └──────────────┘        └──────────────┘                   │
│                                  │                           │
│                                  ▼                           │
│                    ┌──────────────────────┐                 │
│                    │   PostMessage API    │                 │
│                    └──────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Authentication Layer

#### Social Login Options
- **Email OTP**: One-time password sent to email
- **SMS Verification**: Phone number authentication
- **OAuth Providers**: Google, Apple, GitHub
- **Passkeys/WebAuthn**: Biometric authentication
- **Legacy Username/Password**: For existing OmniCoin users

#### Implementation
```typescript
interface AuthProvider {
  type: 'email' | 'sms' | 'oauth' | 'passkey' | 'legacy';
  authenticate(): Promise<AuthSession>;
  recover(): Promise<RecoveryOptions>;
}
```

### 2. Key Management System

#### Multi-Party Computation (MPC)
- Split key generation across multiple parties
- No single point of failure
- Keys never exist in complete form

#### Key Storage Strategy
```typescript
interface KeyStorage {
  // Device-specific shard (encrypted in IndexedDB)
  deviceShard: EncryptedShard;
  
  // Server shard (stored by validators)
  serverShard: ServerShard;
  
  // Recovery shard (social recovery or backup)
  recoveryShard: RecoveryShard;
}
```

### 3. Embedded Wallet iframe

#### iframe Architecture
```html
<!-- Host page (marketplace.omnibazaar.com) -->
<iframe 
  id="omniwallet-iframe"
  src="https://wallet.omnibazaar.com/embed"
  allow="publickey-credentials-get; publickey-credentials-create"
  sandbox="allow-scripts allow-same-origin allow-forms"
/>
```

#### PostMessage Communication
```typescript
// Parent window (marketplace)
window.postMessage({
  type: 'WALLET_REQUEST',
  method: 'eth_requestAccounts',
  params: [],
  id: uuid()
}, 'https://wallet.omnibazaar.com');

// iframe (wallet)
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://marketplace.omnibazaar.com') return;
  // Process wallet request
});
```

### 4. Security Model

#### Content Security Policy
```typescript
const CSP_HEADERS = {
  'Content-Security-Policy': `
    default-src 'self';
    frame-ancestors https://*.omnibazaar.com;
    connect-src https://api.omnibazaar.com wss://ws.omnibazaar.com;
    script-src 'self' 'unsafe-inline';
  `
};
```

#### Permission Policy
```typescript
const PERMISSION_POLICY = {
  'Permissions-Policy': `
    publickey-credentials-get=(self "https://*.omnibazaar.com"),
    publickey-credentials-create=(self "https://*.omnibazaar.com")
  `
};
```

## Implementation Steps

### Phase 1: Core Infrastructure (Week 1-2)

1. **Create Embedded Wallet Service**
   ```typescript
   class EmbeddedWalletService {
     async initialize(authMethod: AuthProvider): Promise<Wallet>;
     async signTransaction(tx: Transaction): Promise<SignedTx>;
     async exportWallet(): Promise<never>; // Disabled for security
   }
   ```

2. **Implement MPC Key Generation**
   ```typescript
   class MPCKeyManager {
     async generateShards(): Promise<KeyShards>;
     async reconstructKey(shards: Partial<KeyShards>): Promise<PrivateKey>;
     async signWithShards(message: string): Promise<Signature>;
   }
   ```

3. **Build iframe Provider**
   ```typescript
   class IframeWalletProvider implements EIP1193Provider {
     async request(args: RequestArguments): Promise<unknown>;
     on(event: string, listener: Function): void;
     removeListener(event: string, listener: Function): void;
   }
   ```

### Phase 2: Authentication Integration (Week 2-3)

1. **Social Login Providers**
   - Google OAuth integration
   - Apple Sign-In
   - Email OTP system
   - SMS verification

2. **Passkey/WebAuthn Support**
   ```typescript
   class PasskeyAuth {
     async register(): Promise<Credential>;
     async authenticate(): Promise<AuthAssertion>;
     async linkToWallet(walletId: string): Promise<void>;
   }
   ```

3. **Session Management**
   ```typescript
   class SessionManager {
     async createSession(auth: AuthResult): Promise<Session>;
     async refreshSession(token: string): Promise<Session>;
     async revokeSession(sessionId: string): Promise<void>;
   }
   ```

### Phase 3: User Experience (Week 3-4)

1. **Seamless Onboarding Flow**
   ```typescript
   // One-click wallet creation
   const wallet = await OmniWallet.create({
     auth: { type: 'email', address: 'user@example.com' },
     network: 'omnichain',
     autoBackup: true
   });
   ```

2. **Transaction Signing UI**
   - In-browser confirmation modal
   - Transaction details display
   - Gas estimation
   - Security warnings

3. **Wallet Management Dashboard**
   - Balance display
   - Transaction history
   - Settings management
   - Recovery options

## Comparison: Extension vs Embedded

| Feature | Extension | Embedded (Browser) |
|---------|-----------|-------------------|
| **Installation** | Required | Not required |
| **Performance** | Faster | Slightly slower (iframe overhead) |
| **Security** | Direct key access | MPC split keys |
| **UX** | Power user focused | Consumer friendly |
| **Recovery** | Seed phrase | Social recovery |
| **Cross-site** | Works everywhere | Same-origin limits |
| **Offline** | Supported | Not supported |
| **Hardware wallet** | Full support | Limited support |

## Security Considerations

### Threat Model
1. **XSS Attacks**: Mitigated by CSP and iframe isolation
2. **Phishing**: Domain validation and origin checks
3. **Key Extraction**: MPC prevents complete key access
4. **Session Hijacking**: Short-lived tokens with refresh
5. **Man-in-the-Middle**: TLS pinning and certificate validation

### Best Practices
- Never store complete private keys
- Use secure enclaves where available
- Implement rate limiting
- Monitor for anomalous behavior
- Regular security audits

## Migration Path

### For New Users
1. Visit marketplace.omnibazaar.com
2. Click "Create Wallet" 
3. Choose authentication method (email/social)
4. Wallet created automatically
5. Start using immediately

### For Extension Users
1. Extension detected automatically
2. Use extension for enhanced features
3. Seamless switching between methods
4. Shared account across both

### For Legacy Users
1. Use existing migration flow
2. After migration, choose access method
3. Extension optional for power features

## Technical Requirements

### Browser Support
- Chrome 90+ (WebAuthn, Secure Context)
- Firefox 85+ (Cross-origin iframe)
- Safari 15+ (Passkeys support)
- Edge 90+ (Chromium-based)

### Dependencies
```json
{
  "dependencies": {
    "@simplewebauthn/browser": "^8.0.0",
    "@simplewebauthn/server": "^8.0.0",
    "iframe-resizer": "^4.3.0",
    "postmate": "^1.5.0",
    "ethers": "^6.0.0",
    "@noble/curves": "^1.2.0",
    "otpauth": "^9.0.0"
  }
}
```

## Implementation Timeline

| Week | Tasks |
|------|-------|
| 1-2 | Core infrastructure, MPC implementation |
| 2-3 | Authentication providers, session management |
| 3-4 | User interface, onboarding flow |
| 4-5 | Security auditing, penetration testing |
| 5-6 | Beta testing, bug fixes |
| 6+ | Production deployment, monitoring |

## Conclusion

This embedded wallet architecture provides OmniBazaar with:
1. **Lower barrier to entry** - No extension installation required
2. **Familiar authentication** - Email/social login like Web2
3. **Security maintained** - MPC and secure enclaves
4. **Progressive enhancement** - Extension available for power users
5. **Competitive advantage** - Match Coinbase's user experience

The implementation leverages proven technologies (WebAuthn, MPC, iframe isolation) while maintaining compatibility with our existing extension-based wallet for users who prefer that experience.