/**
 * Unified Login Form Component
 * 
 * Handles both regular and legacy user authentication:
 * - Detects if username is a legacy user
 * - Shows migration flow for legacy users
 * - Regular login/signup for new users
 * 
 * @module components/auth/UnifiedLoginForm
 */

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { KeyringManager } from '../../core/keyring/KeyringManager';
import { LegacyMigrationService } from '../../services/LegacyMigrationService';
import { LegacyLoginModal } from './LegacyLoginModal';

/**
 * Props for UnifiedLoginForm component
 */
export interface UnifiedLoginFormProps {
  /** Success callback after login/signup */
  onSuccess: (username: string, address: string) => void;
  /** Provider for blockchain connection */
  provider?: ethers.Provider | undefined;
  /** Signer for transactions */
  signer?: ethers.Signer | undefined;
  /** Migration contract address */
  migrationContractAddress?: string | undefined;
  /** Enable legacy migration (default true) */
  enableLegacyMigration?: boolean | undefined;
}

/**
 * Unified Login Form Component
 * 
 * Smart authentication that detects legacy users and provides appropriate flow
 * @param props - The component props
 * @param props.onSuccess - Success callback after login/signup
 * @param props.provider - Provider for blockchain connection
 * @param props.signer - Signer for transactions
 * @param props.migrationContractAddress - Migration contract address
 * @param props.enableLegacyMigration - Enable legacy migration (default true)
 * @returns React component for unified login/signup form
 */
