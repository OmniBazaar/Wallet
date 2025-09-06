export interface GraphQLRequest {
  query?: unknown;
  mutation?: unknown;
  variables?: Record<string, unknown>;
}

export class ValidatorClient {
  protected endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async initialize(): Promise<void> {
    // Optionally perform a health check
    return;
  }

  async disconnect(): Promise<void> {
    return;
  }

  getBlockchain() {
    // Lazy import to prevent circulars
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OmniCoinBlockchain } = require('../services/blockchain/OmniCoinBlockchain');
    return new OmniCoinBlockchain({ rpcUrl: this.endpoint });
  }

  getFeeDistribution() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { FeeDistributionEngine } = require('../services/fees/FeeDistributionEngine');
    return new FeeDistributionEngine();
  }

  getStorage() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { IPFSStorageNetwork } = require('../services/storage/IPFSStorageNetwork');
    return new IPFSStorageNetwork();
  }

  async query(request: GraphQLRequest): Promise<{ data: any }> {
    const res = await fetch(this.endpoint + '/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: request.query, variables: request.variables })
    });
    const data = await res.json();
    return { data };
  }

  async mutate(request: GraphQLRequest): Promise<{ data: any }> {
    const res = await fetch(this.endpoint + '/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: request.mutation, variables: request.variables })
    });
    const data = await res.json();
    return { data };
  }
}

export default ValidatorClient;
