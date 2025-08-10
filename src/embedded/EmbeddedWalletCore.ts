/**
 * Embedded Wallet Core
 * 
 * Core logic for the embedded wallet iframe that handles authentication,
 * key management, transaction signing, and communication with parent window.
 * 
 * @module embedded/EmbeddedWalletCore
 */

import { ethers } from 'ethers';
import { 
    MessageType, 
    WalletMessage, 
    RPCMethod,
    AuthMethod 
} from './EmbeddedWalletProvider';
import { secureStorage } from '../core/storage/SecureIndexedDB';

/**
 * MPC key shard structure
 */
interface KeyShard {
    /** Shard identifier */
    id: string;
    /** Encrypted shard data */
    data: string;
    /** Storage location */
    location: 'device' | 'server' | 'recovery';
}

/**
 * User session data
 */
interface UserSession {
    /** User identifier */
    userId: string;
    /** Authentication method used */
    authMethod: string;
    /** Session token */
    token: string;
    /** Token expiration */
    expiresAt: number;
    /** User's wallet address */
    address?: string;
    /** User's username (if set) */
    username?: string;
}

/**
 * Transaction request
 */
interface TransactionRequest {
    /** Transaction recipient */
    to: string;
    /** Transaction value in wei */
    value?: string;
    /** Transaction data */
    data?: string;
    /** Gas limit */
    gasLimit?: string;
    /** Gas price */
    gasPrice?: string;
    /** Nonce */
    nonce?: number;
}

/**
 * Embedded Wallet Core Implementation
 */
export class EmbeddedWalletCore {
    private allowedOrigins: Set<string>;
    private currentSession: UserSession | null = null;
    private pendingRequests: Map<string, WalletMessage> = new Map();
    private provider: ethers.Provider;
    private keyShards: Map<string, KeyShard> = new Map();
    private currentView: string = 'authView';
    private otpDestination: string = '';
    private otpMethod: 'email' | 'sms' = 'email';
    
    constructor() {
        this.allowedOrigins = new Set([
            'https://marketplace.omnibazaar.com',
            'https://dex.omnibazaar.com',
            'https://wallet.omnibazaar.com',
            'http://localhost:3000', // Development
            'http://localhost:3001'  // Development
        ]);
        
        // Initialize provider (Avalanche mainnet)
        this.provider = new ethers.JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc');
    }
    
    /**
     * Initialize the wallet
     */
    async init(): Promise<void> {
        console.log('Initializing embedded wallet...');
        
        // Check for existing session
        const savedSession = this.loadSession();
        if (savedSession && savedSession.expiresAt > Date.now()) {
            this.currentSession = savedSession;
            await this.loadWallet();
        } else {
            this.showView('authView');
        }
        
        // Send ready signal to parent
        this.sendMessage({
            type: MessageType.READY,
            id: this.generateId()
        });
    }
    
    /**
     * Handle incoming PostMessage
     */
    handleMessage(event: MessageEvent): void {
        // Validate origin
        if (!this.allowedOrigins.has(event.origin)) {
            console.warn('Rejected message from unauthorized origin:', event.origin);
            return;
        }
        
        const message = event.data as WalletMessage;
        console.log('Received message:', message);
        
        switch (message.type) {
            case MessageType.WALLET_REQUEST:
                this.handleWalletRequest(message);
                break;
                
            case MessageType.CONNECT_WALLET:
                this.handleConnect(message);
                break;
                
            case MessageType.DISCONNECT_WALLET:
                this.handleDisconnect(message);
                break;
                
            case MessageType.AUTH_REQUEST:
                this.handleAuthRequest(message);
                break;
                
            case MessageType.PING:
                this.handlePing(message);
                break;
                
            default:
                console.warn('Unknown message type:', message.type);
        }
    }
    
