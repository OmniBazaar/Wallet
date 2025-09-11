/**
 * Legacy Login Modal Component
 * 
 * Special authentication pathway for legacy OmniCoin v1 users to:
 * 1. Validate their legacy credentials
 * 2. Claim their legacy balance
 * 3. Migrate to the new OmniCoin system
 * 
 * Excludes the "null" account (burned tokens)
 * 
 * @module components/auth/LegacyLoginModal
 */

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { LegacyMigrationService, MigrationStatus, ValidationResult, AccessResult } from '../../services/LegacyMigrationService';
import { KeyringManager } from '../../core/keyring/KeyringManager';

/**
 * Type alias for claim result (using AccessResult from service)
 */
type ClaimResult = AccessResult;

/**
 * Props for LegacyLoginModal component
 */
export interface LegacyLoginModalProps {
  /** Modal open state */
  open: boolean;
  /** Username to pre-fill */
  username?: string;
  /** Modal close handler */
  onClose: () => void;
  /** Success callback with new account info */
  onSuccess: (username: string, address: string, balance: string) => void;
  /** Provider for blockchain connection */
  provider: ethers.Provider;
  /** Signer for transactions */
  signer?: ethers.Signer | undefined;
  /** Migration contract address */
  migrationContractAddress?: string | undefined;
}

/**
 * Migration steps enum
 */
enum MigrationStep {
  VERIFY_LEGACY = 0,
  CREATE_WALLET = 1,
  CLAIM_BALANCE = 2,
  COMPLETE = 3
}

/**
 * Legacy Login Modal Component
 * 
 * Provides a step-by-step interface for legacy users to migrate their accounts
 * @param props - The component props
 * @param props.open - Modal open state
 * @param props.username - Username to pre-fill
 * @param props.onClose - Modal close handler
 * @param props.onSuccess - Success callback with new account info
 * @param props.provider - Provider for blockchain connection
 * @param props.signer - Signer for transactions
 * @param props.migrationContractAddress - Migration contract address
 * @returns React component for legacy login modal
 */