export const UnifiedLoginForm: React.FC<UnifiedLoginFormProps> = ({
  onSuccess,
  provider,
  signer,
  migrationContractAddress,
  enableLegacyMigration = true
}) => {
  // Tab state
  const [activeTab, setActiveTab] = useState(0); // 0: Login, 1: Sign Up
  
  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  
  // Legacy state
  const [isLegacyUser, setIsLegacyUser] = useState(false);
  const [legacyBalance, setLegacyBalance] = useState<string | null>(null);
  const [showLegacyModal, setShowLegacyModal] = useState(false);
  const [isNullAccount, setIsNullAccount] = useState(false);
  
  // Services
  const keyringManager = KeyringManager.getInstance();
  const [migrationService, setMigrationService] = useState<LegacyMigrationService | null>(null);
  
  /**
   * Initialize migration service
   */
  useEffect(() => {
    if (enableLegacyMigration && provider !== undefined && provider !== null) {
      const service = new LegacyMigrationService(
        provider
      );
      try {
        service.initialize();
        setMigrationService(service);
      } catch {
        // Handle initialization error silently
      }
    }
  }, [enableLegacyMigration, provider, signer, migrationContractAddress]);
  
  /**
   * Check if username is legacy when it changes
   */
  useEffect(() => {
    const checkUsername = async (): Promise<void> => {
      if (username.length === 0 || migrationService === null || !enableLegacyMigration) {
        setIsLegacyUser(false);
        setLegacyBalance(null);
        setIsNullAccount(false);
        return;
      }
      
      setCheckingUsername(true);
      
      try {
        // Special case: null account
        if (username.toLowerCase() === 'null') {
          setIsNullAccount(true);
          setIsLegacyUser(true);
          setLegacyBalance('8,000,000,000+ (BURNED)');
          return;
        }
        
        setIsNullAccount(false);
        
        // Check if legacy user
        const isLegacy = migrationService.isLegacyUser(username);
        setIsLegacyUser(isLegacy);
        
        if (isLegacy) {
          const status = await migrationService.getMigrationStatus(username);
          if (status !== null) {
            const balanceInXOM = ethers.formatUnits(status.legacyBalance, 6);
            setLegacyBalance(balanceInXOM);
            
            // If already claimed, show warning
            if (status.isClaimed && typeof status.claimTimestamp === 'number') {
              setError(`This legacy account was already migrated on ${
                new Date(status.claimTimestamp * 1000).toLocaleDateString()
              }`);
            }
          }
        }
      } catch {
        // Error checking username - silently handle
        setIsLegacyUser(false);
        setLegacyBalance(null);
        setIsNullAccount(false);
      } finally {
        setCheckingUsername(false);
      }
    };
    
    const debounceTimer = setTimeout(() => {
      void checkUsername();
    }, 500);
    return () => clearTimeout(debounceTimer);
  }, [username, migrationService, enableLegacyMigration]);
  
  /**
   * Handle regular login
   */
  const handleLogin = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // If legacy user, open migration modal
      if (isLegacyUser && !isNullAccount) {
        setShowLegacyModal(true);
        setLoading(false);
        return;
      }
      
      // Block null account
      if (isNullAccount) {
        setError('The null account cannot be accessed (tokens were burned)');
        setLoading(false);
        return;
      }
      
      // Regular login
      const session = await keyringManager.loginUser({ username, password });
      setSuccess('Login successful!');
      
      setTimeout(() => {
        onSuccess(session.username, session.accounts.omnicoin.address);
      }, 1000);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Handle sign up
   */
  const handleSignUp = async (): Promise<void> => {
    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    // Validate password length
    if (password.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }
    
    // Check if trying to register a legacy username
    if (isLegacyUser) {
      setError('This username is reserved for a legacy user. Please choose a different username or migrate your legacy account.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const session = await keyringManager.registerUser({ username, password });
      setSuccess('Account created successfully!');
      
      setTimeout(() => {
        onSuccess(session.username, session.accounts.omnicoin.address);
      }, 1000);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Sign up failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Handle legacy migration success
   * @param username - The migrated username
   * @param address - The new wallet address
   * @param balance - The migrated balance
   */
  const handleLegacySuccess = (username: string, address: string, balance: string): void => {
    setShowLegacyModal(false);
    setSuccess(`Migration successful! ${balance} XOM transferred to your new wallet.`);
    
    setTimeout(() => {
      onSuccess(username, address);
    }, 2000);
  };
  
  /**
   * Validate form based on active tab
   * @returns True if form is valid, false otherwise
   */
  const isFormValid = (): boolean => {
    if (isNullAccount) return false;
    
    if (activeTab === 0) {
      // Login tab
      return username.length > 0 && password.length > 0;
    } else {
      // Sign up tab
      return (
        username.length > 0 &&
        password.length >= 12 &&
        password === confirmPassword &&
        !isLegacyUser
      );
    }
  };
  
  return (
    <>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '32px',
        maxWidth: '500px',
        margin: '0 auto',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '28px' }}>Welcome to OmniWallet</h2>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
            Your gateway to the OmniBazaar ecosystem
          </p>
        </div>
        
        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid #ccc', 
          marginBottom: '16px' 
        }}>
          <button
            type="button"
            onClick={() => setActiveTab(0)}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              borderBottom: activeTab === 0 ? '2px solid #1976d2' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 0 ? '#1976d2' : '#666',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            🔑 Login
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(1)}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              borderBottom: activeTab === 1 ? '2px solid #1976d2' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 1 ? '#1976d2' : '#666',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            👤 Sign Up
          </button>
        </div>
        
        {/* Login Tab */}
        {activeTab === 0 && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${isNullAccount ? '#f44336' : '#ccc'}`,
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                />
                {checkingUsername && (
                  <div style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '12px'
                  }}>
                    🔄
                  </div>
                )}
                {isLegacyUser && !checkingUsername && (
                  <div style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '12px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: isNullAccount ? '#ffebee' : '#e3f2fd',
                    color: isNullAccount ? '#c62828' : '#1976d2'
                  }}>
                    {isNullAccount ? '⚠️ BURNED' : '🕒 Legacy'}
                  </div>
                )}
              </div>
              {isNullAccount && (
                <div style={{ color: '#f44336', fontSize: '12px', marginTop: '4px' }}>
                  This account cannot be accessed (burned tokens)
                </div>
              )}
              {isLegacyUser && !isNullAccount && (
                <div style={{ color: '#1976d2', fontSize: '12px', marginTop: '4px' }}>
                  Legacy user detected (Balance: {legacyBalance} XOM)
                </div>
              )}
            </div>
            
            <div style={{ marginBottom: '16px', position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                disabled={loading || isNullAccount}
                style={{
                  width: '100%',
                  padding: '12px',
                  paddingRight: '40px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '16px'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isNullAccount}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            
            {isLegacyUser && !isNullAccount && (
              <div style={{
                backgroundColor: '#e3f2fd',
                border: '1px solid #1976d2',
                borderRadius: '4px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#1976d2' }}>Legacy Account Detected</h4>
                <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>
                  This is a legacy OmniCoin v1 account with {legacyBalance} XOM.
                  Click login to start the migration process.
                </p>
              </div>
            )}
            
            {isNullAccount && (
              <div style={{
                backgroundColor: '#ffebee',
                border: '1px solid #f44336',
                borderRadius: '4px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#f44336' }}>Burned Account</h4>
                <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>
                  The "null" account contained burned tokens that cannot be recovered or migrated.
                  These tokens were permanently removed from circulation.
                </p>
              </div>
            )}
            
            <button
              type="button"
              onClick={() => void handleLogin()}
              disabled={loading || !isFormValid()}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: loading || !isFormValid() ? '#ccc' : '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                cursor: loading || !isFormValid() ? 'not-allowed' : 'pointer',
                marginBottom: '16px'
              }}
            >
              {loading ? '🔄 Logging in...' : isLegacyUser && !isNullAccount ? '🔑 Login & Migrate' : '🔑 Login'}
            </button>
            
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setActiveTab(1)}
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1976d2',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: '14px'
                }}
              >
                Don't have an account? Sign up
              </button>
            </div>
          </div>
        )}
        
        {/* Sign Up Tab */}
        {activeTab === 1 && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${isLegacyUser ? '#f44336' : '#ccc'}`,
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                />
                {checkingUsername && (
                  <div style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '12px'
                  }}>
                    🔄
                  </div>
                )}
                {!checkingUsername && username.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '16px'
                  }}>
                    {isLegacyUser ? '⚠️' : '✅'}
                  </div>
                )}
              </div>
              <div style={{ color: isLegacyUser ? '#f44336' : '#666', fontSize: '12px', marginTop: '4px' }}>
                {isLegacyUser 
                  ? 'This username is reserved for a legacy user'
                  : 'Choose a unique username'
                }
              </div>
            </div>
            
            <div style={{ marginBottom: '16px', position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password (minimum 12 characters)"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  paddingRight: '40px',
                  border: `1px solid ${password.length > 0 && password.length < 12 ? '#f44336' : '#ccc'}`,
                  borderRadius: '4px',
                  fontSize: '16px'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: `1px solid ${confirmPassword.length > 0 && confirmPassword !== password ? '#f44336' : '#ccc'}`,
                  borderRadius: '4px',
                  fontSize: '16px'
                }}
              />
              {confirmPassword.length > 0 && confirmPassword !== password && (
                <div style={{ color: '#f44336', fontSize: '12px', marginTop: '4px' }}>
                  Passwords do not match
                </div>
              )}
            </div>
            
            {isLegacyUser && (
              <div style={{
                backgroundColor: '#fff3cd',
                border: '1px solid #856404',
                borderRadius: '4px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#856404' }}>
                  This username belongs to a legacy user. If this is your account,
                  please use the login tab to migrate your balance.
                </p>
              </div>
            )}
            
            <button
              type="button"
              onClick={() => void handleSignUp()}
              disabled={loading || !isFormValid()}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: loading || !isFormValid() ? '#ccc' : '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                cursor: loading || !isFormValid() ? 'not-allowed' : 'pointer',
                marginBottom: '16px'
              }}
            >
              {loading ? '🔄 Creating Account...' : '👤 Create Account'}
            </button>
            
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setActiveTab(0)}
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1976d2',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: '14px'
                }}
              >
                Already have an account? Login
              </button>
            </div>
          </div>
        )}
        
        {/* Error/Success Messages */}
        {error !== null && (
          <div style={{
            backgroundColor: '#ffebee',
            color: '#c62828',
            padding: '12px',
            borderRadius: '4px',
            marginTop: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>{error}</span>
            <button 
              type="button"
              onClick={() => setError(null)} 
              style={{ 
                background: 'none', 
                border: 'none', 
                color: '#c62828',
                cursor: 'pointer',
                fontSize: '16px' 
              }}
            >
              ×
            </button>
          </div>
        )}
        
        {success !== null && (
          <div style={{
            backgroundColor: '#e8f5e8',
            color: '#2e7d32',
            padding: '12px',
            borderRadius: '4px',
            marginTop: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>{success}</span>
            <button 
              type="button"
              onClick={() => setSuccess(null)} 
              style={{ 
                background: 'none', 
                border: 'none', 
                color: '#2e7d32',
                cursor: 'pointer',
                fontSize: '16px' 
              }}
            >
              ×
            </button>
          </div>
        )}
      </div>
      
      {/* Legacy Migration Modal */}
      {enableLegacyMigration && provider !== undefined && (
        <LegacyLoginModal
          open={showLegacyModal}
          username={username}
          onClose={() => setShowLegacyModal(false)}
          onSuccess={handleLegacySuccess}
          provider={provider}
          signer={signer}
          migrationContractAddress={migrationContractAddress}
        />
      )}
    </>
  );
};

export default UnifiedLoginForm;