    /**
     * Handle wallet RPC request
     */
    private async handleWalletRequest(message: WalletMessage): Promise<void> {
        try {
            const { method, params } = message;
            let result: any;
            
            switch (method) {
                case RPCMethod.ETH_ACCOUNTS:
                case RPCMethod.ETH_REQUEST_ACCOUNTS:
                    result = await this.getAccounts();
                    break;
                    
                case RPCMethod.ETH_CHAIN_ID:
                    result = '0xa86a'; // Avalanche C-Chain
                    break;
                    
                case RPCMethod.ETH_SEND_TRANSACTION:
                    result = await this.sendTransaction(params![0]);
                    break;
                    
                case RPCMethod.ETH_SIGN:
                case RPCMethod.PERSONAL_SIGN:
                    result = await this.signMessage(params![0], params![1]);
                    break;
                    
                case RPCMethod.ETH_SIGN_TYPED_DATA_V4:
                    result = await this.signTypedData(params![0], params![1]);
                    break;
                    
                case RPCMethod.OMNI_GET_BALANCE:
                    result = await this.getOmniBalance();
                    break;
                    
                case RPCMethod.OMNI_GET_USERNAME:
                    result = this.currentSession?.username || null;
                    break;
                    
                default:
                    throw new Error(`Method not supported: ${method}`);
            }
            
            this.sendMessage({
                type: MessageType.WALLET_RESPONSE,
                id: message.id,
                result
            });
            
        } catch (error: any) {
            this.sendMessage({
                type: MessageType.WALLET_ERROR,
                id: message.id,
                error: {
                    code: -32603,
                    message: error.message || 'Internal error'
                }
            });
        }
    }
    
    /**
     * Handle authentication request
     */
    private async handleAuthRequest(message: WalletMessage): Promise<void> {
        try {
            const authMethod = message.data as AuthMethod;
            const success = await this.authenticate(authMethod);
            
            this.sendMessage({
                type: MessageType.WALLET_RESPONSE,
                id: message.id,
                result: success
            });
            
        } catch (error: any) {
            this.sendMessage({
                type: MessageType.WALLET_ERROR,
                id: message.id,
                error: {
                    code: -32603,
                    message: error.message || 'Authentication failed'
                }
            });
        }
    }
    
    /**
     * Authenticate user
     */
    private async authenticate(authMethod: AuthMethod): Promise<boolean> {
        console.log('Authenticating with method:', authMethod.type);
        
        switch (authMethod.type) {
            case 'email':
                return this.authenticateWithEmail(authMethod.credential!);
                
            case 'sms':
                return this.authenticateWithPhone(authMethod.credential!);
                
            case 'google':
                return this.authenticateWithGoogle();
                
            case 'passkey':
                return this.authenticateWithPasskey();
                
            case 'legacy':
                return this.authenticateWithLegacy(authMethod.credential!, authMethod.token!);
                
            default:
                throw new Error('Unsupported authentication method');
        }
    }
    
    /**
     * Email authentication
     */
    async authenticateWithEmail(email: string): Promise<boolean> {
        try {
            // Send OTP to email
            const response = await fetch('https://api.omnibazaar.com/auth/email-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            if (!response.ok) {
                throw new Error('Failed to send OTP');
            }
            
            // Store email for OTP verification
            this.otpDestination = email;
            this.otpMethod = 'email';
            
            // Show OTP input view
            this.showView('otpView');
            this.updateOTPDestination(email);
            
            return true;
        } catch (error) {
            console.error('Email authentication error:', error);
            return false;
        }
    }
    
    /**
     * Phone authentication
     */
    async authenticateWithPhone(phone: string): Promise<boolean> {
        try {
            // Send OTP to phone
            const response = await fetch('https://api.omnibazaar.com/auth/sms-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            });
            
            if (!response.ok) {
                throw new Error('Failed to send SMS');
            }
            
            // Store phone for OTP verification
            this.otpDestination = phone;
            this.otpMethod = 'sms';
            
            // Show OTP input view
            this.showView('otpView');
            this.updateOTPDestination(phone);
            
            return true;
        } catch (error) {
            console.error('Phone authentication error:', error);
            return false;
        }
    }
    
    /**
     * Google OAuth authentication
     */
    async authenticateWithGoogle(): Promise<boolean> {
        try {
            // Open OAuth popup
            const width = 500;
            const height = 600;
            const left = (window.innerWidth - width) / 2;
            const top = (window.innerHeight - height) / 2;
            
            const popup = window.open(
                'https://api.omnibazaar.com/auth/google',
                'google-auth',
                `width=${width},height=${height},left=${left},top=${top}`
            );
            
            // Wait for OAuth callback
            return new Promise((resolve) => {
                const checkPopup = setInterval(() => {
                    if (popup?.closed) {
                        clearInterval(checkPopup);
                        // Check if authentication succeeded
                        this.checkAuthStatus().then(resolve);
                    }
                }, 500);
            });
        } catch (error) {
            console.error('Google authentication error:', error);
            return false;
        }
    }
    
    /**
     * Passkey/WebAuthn authentication
     */
    async authenticateWithPasskey(): Promise<boolean> {
        try {
            // Check if WebAuthn is supported
            if (!window.PublicKeyCredential) {
                throw new Error('WebAuthn not supported');
            }
            
            // Get authentication options from server
            const optionsResponse = await fetch('https://api.omnibazaar.com/auth/passkey/options');
            const options = await optionsResponse.json();
            
            // Request passkey authentication
            const credential = await navigator.credentials.get({
                publicKey: options
            });
            
            // Verify with server
            const verifyResponse = await fetch('https://api.omnibazaar.com/auth/passkey/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential })
            });
            
            if (!verifyResponse.ok) {
                throw new Error('Passkey verification failed');
            }
            
            const session = await verifyResponse.json();
            this.setSession(session);
            
            return true;
        } catch (error) {
            console.error('Passkey authentication error:', error);
            return false;
        }
    }
    
