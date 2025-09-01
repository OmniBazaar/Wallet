# Transaction Decoding for Marketplace Safety

Created: 2025-08-31  
Owner: OmniWallet

## Executive Summary

Decode OmniBazaar-related transactions into clear, human-readable summaries and risk assessments to reduce scam transactions and increase user confidence. The solution reuses existing ABIs, explorer services, and validator data wherever possible, and integrates decoded results into Wallet and Bazaar UIs.

## Goals

- Decode marketplace transactions (listing, purchase, escrow, NFT actions, approvals, pXOM privacy flows).
- Show contract verification status and privacy notes.
- Compute deterministic risk assessments and flag issues with severity.
- Persist decoded metadata with transactions (no DB schema changes required).

## Scope

- Phase A (Client/Wallet): Client-side decoder + UI integration in Wallet (Vue) with persistence via TransactionDatabase.
- Phase B (Server/Validator): Add shared decode endpoint in Validator Explorer API with caching for reuse across Wallet and Bazaar. Bazaar UI consumes server endpoint with Wallet-side fallback.

## Design Overview

- Decoder composes:
  - ABI decoding: `ethers.Interface` using existing contract ABIs (Marketplace, Escrow, pXOM, NFT, DEX).
  - Contract verification: mark “verified” if address is a known network contract; extend with artifact-backed verification from Validator indexer.
  - Risk scoring: deterministic, explainable heuristics producing flags and a 0–100 score mapped to low/medium/high.
  - Privacy detection: identify pXOM operations, encrypted transfers, and warn about dispute/traceability limitations.
- Persistence: Store `{ decoded, risk }` in `metadata` for the transaction record via `TransactionDatabase` (no schema change).
- UI: Render a concise human-readable summary, verification badge, fee breakdown, and risk badges.

## Integration Touchpoints (Reused Components)

- ABIs and contracts: `Bazaar/src/config/wallet.config.ts` (`CONTRACT_ABIS`, network contract addresses).
- Wallet explorer: `Wallet/src/services/BlockExplorerService.ts` (fetch tx/address when needed).
- Wallet storage: `Wallet/src/services/database/TransactionDatabase.ts` (metadata field for decoded output and risk).
- Validator explorer core: `Validator/src/api/ExplorerController.ts`, `Validator/src/services/explorer/BlockExplorerService.ts`.
- Event/ABI utilities (server): `Validator/src/indexing/OmniEventIndexer.ts` (artifact loading, event decode support).

## Phase A — Wallet (Client) Implementation

1) Decoder module

File: `Wallet/src/core/decoder/OmniTransactionDecoder.ts`

- Public API

```ts
export interface DecodeInput {
  to: string;
  value: string;            // wei (as string)
  data?: string;            // calldata
  logs?: Array<{           // optional logs for post-tx decode
    address: string;
    topics: string[];
    data: string;
  }>;
  network: 'omnicoin-mainnet' | 'omnicoin-testnet' | 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | string;
}

export type Operation =
  | 'LISTING_CREATE'
  | 'LISTING_PURCHASE'
  | 'ESCROW_CREATE'
  | 'ESCROW_RELEASE'
  | 'ESCROW_DISPUTE'
  | 'ESCROW_REFUND'
  | 'PXOM_PRIVATE_PURCHASE'
  | 'NFT_MINT'
  | 'NFT_TRANSFER'
  | 'APPROVE'
  | 'SET_APPROVAL_FOR_ALL'
  | 'TRANSFER'
  | 'UNKNOWN';

export interface FeeBreakdown {
  expectedTotal?: string;           // wei
  observedTotal?: string;           // wei
  components?: Array<{
    name: 'marketplace' | 'validator' | 'referral' | 'listing' | 'processing' | 'privacy' | string;
    expected?: string;              // wei
    observed?: string;              // wei
  }>;
  delta?: string;                   // observed - expected (wei)
}

export interface VerificationResult {
  status: 'verified' | 'artifact' | 'unverified';
  source: 'network-config' | 'artifact-indexer' | 'none';
  notes?: string;
}

export interface RiskFlag {
  code:
    | 'UNKNOWN_CONTRACT'
    | 'UNLIMITED_APPROVAL'
    | 'SUSPICIOUS_APPROVAL_FOR_ALL'
    | 'FEE_MISMATCH'
    | 'ESCROW_SEQUENCE_ANOMALY'
    | 'UNVERIFIED_NFT'
    | 'PRIVACY_LIMITATIONS'
    | 'LARGE_VALUE_OUTLIER';
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export interface RiskAssessment {
  score: number;              // 0–100 (higher = riskier)
  level: 'low' | 'medium' | 'high';
  flags: RiskFlag[];
}

export interface DecodedTransaction {
  operation: Operation;
  summary: string;            // Human-readable sentence
  params: Record<string, unknown>;
  fees?: FeeBreakdown;
  privacy?: { isPrivate: boolean; notes?: string };
  verification: VerificationResult;
  risk: RiskAssessment;
}

export interface OmniTransactionDecoder {
  decode(input: DecodeInput): Promise<DecodedTransaction>;
}
```

