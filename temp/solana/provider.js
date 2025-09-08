"use strict";
/**
 * Solana Provider
 * Full Solana ecosystem support including SPL tokens and NFTs
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolanaProvider = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const base_provider_1 = require("../base-provider");
const bs58_1 = __importDefault(require("bs58"));
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const networks_1 = require("./networks");
/**
 * Solana blockchain provider for wallet operations
 */
class SolanaProvider extends base_provider_1.BaseProvider {
    /**
     * Initialize Solana provider with network configuration
     * @param config - Network configuration including RPC URL and optional commitment level
     */
    constructor(config) {
        super(config);
        this.commitment = config?.commitment || 'confirmed';
        this.initConnection();
    }
    /**
     * Initialize the connection (separated for testing)
     */
    initConnection() {
        try {
            this.connection = new web3_js_1.Connection(this.config.rpcUrl, {
                commitment: this.commitment,
                ...(this.config.wsUrl && { wsEndpoint: this.config.wsUrl }),
            });
        }
        catch (error) {
            // Connection initialization failed - likely in test environment
            // Operations requiring connection will throw appropriate errors
        }
    }
    /**
     * Get the connection, throwing error if not initialized
     */
    getConnection() {
        if (!this.connection) {
            throw new Error('Solana connection not initialized');
        }
        return this.connection;
    }
    /**
     * Get account from private key
     * @param privateKey
     */
    async getAccount(privateKey) {
        const keypair = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(privateKey));
        return {
            address: keypair.publicKey.toBase58(),
            publicKey: keypair.publicKey.toBase58()
        };
    }
    /**
     * Get SOL balance in SOL units (not lamports)
     * @param address - Solana wallet address
     * @returns Balance in SOL as string
     */
    async getBalance(address) {
        const publicKey = new web3_js_1.PublicKey(address);
        const balance = await this.getConnection().getBalance(publicKey);
        return (balance / web3_js_1.LAMPORTS_PER_SOL).toString();
    }
    /**
     * Get formatted balance in SOL
     * @param address
     */
    async getFormattedBalance(address) {
        const balance = await this.getBalance(address);
        const sol = parseInt(balance) / web3_js_1.LAMPORTS_PER_SOL;
        return `${sol.toFixed(9)} SOL`;
    }
    /**
     * Get SPL token balances with metadata
     * @param address - Wallet address
     * @returns Array of SPL tokens with enriched metadata
     */
    async getTokenBalances(address) {
        const publicKey = new web3_js_1.PublicKey(address);
        const tokenAccounts = await this.getConnection().getParsedTokenAccountsByOwner(publicKey, { programId: spl_token_1.TOKEN_PROGRAM_ID });
        const tokens = [];
        for (const { pubkey, account } of tokenAccounts.value) {
            const parsedData = account.data;
            const tokenInfo = parsedData.parsed.info;
            // Find metadata for known tokens
            const popularToken = Object.values(networks_1.POPULAR_SPL_TOKENS).find((pt) => pt.mint === tokenInfo.mint);
            tokens.push({
                mint: tokenInfo.mint,
                address: pubkey.toBase58(),
                amount: tokenInfo.tokenAmount.amount,
                decimals: tokenInfo.tokenAmount.decimals,
                uiAmount: tokenInfo.tokenAmount.uiAmount,
                ...(popularToken && {
                    symbol: popularToken.symbol,
                    name: popularToken.name,
                    logoURI: popularToken.logoURI
                })
            });
        }
        return tokens;
    }
    /**
     * Get all token balances including SOL
     * @param address
     */
    async getAllBalances(address) {
        const publicKey = new web3_js_1.PublicKey(address);
        // Get SOL balance
        const solBalance = await this.getConnection().getBalance(publicKey);
        // Get SPL token balances
        const tokenBalances = await this.getTokenBalances(address);
        const balances = [
            {
                address: publicKey.toBase58(),
                lamports: solBalance,
                decimals: 9,
                mint: 'So11111111111111111111111111111111111111112', // SOL mint
                uiAmount: solBalance / web3_js_1.LAMPORTS_PER_SOL,
            }
        ];
        // Add SPL tokens
        for (const token of tokenBalances) {
            balances.push({
                address: token.address,
                lamports: parseInt(token.amount),
                decimals: token.decimals,
                mint: token.mint,
                uiAmount: parseInt(token.amount) / Math.pow(10, token.decimals),
            });
        }
        return balances;
    }
    /**
     * Build transaction
     * @param transaction
     */
    async buildTransaction(transaction) {
        const tx = new web3_js_1.Transaction();
        // Add fee payer
        if (transaction.feePayer) {
            tx.feePayer = new web3_js_1.PublicKey(transaction.feePayer);
        }
        // Add recent blockhash
        if (!transaction.recentBlockhash) {
            const { blockhash } = await this.getConnection().getLatestBlockhash();
            tx.recentBlockhash = blockhash;
        }
        else {
            tx.recentBlockhash = transaction.recentBlockhash;
        }
        // Add instructions
        if (transaction.instructions) {
            transaction.instructions.forEach(instruction => {
                tx.add(instruction);
            });
        }
        return tx;
    }
    /**
     * Sign transaction
     * @param privateKey
     * @param transaction
     */
    async signTransaction(privateKey, transaction) {
        const keypair = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(privateKey));
        // Build SOL transfer transaction
        const tx = new web3_js_1.Transaction();
        const { blockhash } = await this.getConnection().getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = keypair.publicKey;
        // Add transfer instruction
        tx.add(web3_js_1.SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: new web3_js_1.PublicKey(transaction.to),
            lamports: parseInt(transaction.value || '0'),
        }));
        // Sign transaction
        tx.sign(keypair);
        // Serialize to base58
        return bs58_1.default.encode(tx.serialize());
    }
    /**
     * Send transaction
     * @param signedTransaction
     */
    async sendTransaction(signedTransaction) {
        const transaction = web3_js_1.Transaction.from(bs58_1.default.decode(signedTransaction));
        const signature = await this.getConnection().sendRawTransaction(transaction.serialize());
        // Wait for confirmation
        await this.getConnection().confirmTransaction(signature, this.commitment);
        return signature;
    }
    /**
     * Send SOL to another address
     * @param privateKey - Sender's private key in base58 format
     * @param to - Recipient's address
     * @param amount - Amount in SOL (not lamports)
     * @returns Transaction signature
     */
    async sendSOL(privateKey, to, amount) {
        if (amount <= 0 || isNaN(amount)) {
            throw new Error('Invalid amount');
        }
        const keypair = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(privateKey));
        const transaction = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: new web3_js_1.PublicKey(to),
            lamports: Math.floor(amount * web3_js_1.LAMPORTS_PER_SOL),
        }));
        const signature = await (0, web3_js_1.sendAndConfirmTransaction)(this.getConnection(), transaction, [keypair], { commitment: this.commitment });
        return signature;
    }
    /**
     * Send SPL token to another address
     * @param privateKey - Sender's private key in base58 format
     * @param to - Recipient's address
     * @param mint - Token mint address
     * @param amount - Amount in token units (not raw amount)
     * @param decimals - Token decimals
     * @returns Transaction signature
     */
    async sendToken(privateKey, to, mint, amount, decimals) {
        if (amount <= 0 || isNaN(amount)) {
            throw new Error('Invalid amount');
        }
        const keypair = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(privateKey));
        const fromPubkey = keypair.publicKey;
        const toPubkey = new web3_js_1.PublicKey(to);
        const mintPubkey = new web3_js_1.PublicKey(mint);
        // Get associated token accounts
        const fromTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintPubkey, fromPubkey);
        const toTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintPubkey, toPubkey);
        const transaction = new web3_js_1.Transaction();
        // Check if recipient token account exists
        try {
            await (0, spl_token_1.getAccount)(this.getConnection(), toTokenAccount);
        }
        catch (error) {
            // Create associated token account for recipient
            transaction.add((0, spl_token_1.createAssociatedTokenAccountInstruction)(fromPubkey, toTokenAccount, toPubkey, mintPubkey));
        }
        // Add transfer instruction
        transaction.add((0, spl_token_1.createTransferInstruction)(fromTokenAccount, toTokenAccount, fromPubkey, BigInt(Math.floor(amount * Math.pow(10, decimals)))));
        const signature = await (0, web3_js_1.sendAndConfirmTransaction)(this.getConnection(), transaction, [keypair], { commitment: this.commitment });
        return signature;
    }
    /**
     * Get transaction details
     * @param txHash
     */
    async getTransaction(txHash) {
        const transaction = await this.getConnection().getParsedTransaction(txHash, {
            commitment: this.commitment,
        });
        if (!transaction) {
            throw new Error('Transaction not found');
        }
        const meta = transaction.meta;
        const instructions = transaction.transaction.message.instructions;
        // Find transfer instruction
        let from = '';
        let to = '';
        let value = '0';
        for (const instruction of instructions) {
            if ('parsed' in instruction && instruction.parsed) {
                if (instruction.parsed.type === 'transfer') {
                    from = instruction.parsed.info.source;
                    to = instruction.parsed.info.destination;
                    value = instruction.parsed.info.lamports?.toString() || '0';
                    break;
                }
            }
        }
        return {
            hash: txHash,
            from,
            to,
            value,
            fee: meta?.fee?.toString() || '0',
            status: meta?.err ? 'failed' : 'confirmed',
            blockNumber: transaction.slot,
            timestamp: transaction.blockTime || undefined,
        };
    }
    /**
     * Get transaction history
     * @param address
     * @param limit
     */
    async getTransactionHistory(address, limit) {
        const publicKey = new web3_js_1.PublicKey(address);
        const signatures = await this.getConnection().getSignaturesForAddress(publicKey, { limit: limit || 20 });
        const transactions = [];
        for (const sig of signatures) {
            try {
                const tx = await this.getTransaction(sig.signature);
                transactions.push(tx);
            }
            catch (error) {
                console.error('Error fetching transaction:', error);
            }
        }
        return transactions;
    }
    /**
     * Subscribe to new blocks
     * @param callback
     */
    async subscribeToBlocks(callback) {
        const connection = this.getConnection();
        const subscription = connection.onSlotChange((slotInfo) => {
            callback(slotInfo.slot);
        });
        return () => {
            connection.removeSlotChangeListener(subscription);
        };
    }
    /**
     * Sign message
     * @param privateKey
     * @param message
     */
    async signMessage(privateKey, message) {
        const keypair = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(privateKey));
        const messageBytes = new TextEncoder().encode(message);
        const signature = tweetnacl_1.default.sign.detached(messageBytes, keypair.secretKey);
        return bs58_1.default.encode(signature);
    }
    /**
     * Get rent exemption amount
     * @param dataLength
     */
    async getRentExemption(dataLength = 0) {
        return await this.getConnection().getMinimumBalanceForRentExemption(dataLength);
    }
    /**
     * Airdrop SOL (testnet/devnet only)
     * @param address
     * @param amount
     */
    async airdrop(address, amount = 1) {
        const publicKey = new web3_js_1.PublicKey(address);
        const signature = await this.getConnection().requestAirdrop(publicKey, amount * web3_js_1.LAMPORTS_PER_SOL);
        await this.getConnection().confirmTransaction(signature, this.commitment);
        return signature;
    }
    /**
     * Switch to a different network
     * @param config New network configuration
     */
    switchNetwork(config) {
        this.config = config;
        this.commitment = config.commitment || 'confirmed';
        this.initConnection();
    }
    /**
     * Get recent blockhash for transaction construction
     * @returns Recent blockhash string
     */
    async getRecentBlockhash() {
        const { blockhash } = await this.getConnection().getLatestBlockhash();
        return blockhash;
    }
    /**
     * Get network details including explorer URL and native currency info
     * @returns Network details object
     */
    getNetworkDetails() {
        const config = this.getConfig();
        return {
            name: config.name,
            chainId: config.chainId,
            rpcUrl: config.rpcUrl,
            explorer: config.blockExplorerUrls?.[0] || 'https://explorer.solana.com',
            nativeCurrency: {
                name: 'Solana',
                symbol: 'SOL',
                decimals: 9
            }
        };
    }
    /**
     * Estimate transaction fee in SOL
     * @returns Estimated fee in SOL as string
     */
    async estimateFee() {
        try {
            // Get recent blockhash and fee calculator
            const { blockhash, lastValidBlockHeight } = await this.getConnection().getLatestBlockhash();
            // Create a simple transfer transaction to estimate fees
            const transaction = new web3_js_1.Transaction();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = new web3_js_1.PublicKey('11111111111111111111111111111111'); // System program
            transaction.add(web3_js_1.SystemProgram.transfer({
                fromPubkey: new web3_js_1.PublicKey('11111111111111111111111111111111'),
                toPubkey: new web3_js_1.PublicKey('11111111111111111111111111111111'),
                lamports: 1,
            }));
            // Get fee for this transaction
            const fee = await this.getConnection().getFeeForMessage(transaction.compileMessage(), this.commitment);
            if (fee && fee.value !== null) {
                return (fee.value / web3_js_1.LAMPORTS_PER_SOL).toString();
            }
            // Default fee if unable to calculate
            return '0.000005';
        }
        catch (error) {
            // Return default fee on error
            return '0.000005';
        }
    }
    /**
     * Get popular token information by symbol
     * @param symbol - Token symbol (e.g., 'USDC')
     * @returns Token info or null if not found
     */
    getPopularTokenInfo(symbol) {
        const token = networks_1.POPULAR_SPL_TOKENS[symbol];
        return token ? {
            mint: token.mint,
            decimals: token.decimals,
            symbol: token.symbol,
            name: token.name
        } : null;
    }
    /**
     * Get all SPL tokens for an address with metadata
     * @param address - Wallet address
     * @returns Array of SPL tokens with enriched metadata
     */
    async getAllSPLTokens(address) {
        // This method is an alias for getTokenBalances which already enriches metadata
        return this.getTokenBalances(address);
    }
}
exports.SolanaProvider = SolanaProvider;