    /**
     * Legacy OmniCoin authentication
     */
    async authenticateWithLegacy(username: string, password: string): Promise<boolean> {
        try {
            const response = await fetch('https://api.omnibazaar.com/auth/legacy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            if (!response.ok) {
                throw new Error('Invalid legacy credentials');
            }
            
            const session = await response.json();
            this.setSession(session);
            
            // Check for unclaimed balance
            if (session.legacyBalance && !session.legacyClaimed) {
                this.showLegacyMigration(session.legacyBalance);
            }
            
            return true;
        } catch (error) {
            console.error('Legacy authentication error:', error);
            return false;
        }
    }
    
    /**
     * Verify OTP code
     */
    async verifyOTP(code: string): Promise<boolean> {
        try {
            const endpoint = this.otpMethod === 'email' 
                ? 'https://api.omnibazaar.com/auth/email-otp/verify'
                : 'https://api.omnibazaar.com/auth/sms-otp/verify';
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destination: this.otpDestination,
                    code
                })
            });
            
            if (!response.ok) {
                throw new Error('Invalid OTP');
            }
            
            const session = await response.json();
            this.setSession(session);
            
            return true;
        } catch (error) {
            console.error('OTP verification error:', error);
            return false;
        }
    }
    
    /**
     * Get wallet accounts
     */
    private async getAccounts(): Promise<string[]> {
        if (!this.currentSession?.address) {
            // Need to authenticate first
            this.showView('authView');
            throw new Error('Not authenticated');
        }
        
        return [this.currentSession.address];
    }
    
    /**
     * Send transaction
     */
    private async sendTransaction(tx: TransactionRequest): Promise<string> {
        if (!this.currentSession) {
            throw new Error('Not authenticated');
        }
        
        // Show transaction approval UI
        this.showTransactionApproval(tx);
        
        // Wait for user approval
        return new Promise((resolve, reject) => {
            this.pendingRequests.set('current-tx', {
                type: MessageType.WALLET_REQUEST,
                id: this.generateId(),
                method: RPCMethod.ETH_SEND_TRANSACTION,
                params: [tx]
            });
            
            // Store resolve/reject for later
            (window as any).txResolve = resolve;
            (window as any).txReject = reject;
        });
    }
    
    /**
     * Sign message
     */
    private async signMessage(message: string, account: string): Promise<string> {
        if (!this.currentSession) {
            throw new Error('Not authenticated');
        }
        
        // Reconstruct private key from MPC shards
        const privateKey = await this.reconstructPrivateKey();
        const wallet = new ethers.Wallet(privateKey);
        
        return wallet.signMessage(message);
    }
    
    /**
     * Sign typed data (EIP-712)
     */
    private async signTypedData(account: string, typedData: any): Promise<string> {
        if (!this.currentSession) {
            throw new Error('Not authenticated');
        }
        
        // Reconstruct private key from MPC shards
        const privateKey = await this.reconstructPrivateKey();
        const wallet = new ethers.Wallet(privateKey);
        
        return wallet.signTypedData(
            typedData.domain,
            typedData.types,
            typedData.value
        );
    }
    
    /**
     * Get OMNI token balance
     */
    private async getOmniBalance(): Promise<string> {
        if (!this.currentSession?.address) {
            return '0';
        }
        
        try {
            // Get balance from OmniCoin contract
            const omniCoinAddress = '0x...'; // OmniCoin contract address
            const abi = ['function balanceOf(address) view returns (uint256)'];
            const contract = new ethers.Contract(omniCoinAddress, abi, this.provider);
            
            const balance = await contract.balanceOf(this.currentSession.address);
            return ethers.formatEther(balance);
        } catch (error) {
            console.error('Error getting balance:', error);
            return '0';
        }
    }
    
    /**
     * Reconstruct private key from MPC shards
     */
    private async reconstructPrivateKey(): Promise<string> {
        // This is simplified - actual MPC would never reconstruct full key
        // Instead, signing would happen across multiple parties
        
        // Get device shard from IndexedDB
        const deviceShard = await this.getDeviceShard();
        
        // Get server shard
        const serverShard = await this.getServerShard();
        
        // Combine shards (simplified XOR for demo)
        // Real implementation would use proper MPC protocols
        const privateKey = this.combineShards([deviceShard, serverShard]);
        
        return privateKey;
    }
    
    /**
     * Get device shard from secure storage
     */
    private async getDeviceShard(): Promise<string> {
        // Ensure secure storage is initialized
        if (!secureStorage.isInitialized()) {
            // Use session token as password for auto-unlock
            await secureStorage.initialize(this.currentSession?.token || '');
        }
        
        // Retrieve shard from encrypted IndexedDB
        const shard = await secureStorage.retrieve(`shard_${this.currentSession?.userId}`);
        if (!shard) {
            throw new Error('Device shard not found');
        }
        return shard;
    }
    
    /**
     * Store device shard in secure storage
     */
    private async storeDeviceShard(shard: string): Promise<void> {
        // Ensure secure storage is initialized
        if (!secureStorage.isInitialized()) {
            await secureStorage.initialize(this.currentSession?.token || '');
        }
        
        // Store shard in encrypted IndexedDB
        await secureStorage.store(
            `shard_${this.currentSession?.userId}`,
            shard,
            'mpc_shard'
        );
    }
    
    /**
     * Get server shard
     */
    private async getServerShard(): Promise<string> {
        const response = await fetch('https://api.omnibazaar.com/mpc/shard', {
            headers: {
                'Authorization': `Bearer ${this.currentSession?.token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to get server shard');
        }
        
        const { shard } = await response.json();
        return shard;
    }
    
    /**
     * Combine shards to reconstruct key
     */
    private combineShards(shards: string[]): string {
        // Simplified combination - real MPC would be much more complex
        // This is just for demonstration
        let combined = Buffer.from(shards[0], 'hex');
        
        for (let i = 1; i < shards.length; i++) {
            const shard = Buffer.from(shards[i], 'hex');
            for (let j = 0; j < combined.length; j++) {
                combined[j] ^= shard[j];
            }
        }
        
        return '0x' + combined.toString('hex');
    }
    
    /**
     * Handle connect request
     */
    private async handleConnect(message: WalletMessage): Promise<void> {
        if (!this.currentSession) {
            this.showView('authView');
            this.sendMessage({
                type: MessageType.WALLET_ERROR,
                id: message.id,
                error: {
                    code: 4001,
                    message: 'User rejected request'
                }
            });
            return;
        }
        
        const accounts = await this.getAccounts();
        this.sendMessage({
            type: MessageType.WALLET_RESPONSE,
            id: message.id,
            result: accounts
        });
    }
    
    /**
     * Handle disconnect request
     */
    private handleDisconnect(message: WalletMessage): void {
        this.clearSession();
        this.showView('authView');
        
        this.sendMessage({
            type: MessageType.WALLET_RESPONSE,
            id: message.id,
            result: true
        });
        
        // Emit disconnect event
        this.sendMessage({
            type: MessageType.WALLET_EVENT,
            id: this.generateId(),
            event: 'disconnect'
        });
    }
    
    /**
     * Handle ping request
     */
    private handlePing(message: WalletMessage): void {
        this.sendMessage({
            type: MessageType.PONG,
            id: message.id
        });
    }
    
    /**
     * Send message to parent window
     */
    private sendMessage(message: WalletMessage): void {
        window.parent.postMessage(message, '*');
    }
    
    /**
     * Set user session
     */
    private setSession(session: UserSession): void {
        this.currentSession = session;
        localStorage.setItem('omni_session', JSON.stringify(session));
        this.loadWallet();
    }
    
    /**
     * Load saved session
     */
    private loadSession(): UserSession | null {
        const saved = localStorage.getItem('omni_session');
        if (saved) {
            return JSON.parse(saved);
        }
        return null;
    }
    
    /**
     * Clear session
     */
    private clearSession(): void {
        this.currentSession = null;
        localStorage.removeItem('omni_session');
    }
    
    /**
     * Check authentication status
     */
    private async checkAuthStatus(): Promise<boolean> {
        try {
            const response = await fetch('https://api.omnibazaar.com/auth/status', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const session = await response.json();
                this.setSession(session);
                return true;
            }
        } catch (error) {
            console.error('Auth check error:', error);
        }
        
        return false;
    }
    
    /**
     * Load wallet after authentication
     */
    private async loadWallet(): Promise<void> {
        this.showView('walletView');
        
        // Update UI with wallet info
        this.updateWalletUI();
        
        // Load balance
        const balance = await this.getOmniBalance();
        this.updateBalance(balance);
        
        // Emit connect event
        this.sendMessage({
            type: MessageType.WALLET_EVENT,
            id: this.generateId(),
            event: 'connect',
            data: { chainId: '0xa86a' }
        });
        
        // Emit accounts changed event
        this.sendMessage({
            type: MessageType.WALLET_EVENT,
            id: this.generateId(),
            event: 'accountsChanged',
            data: [this.currentSession?.address]
        });
    }
    
    /**
     * Show a specific view
     */
    showView(viewId: string): void {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        // Show requested view
        const view = document.getElementById(viewId);
        if (view) {
            view.classList.add('active');
            this.currentView = viewId;
        }
    }
    
    /**
     * Show auth view
     */
    showAuthView(): void {
        this.showView('authView');
    }
    
    /**
     * Show email auth
     */
    showEmailAuth(): void {
        this.showView('emailAuthView');
    }
    
    /**
     * Show phone auth
     */
    showPhoneAuth(): void {
        // Similar to email, create phone input view
        this.showView('phoneAuthView');
    }
    
    /**
     * Show legacy auth
     */
    showLegacyAuth(): void {
        // Create legacy username/password view
        this.showView('legacyAuthView');
    }
    
    /**
     * Show create wallet
     */
    showCreateWallet(): void {
        // Create new wallet flow
        this.showView('createWalletView');
    }
    
    /**
     * Send email OTP
     */
    async sendEmailOTP(): Promise<void> {
        const input = document.getElementById('emailInput') as HTMLInputElement;
        const email = input?.value;
        
        if (!email) {
            this.showMessage('Please enter your email', 'error');
            return;
        }
        
        const success = await this.authenticateWithEmail(email);
        if (!success) {
            this.showMessage('Failed to send code', 'error');
        }
    }
    
    /**
     * Handle OTP input
     */
    handleOTPInput(input: HTMLInputElement, index: number): void {
        if (input.value && index < 5) {
            // Focus next input
            const inputs = document.querySelectorAll('.otp-input');
            const next = inputs[index + 1] as HTMLInputElement;
            if (next) next.focus();
        }
        
        // Check if all inputs are filled
        const inputs = document.querySelectorAll('.otp-input');
        const code = Array.from(inputs)
            .map(i => (i as HTMLInputElement).value)
            .join('');
        
        if (code.length === 6) {
            this.verifyOTP(code);
        }
    }
    
    /**
     * Verify OTP from UI
     */
    async verifyOTP(): Promise<void> {
        const inputs = document.querySelectorAll('.otp-input');
        const code = Array.from(inputs)
            .map(i => (i as HTMLInputElement).value)
            .join('');
        
        if (code.length !== 6) {
            this.showMessage('Please enter the 6-digit code', 'error');
            return;
        }
        
        const success = await this.verifyOTP(code);
        if (!success) {
            this.showMessage('Invalid code', 'error');
            // Clear inputs
            inputs.forEach(i => (i as HTMLInputElement).value = '');
            (inputs[0] as HTMLInputElement).focus();
        }
    }
    
    /**
     * Resend OTP
     */
    async resendOTP(): Promise<void> {
        if (this.otpMethod === 'email') {
            await this.authenticateWithEmail(this.otpDestination);
        } else {
            await this.authenticateWithPhone(this.otpDestination);
        }
        
        this.showMessage('Code resent', 'success');
    }
    
    /**
     * Update OTP destination display
     */
    private updateOTPDestination(destination: string): void {
        const element = document.getElementById('otpDestination');
        if (element) {
            element.textContent = destination;
        }
    }
    
    /**
     * Update wallet UI
     */
    private updateWalletUI(): void {
        const addressElement = document.getElementById('walletAddress');
        if (addressElement && this.currentSession?.address) {
            addressElement.textContent = this.formatAddress(this.currentSession.address);
        }
    }
    
    /**
     * Update balance display
     */
    private updateBalance(balance: string): void {
        const balanceElement = document.getElementById('balance');
        const balanceUSDElement = document.getElementById('balanceUSD');
        
        if (balanceElement) {
            balanceElement.textContent = `${parseFloat(balance).toFixed(2)} OMNI`;
        }
        
        if (balanceUSDElement) {
            // Calculate USD value (would fetch real price)
            const usdValue = parseFloat(balance) * 0.15; // Example price
            balanceUSDElement.textContent = `≈ $${usdValue.toFixed(2)} USD`;
        }
    }
    
    /**
     * Format address for display
     */
    private formatAddress(address: string): string {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    
    /**
     * Copy wallet address
     */
    copyAddress(): void {
        if (this.currentSession?.address) {
            navigator.clipboard.writeText(this.currentSession.address);
            this.showMessage('Address copied', 'success');
        }
    }
    
    /**
     * Show transaction approval UI
     */
    private showTransactionApproval(tx: TransactionRequest): void {
        this.showView('txApprovalView');
        
        // Update transaction details
        const fromElement = document.getElementById('txFrom');
        const toElement = document.getElementById('txTo');
        const amountElement = document.getElementById('txAmount');
        
        if (fromElement) fromElement.textContent = this.formatAddress(this.currentSession?.address || '');
        if (toElement) toElement.textContent = this.formatAddress(tx.to);
        if (amountElement && tx.value) {
            const amount = ethers.formatEther(tx.value);
            amountElement.textContent = `${amount} OMNI`;
        }
    }
    
    /**
     * Approve transaction
     */
    async approveTransaction(): Promise<void> {
        const pending = this.pendingRequests.get('current-tx');
        if (!pending) return;
        
        try {
            // Sign and send transaction
            const tx = pending.params![0] as TransactionRequest;
            const txHash = await this.executeTransaction(tx);
            
            // Resolve promise
            if ((window as any).txResolve) {
                (window as any).txResolve(txHash);
            }
            
            this.showView('walletView');
            this.showMessage('Transaction sent', 'success');
            
        } catch (error: any) {
            if ((window as any).txReject) {
                (window as any).txReject(error);
            }
            
            this.showMessage('Transaction failed', 'error');
        }
        
        this.pendingRequests.delete('current-tx');
    }
    
    /**
     * Reject transaction
     */
    rejectTransaction(): void {
        const pending = this.pendingRequests.get('current-tx');
        if (!pending) return;
        
        if ((window as any).txReject) {
            (window as any).txReject(new Error('User rejected transaction'));
        }
        
        this.pendingRequests.delete('current-tx');
        this.showView('walletView');
    }
    
    /**
     * Execute transaction
     */
    private async executeTransaction(tx: TransactionRequest): Promise<string> {
        // Reconstruct private key from MPC shards
        const privateKey = await this.reconstructPrivateKey();
        const wallet = new ethers.Wallet(privateKey, this.provider);
        
        // Send transaction
        const txResponse = await wallet.sendTransaction(tx);
        return txResponse.hash;
    }
    
    /**
     * Show legacy migration UI
     */
    private showLegacyMigration(balance: string): void {
        // Show migration prompt
        this.showMessage(`You have ${balance} legacy OMNI to claim`, 'info');
    }
    
    /**
     * Disconnect wallet
     */
    disconnect(): void {
        this.clearSession();
        this.showView('authView');
        
        // Emit disconnect event
        this.sendMessage({
            type: MessageType.WALLET_EVENT,
            id: this.generateId(),
            event: 'disconnect'
        });
    }
    
    /**
     * Show send UI
     */
    showSend(): void {
        // Implement send flow
        console.log('Show send UI');
    }
    
    /**
     * Show receive UI
     */
    showReceive(): void {
        // Implement receive flow
        console.log('Show receive UI');
    }
    
    /**
     * Show swap UI
     */
    showSwap(): void {
        // Implement swap flow
        console.log('Show swap UI');
    }
    
    /**
     * Show message to user
     */
    private showMessage(text: string, type: 'success' | 'error' | 'info'): void {
        // Create message element
        const message = document.createElement('div');
        message.className = `message ${type}`;
        message.textContent = text;
        
        // Insert at top of current view
        const view = document.querySelector('.view.active');
        if (view) {
            view.insertBefore(message, view.firstChild);
            
            // Remove after 3 seconds
            setTimeout(() => message.remove(), 3000);
        }
    }
    
    /**
     * Generate unique ID
     */
    private generateId(): string {
        return Math.random().toString(36).substr(2, 9);
    }
}

// Export for browser usage
if (typeof window !== 'undefined') {
    (window as any).EmbeddedWalletCore = EmbeddedWalletCore;
}

export default EmbeddedWalletCore;