export const LegacyLoginModal: React.FC<LegacyLoginModalProps> = ({
  open,
  username: initialUsername = '',
  onClose,
  onSuccess,
  provider,
  signer,
  migrationContractAddress
}) => {
  // State management
  const [activeStep, setActiveStep] = useState(MigrationStep.VERIFY_LEGACY);
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  
  // Migration data
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [newAddress, setNewAddress] = useState<string | null>(null);
  
  // Services
  const [migrationService, setMigrationService] = useState<LegacyMigrationService | null>(null);
  const keyringManager = KeyringManager.getInstance();
  
  /**
   * Initialize migration service
   */
  useEffect(() => {
    if (open && provider !== null && provider !== undefined) {
      const service = new LegacyMigrationService(
        provider
      );
      try {
        service.initialize();
        setMigrationService(service);
      } catch (error: unknown) {
        setError(`Failed to initialize migration service: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }, [open, provider, signer, migrationContractAddress]);
  
  /**
   * Check if username is legacy when it changes
   */
  useEffect(() => {
    const checkLegacyUser = async (): Promise<void> => {
      if (username.length > 0 && migrationService !== null) {
        // Special case: block "null" account
        if (username.toLowerCase() === 'null') {
          setError('The null account cannot be migrated (tokens were burned)');
          return;
        }
        
        const isLegacy = migrationService.isLegacyUser(username);
        if (isLegacy) {
          const status = await migrationService.getMigrationStatus(username);
          setMigrationStatus(status);
          
          if (status.isClaimed === true && status.claimTimestamp !== null && status.claimTimestamp !== undefined) {
            setError(`This account was already migrated on ${new Date(status.claimTimestamp * 1000).toLocaleDateString()}`);
          }
        }
      }
    };
    
    const debounceTimer = setTimeout(() => {
      void checkLegacyUser();
    }, 500);
    return () => clearTimeout(debounceTimer);
  }, [username, migrationService]);
  
  /**
   * Step 1: Verify legacy credentials
   */
  const handleVerifyLegacy = (): void => {
    if (migrationService === null) {
      setError('Migration service not initialized');
      return;
    }
    
    // Block null account
    if (username.toLowerCase() === 'null') {
      setError('The null account cannot be migrated (tokens were burned)');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = migrationService.validateLegacyCredentials(username, password);
      
      if (result.isValid) {
        setValidationResult(result);
        const balance = result.balance ?? '0';
        setSuccess(`Legacy account verified! Balance: ${ethers.formatUnits(balance, 6)} XOM (legacy)`);
        setActiveStep(MigrationStep.CREATE_WALLET);
      } else {
        setError(result.error ?? 'Invalid credentials');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify legacy account';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Step 2: Create new wallet
   */
  const handleCreateWallet = async (): Promise<void> => {
    if (newPassword.length === 0 || newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Register new account with same username
      const session = await keyringManager.registerUser({
        username,
        password: newPassword
      });
      
      setNewAddress(session.accounts.omnicoin.address);
      setSuccess('New wallet created successfully!');
      setActiveStep(MigrationStep.CLAIM_BALANCE);
    } catch (error: unknown) {
      // If username exists, try login instead
      const errorMessage = error instanceof Error ? error.message : 'Failed to create wallet';
      if (errorMessage.includes('already exists')) {
        try {
          const session = await keyringManager.loginUser({
            username,
            password: newPassword
          });
          setNewAddress(session.accounts.omnicoin.address);
          setSuccess('Wallet accessed successfully!');
          setActiveStep(MigrationStep.CLAIM_BALANCE);
        } catch {
          setError('Username exists but password is incorrect');
        }
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Step 3: Claim legacy balance
   */
  const handleClaimBalance = async (): Promise<void> => {
    if (migrationService === null || newAddress === null) {
      setError('Migration not properly initialized');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await migrationService.accessLegacyBalance(
        username,
        password // Legacy password for verification
      );
      
      if (result.success) {
        setClaimResult(result);
        const amount = result.amount ?? '0';
        setSuccess(`Successfully claimed ${amount} XOM!`);
        setActiveStep(MigrationStep.COMPLETE);
        
        // Notify parent component
        setTimeout(() => {
          onSuccess(username, newAddress, amount);
        }, 2000);
      } else {
        setError(result.error ?? 'Failed to claim balance');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to claim balance';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Reset form
   */
  const handleReset = (): void => {
    setActiveStep(MigrationStep.VERIFY_LEGACY);
    setUsername(initialUsername);
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(null);
    setMigrationStatus(null);
    setValidationResult(null);
    setClaimResult(null);
    setNewAddress(null);
  };
  
  /**
   * Format balance for display
   * @param balance - The balance to format
   * @param decimals - The decimal places to use
   * @returns Formatted balance string
   */
  const formatBalance = (balance: string, decimals = 18): string => {
    try {
      return ethers.formatUnits(balance, decimals);
    } catch {
      return '0';
    }
  };
  
  if (!open) {
    return null;
  }
  
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>Legacy Account Migration</h2>
          <div>
            <button 
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              style={{ marginRight: '8px', padding: '4px 8px' }}
            >
              Help
            </button>
            <button 
              type="button"
              onClick={onClose}
              style={{ padding: '4px 8px' }}
            >
              ×
            </button>
          </div>
        </div>
        
        {showHelp && (
          <div style={{ 
            backgroundColor: '#e3f2fd', 
            padding: '16px', 
            borderRadius: '4px', 
            marginBottom: '16px' 
          }}>
            <h4>Legacy Migration Help</h4>
            <p>This tool helps legacy OmniCoin v1 users migrate their accounts to the new system.</p>
            <ol>
              <li>Step 1: Verify your legacy account - Enter your v1 username and password</li>
              <li>Step 2: Create new wallet - Set a new secure password for v2</li>
              <li>Step 3: Claim your balance - Transfer tokens to your new wallet</li>
            </ol>
            <p style={{ color: '#ff9800' }}>Note: The "null" account cannot be migrated (tokens were burned).</p>
          </div>
        )}
        
        {migrationStatus !== null && (
          <div style={{ 
            border: '1px solid #ccc', 
            padding: '16px', 
            borderRadius: '4px', 
            marginBottom: '16px',
            backgroundColor: '#f5f5f5'
          }}>
            <h4>Account Status</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>Legacy Balance:</strong> {formatBalance(migrationStatus.legacyBalance ?? '0', 6)} XOM
              </div>
              <div>
                <strong>New Balance:</strong> {formatBalance(migrationStatus.newBalance ?? '0', 18)} XOM
              </div>
            </div>
            {migrationStatus.isClaimed === true && typeof migrationStatus.claimTimestamp === 'number' && (
              <div style={{ color: '#ff9800', marginTop: '8px' }}>
                This account was already migrated on {new Date((migrationStatus.claimTimestamp ?? 0) * 1000).toLocaleDateString()}
              </div>
            )}
          </div>
        )}
        
        {error !== null && (
          <div style={{ 
            backgroundColor: '#ffebee', 
            color: '#c62828', 
            padding: '12px', 
            borderRadius: '4px', 
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} style={{ background: 'none', border: 'none', fontSize: '16px' }}>×</button>
          </div>
        )}
        
        {success !== null && (
          <div style={{ 
            backgroundColor: '#e8f5e8', 
            color: '#2e7d32', 
            padding: '12px', 
            borderRadius: '4px', 
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>{success}</span>
            <button type="button" onClick={() => setSuccess(null)} style={{ background: 'none', border: 'none', fontSize: '16px' }}>×</button>
          </div>
        )}
        
        {/* Step 1: Verify Legacy Account */}
        {activeStep >= MigrationStep.VERIFY_LEGACY && (
          <div style={{ marginBottom: '24px' }}>
            <h3>Step 1: Verify Legacy Account</h3>
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="Legacy Username"
                value={username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                disabled={loading}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  marginBottom: '8px',
                  borderColor: username.toLowerCase() === 'null' ? '#f44336' : '#ccc'
                }}
              />
              {username.toLowerCase() === 'null' && (
                <div style={{ color: '#f44336', fontSize: '12px' }}>
                  This account cannot be migrated (burned tokens)
                </div>
              )}
              
              <input
                type="password"
                placeholder="Legacy Password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                disabled={loading || username.toLowerCase() === 'null'}
                style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
              />
              
              <button
                type="button"
                onClick={handleVerifyLegacy}
                disabled={username.length === 0 || password.length === 0 || loading || username.toLowerCase() === 'null'}
                style={{ padding: '8px 16px', marginRight: '8px' }}
              >
                Verify Account
              </button>
            </div>
          </div>
        )}
        
        {/* Step 2: Create New Wallet */}
        {activeStep >= MigrationStep.CREATE_WALLET && (
          <div style={{ marginBottom: '24px' }}>
            <h3>Step 2: Create New Wallet</h3>
            <div style={{ backgroundColor: '#e3f2fd', padding: '12px', borderRadius: '4px', marginBottom: '16px' }}>
              Your username will remain the same, but you need to set a new secure password for v2.
            </div>
            <div style={{ marginBottom: '16px' }}>
              <input
                type="password"
                placeholder="New Password (minimum 12 characters)"
                value={newPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                disabled={loading}
                style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
              />
              
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                disabled={loading}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  marginBottom: '8px',
                  borderColor: (confirmPassword.length > 0 && confirmPassword !== newPassword) ? '#f44336' : '#ccc'
                }}
              />
              {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                <div style={{ color: '#f44336', fontSize: '12px' }}>Passwords do not match</div>
              )}
              
              <button
                type="button"
                onClick={() => void handleCreateWallet()}
                disabled={newPassword.length === 0 || newPassword !== confirmPassword || loading}
                style={{ padding: '8px 16px', marginRight: '8px' }}
              >
                Create Wallet
              </button>
              <button 
                type="button"
                onClick={() => setActiveStep(MigrationStep.VERIFY_LEGACY)}
                style={{ padding: '8px 16px' }}
              >
                Back
              </button>
            </div>
          </div>
        )}
        
        {/* Step 3: Claim Balance */}
        {activeStep >= MigrationStep.CLAIM_BALANCE && (
          <div style={{ marginBottom: '24px' }}>
            <h3>Step 3: Claim Your Balance</h3>
            <div style={{ 
              border: '1px solid #ccc', 
              padding: '16px', 
              borderRadius: '4px', 
              marginBottom: '16px' 
            }}>
              <h4>Migration Summary</h4>
              <hr />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Legacy Balance (6 decimals):</span>
                <span>{validationResult !== null && validationResult.balance !== undefined ? formatBalance(validationResult.balance, 6) : '0'} XOM</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>New Balance (18 decimals):</span>
                <span style={{ color: '#1976d2' }}>
                  {validationResult !== null && validationResult.balance !== undefined ? formatBalance(
                    (BigInt(validationResult.balance) * BigInt(10 ** 12)).toString(),
                    18
                  ) : '0'} XOM
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Recipient Address:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                  {newAddress !== null ? `${newAddress.slice(0, 6)}...${newAddress.slice(-4)}` : ''}
                </span>
              </div>
            </div>
            
            <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '12px', borderRadius: '4px', marginBottom: '16px' }}>
              This action cannot be undone. Once claimed, your legacy balance will be transferred to your new wallet.
            </div>
            
            <button
              type="button"
              onClick={() => void handleClaimBalance()}
              disabled={loading}
              style={{ padding: '8px 16px', marginRight: '8px', backgroundColor: '#4caf50', color: 'white' }}
            >
              Claim Balance
            </button>
            <button 
              type="button"
              onClick={() => setActiveStep(MigrationStep.CREATE_WALLET)}
              style={{ padding: '8px 16px' }}
            >
              Back
            </button>
          </div>
        )}
        
        {/* Step 4: Complete */}
        {activeStep >= MigrationStep.COMPLETE && (
          <div style={{ marginBottom: '24px' }}>
            <h3>Migration Complete</h3>
            <div style={{ backgroundColor: '#e8f5e8', color: '#2e7d32', padding: '16px', borderRadius: '4px', marginBottom: '16px' }}>
              <h4>Migration Successful!</h4>
              <p>Your legacy balance has been successfully transferred to your new wallet.</p>
            </div>
            
            {claimResult !== null && (
              <div style={{ 
                border: '1px solid #ccc', 
                padding: '16px', 
                borderRadius: '4px', 
                marginBottom: '16px' 
              }}>
                <h4>Transaction Details</h4>
                <hr />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Amount Claimed:</span>
                  <span style={{ color: '#4caf50' }}>
                    {claimResult.amount ?? '0'} XOM
                  </span>
                </div>
                {claimResult.address !== undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Legacy Address:</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {`${claimResult.address.slice(0, 6)}...${claimResult.address.slice(-4)}`}
                    </span>
                  </div>
                )}
              </div>
            )}
            
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 16px' }}
            >
              Close
            </button>
          </div>
        )}
        
        {loading && (
          <div style={{ 
            backgroundColor: '#f0f0f0', 
            height: '4px', 
            borderRadius: '2px', 
            overflow: 'hidden',
            marginTop: '16px'
          }}>
            <div style={{
              height: '100%',
              backgroundColor: '#1976d2',
              animation: 'loading 2s infinite ease-in-out'
            }} />
          </div>
        )}
        
        {activeStep < MigrationStep.COMPLETE && (
          <div style={{ borderTop: '1px solid #ccc', paddingTop: '16px', marginTop: '16px' }}>
            <button 
              type="button"
              onClick={handleReset} 
              disabled={loading}
              style={{ padding: '8px 16px', marginRight: '8px' }}
            >
              Reset
            </button>
            <button 
              type="button"
              onClick={onClose} 
              disabled={loading}
              style={{ padding: '8px 16px' }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default LegacyLoginModal;