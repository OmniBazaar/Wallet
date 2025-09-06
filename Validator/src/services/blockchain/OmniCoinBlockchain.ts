export class OmniCoinBlockchain {
  private rpcUrl: string;

  constructor(config: { rpcUrl: string }) {
    this.rpcUrl = config.rpcUrl;
  }

  private async rpc<T>(method: string, params: unknown[] = []): Promise<T> {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    const json = await res.json();
    return json.result as T;
  }

  async sendTransaction(tx: string | { from: string; to: string; value: string; data?: string; gasLimit?: string; gasPrice?: string; nonce?: number }): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      let hash: string;
      if (typeof tx === 'string') {
        hash = await this.rpc<string>('eth_sendRawTransaction', [tx]);
      } else {
        hash = await this.rpc<string>('eth_sendTransaction', [tx]);
      }
      return { success: true, transactionHash: hash };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async getTransaction(txHash: string): Promise<any> {
    return this.rpc<any>('eth_getTransactionByHash', [txHash]);
  }

  async getTransactionReceipt(txHash: string): Promise<any> {
    return this.rpc<any>('eth_getTransactionReceipt', [txHash]);
  }

  async estimateGas(tx: { from: string; to: string; value: string; data?: string }): Promise<string> {
    return this.rpc<string>('eth_estimateGas', [tx]);
  }

  async getGasPrice(): Promise<string> {
    return this.rpc<string>('eth_gasPrice');
  }

  async getFeeData(): Promise<{ maxFeePerGas?: string; maxPriorityFeePerGas?: string }> {
    // Some RPCs support eth_maxPriorityFeePerGas
    const [maxPriorityFee, gasPrice] = await Promise.all([
      (async () => {
        try { return await this.rpc<string>('eth_maxPriorityFeePerGas'); } catch { return undefined; }
      })(),
      this.getGasPrice()
    ]);
    const out: { maxFeePerGas?: string; maxPriorityFeePerGas?: string } = {};
    if (gasPrice) out.maxFeePerGas = gasPrice;
    if (typeof maxPriorityFee !== 'undefined') out.maxPriorityFeePerGas = maxPriorityFee;
    return out;
  }

  async getTransactionCount(address: string): Promise<number> {
    const hex = await this.rpc<string>('eth_getTransactionCount', [address, 'latest']);
    return Number(hex);
  }

  async getBalance(address: string): Promise<string> {
    const hex = await this.rpc<string>('eth_getBalance', [address, 'latest']);
    return hex;
  }

  async getBlockNumber(): Promise<number> {
    const hex = await this.rpc<string>('eth_blockNumber');
    return Number(hex);
  }

  async getTokenList(_address: string): Promise<Array<{ address: string; symbol: string; name: string; decimals: number }>> {
    return [];
  }

  async getTokenBalance(_address: string, _token: string): Promise<string> {
    return '0x0';
  }

  async getTokenPrice(_symbol: string): Promise<string | null> {
    return null;
  }
}

export default OmniCoinBlockchain;