- Implementation notes
  - Build an ABI registry by importing ABIs and addresses from `Bazaar/src/config/wallet.config.ts`.
  - Identify function selectors; decode calldata via `new ethers.Interface(abi).parseTransaction`.
  - Parse logs when provided (post-tx); fallback to calldata-only (pre-sign preview).
  - Compute verification (see Verification Strategy below).
  - Compute risk score and flags (see Risk Rules below).
  - Optionally call Validator endpoint `/api/fees/calculate` to cross-check expected fees (gracefully optional in Phase A).

2) Persistence

- On successful decode, attach `{ decoded, risk }` to the transaction’s `metadata` field via `TransactionDatabase.storeTransaction()` or `updateTransactionStatus()` workflows.

3) Wallet UI integration (Vue)

- Components:
  - `Wallet/src/components/transaction/DecodedSummary.vue`
    - Props: `{ decoded: DecodedTransaction }`
    - Renders: summary line, key params, verification badge, risk badges, fee chips, privacy note.
  - `Wallet/src/components/transaction/RiskBadges.vue`
    - Maps flags and level to color-coded chips.
- Injection points:
  - `Wallet/src/components/transaction/TransactionFlow.vue`
    - Pre-sign: call decoder with `{ to, value, data, network }` and display preview.
    - Post-send success: if hash available, refetch via `BlockExplorerService` (if configured) to include logs; update decoded output in metadata.
  - `Wallet/src/popup/pages/Home.vue` → “Recent Activity”
    - On click of a tx: open a detail modal using `DecodedSummary.vue`.

## Phase B — Validator (Server) Implementation

1) REST API

- New endpoints (non-breaking):
  - `GET /api/explorer/transaction/:txId/decoded` → `DecodedTransaction` + `sources` (caching applied).
  - Optional: `GET /api/explorer/contract/:address/verification` → `VerificationResult` detail.

2) Service layer

- Extend `Validator/src/services/explorer/BlockExplorerService.ts` with:
  - Shared ABI Interface registry (reuse event indexer artifact loader when available).
  - Decode calldata and logs using `ethers.Interface`.
  - Verification: mark `verified` if address is in known network contracts; mark `artifact` if ABI artifact loaded for this address in the indexer; else `unverified`.
  - Risk scoring mirrors client heuristics to ensure consistent results for all consumers.
  - Cache decoded results (TTL: 1h) via existing caching helpers.

3) Controller

- Add handler in `Validator/src/api/ExplorerController.ts` to return `DecodedTransaction`.

4) Bazaar UI

- `Bazaar/src/pages/wallet/TransactionHistoryPage.tsx`
  - On row expand/details: call the Validator decode endpoint first; fallback to client decode if unavailable.
  - Render summary, verification badge, risk badges, fee/privacy details using a small reusable component (e.g., `DecodedTx.tsx`).

## Verification Strategy

- `verified` (network-config): address matches known deployed contract for current network (Marketplace, Escrow, PXOM, NFT, DEX).
- `artifact`: ABI artifact is present in the indexer for the address (server-side only, using `OmniEventIndexer`).
- `unverified`: neither condition met.

## Risk Rules (Initial)

- High
  - `UNLIMITED_APPROVAL`: ERC-20 approve of max uint256.
  - `SUSPICIOUS_APPROVAL_FOR_ALL`: ERC-721/1155 `setApprovalForAll(true)`.
  - `UNKNOWN_CONTRACT`: marketplace-like call to unverified contract.
- Medium
  - `FEE_MISMATCH`: observed vs expected discrepancy > 1% of amount.
  - `ESCROW_SEQUENCE_ANOMALY`: release/dispute/refund without expected prior state in tx logs.
