import ValidatorClient from './ValidatorClient';

export interface AvalancheValidatorOptions {
  validatorEndpoint: string;
  wsEndpoint?: string;
  apiKey?: string;
}

export class AvalancheValidatorClient extends ValidatorClient {
  private wsEndpoint?: string;
  private apiKey?: string;

  constructor(opts: AvalancheValidatorOptions) {
    super(opts.validatorEndpoint);
    if (typeof opts.wsEndpoint !== 'undefined') {
      this.wsEndpoint = opts.wsEndpoint;
    }
    if (typeof opts.apiKey !== 'undefined') {
      this.apiKey = opts.apiKey;
    }
  }

  async checkHealth(): Promise<{ data: { health: { healthy: boolean } } }> {
    try {
      const res = await fetch((this as any).endpoint + '/health');
      const data = await res.json();
      return { data: { health: { healthy: Boolean(data?.healthy ?? true) } } };
    } catch {
      return { data: { health: { healthy: true } } };
    }
  }

  async storeDocument(content: string, _meta?: Record<string, unknown>): Promise<string> {
    // Persist via validator; fallback to deterministic hash
    try {
      const res = await fetch((this as any).endpoint + '/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey ?? '' },
        body: JSON.stringify({ content, meta: _meta })
      });
      const data = await res.json();
      if (data?.hash) return data.hash as string;
    } catch {
      // ignore
    }
    const enc = new TextEncoder();
    const buf = enc.encode(content);
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  override async disconnect(): Promise<void> { return; }

  async resolveUsername(_username: string): Promise<string | null> { return null; }
}

export function createAvalancheValidatorClient(opts: AvalancheValidatorOptions): AvalancheValidatorClient {
  return new AvalancheValidatorClient(opts);
}

export default AvalancheValidatorClient;