- Low
  - `UNVERIFIED_NFT`: listing or transfer references an NFT contract not marked verified.
  - `PRIVACY_LIMITATIONS`: pXOM/private transfer – show caveats and fees.
  - `LARGE_VALUE_OUTLIER`: unusually large vs user historical median.

Scoring: each flag adds weighted points; clamp to 0–100; map to levels: 0–29 low, 30–69 medium, 70–100 high.

## Data Contracts (TypeScript)

```ts
export interface DecodedTransaction {
  operation: Operation;
  summary: string;
  params: Record<string, unknown>;
  fees?: FeeBreakdown;
  privacy?: { isPrivate: boolean; notes?: string };
  verification: VerificationResult;
  risk: RiskAssessment;
}

export interface RiskAssessment {
  score: number;               // 0–100
  level: 'low' | 'medium' | 'high';
  flags: RiskFlag[];
}

export interface RiskFlag {
  code: 'UNKNOWN_CONTRACT' | 'UNLIMITED_APPROVAL' | 'SUSPICIOUS_APPROVAL_FOR_ALL' | 'FEE_MISMATCH' | 'ESCROW_SEQUENCE_ANOMALY' | 'UNVERIFIED_NFT' | 'PRIVACY_LIMITATIONS' | 'LARGE_VALUE_OUTLIER';
  severity: 'low' | 'medium' | 'high';
  message: string;
}
```

## Performance & Caching

- Client: decode on-demand; store result in transaction `metadata` to avoid recomputation.
- Server: cache decoded responses by tx hash (TTL 1h) with existing cache helpers.
- No changes to DB schema; only `metadata` payload stored/updated.

## Security & Privacy Considerations

- No private keys exposed; decode purely informational.
- pXOM: clearly state privacy properties and trade-offs in UI; do not attempt to de-anonymize.
- Avoid logging sensitive user data in production.

## Rollout & Feature Flags

- Feature flag: `transactionDecoding` in Wallet and Bazaar.
- Phase A (Wallet) first for immediate value, then Phase B (Validator + Bazaar).
- Graceful fallback when server endpoint is unavailable.

## Acceptance Criteria

- 95%+ of marketplace transactions decode to a correct operation with accurate summary.
- All approvals and pXOM operations flagged appropriately.
- Risk score present with at least one flag where applicable.
- UI shows verification status and risk badges without UI regressions.

## Out of Scope (Initial)

- ML-based anomaly detection (future iteration).
- Cross-chain bridge messages decoding beyond what’s already supported.
- Full formal verification of contracts.

## Open Questions for Review

1) Shared ABIs: OK to extract `CONTRACT_ABIS` + network contract addresses into a small shared module (e.g., `config/shared/contracts.ts`) consumed by Wallet and Validator, instead of cross-importing from Bazaar?
2) Verification source of truth: Should `verified` include both “known network contract” and “artifact present in indexer,” or only the former?
3) Fee checks: Can we rely on `POST /api/fees/calculate` in Validator as the canonical expected fee calculator for marketplace operations?
4) Primary consumer: Should Bazaar always use the new Validator decode endpoint and keep Wallet’s client decode as a fallback only?
5) Any additional high-risk patterns you want flagged (e.g., specific malicious selectors or addresses)?

## Appendix — Representative Decoding Scenarios

- Listing purchase (XOM):
  - Summary: “Purchasing ‘Cool NFT’ from alice.omnicoin for 100 XOM; 3% fee to ODDAO + validators.”
  - Operation: `LISTING_PURCHASE`.
  - Fees: compute expected via fee engine vs observed gas/outputs.
  - Risk: low if verified contract and fees match.

- Private purchase (pXOM):
  - Summary: “Private purchase of listing L-123 for 100 pXOM (privacy fees applied).”
  - Operation: `PXOM_PRIVATE_PURCHASE`.
  - Privacy: `isPrivate: true`, notes about dispute/evidence limits.

- Escrow release:
  - Detect via Escrow events/logs; verify milestone/order sequencing; warn if anomaly.

- Unlimited approval:
  - `approve(spender, 2^256−1)` → high risk with clear “unlimited approval” warning and spender address.

---

If approved, I’ll implement Phase A (Wallet decoder + UI + persistence), then Phase B (Validator endpoint + Bazaar integration) as described above.
