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

import React, { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  AlertTitle,
  Paper,
  Tabs,
  Tab,
  Divider,
  Link,
  CircularProgress,
  Chip,
  InputAdornment,
  IconButton,
  Tooltip,
  Fade,
  Stack
} from '@mui/material';
import {
  Login as LoginIcon,
  PersonAdd as PersonAddIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  History as HistoryIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
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
  provider?: ethers.Provider;
  /** Signer for transactions */
  signer?: ethers.Signer;
  /** Migration contract address */
  migrationContractAddress?: string;
  /** Enable legacy migration (default true) */
  enableLegacyMigration?: boolean;
}

/**
 * Tab panel component
 */
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`auth-tabpanel-${index}`}
      aria-labelledby={`auth-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

/**
 * Unified Login Form Component
 * 
 * Smart authentication that detects legacy users and provides appropriate flow
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
    if (enableLegacyMigration && provider) {
      const service = new LegacyMigrationService(
        provider,
        signer,
        migrationContractAddress
      );
      service.initialize().then(() => {
        setMigrationService(service);
      });
    }
  }, [enableLegacyMigration, provider, signer, migrationContractAddress]);
  
  /**
   * Check if username is legacy when it changes
   */
  useEffect(() => {
    const checkUsername = async () => {
      if (!username || !migrationService || !enableLegacyMigration) {
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
        const isLegacy = await migrationService.isLegacyUser(username);
        setIsLegacyUser(isLegacy);
        
        if (isLegacy) {
          const status = await migrationService.getMigrationStatus(username);
          if (status) {
            const balanceInXOM = ethers.formatUnits(status.legacyBalance, 6);
            setLegacyBalance(balanceInXOM);
            
            // If already claimed, show warning
            if (status.isClaimed) {
              setError(`This legacy account was already migrated on ${
                new Date(status.claimTimestamp! * 1000).toLocaleDateString()
              }`);
            }
          }
        }
      } catch (err) {
        console.error('Error checking username:', err);
      } finally {
        setCheckingUsername(false);
      }
    };
    
    const debounceTimer = setTimeout(checkUsername, 500);
    return () => clearTimeout(debounceTimer);
  }, [username, migrationService, enableLegacyMigration]);
  
  /**
   * Handle regular login
   */
  const handleLogin = async () => {
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
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Handle sign up
   */
  const handleSignUp = async () => {
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
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Handle legacy migration success
   */
  const handleLegacySuccess = (username: string, address: string, balance: string) => {
    setShowLegacyModal(false);
    setSuccess(`Migration successful! ${balance} XOM transferred to your new wallet.`);
    
    setTimeout(() => {
      onSuccess(username, address);
    }, 2000);
  };
  
  /**
   * Validate form based on active tab
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
      <Paper elevation={3} sx={{ p: 4, maxWidth: 500, mx: 'auto' }}>
        {/* Header */}
        <Box textAlign="center" mb={3}>
          <Typography variant="h4" gutterBottom>
            Welcome to OmniWallet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your gateway to the OmniBazaar ecosystem
          </Typography>
        </Box>
        
        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(e: React.SyntheticEvent, v: number) => setActiveTab(v)}
          variant="fullWidth"
          sx={{ mb: 2 }}
        >
          <Tab
            icon={<LoginIcon />}
            label="Login"
            iconPosition="start"
          />
          <Tab
            icon={<PersonAddIcon />}
            label="Sign Up"
            iconPosition="start"
          />
        </Tabs>
        
        <Divider />
        
        {/* Login Tab */}
        <TabPanel value={activeTab} index={0}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
              disabled={loading}
              error={isNullAccount}
              helperText={
                isNullAccount ? "This account cannot be accessed (burned tokens)" :
                isLegacyUser ? `Legacy user detected (Balance: ${legacyBalance} XOM)` :
                undefined
              }
              InputProps={{
                endAdornment: checkingUsername ? (
                  <CircularProgress size={20} />
                ) : isLegacyUser ? (
                  <Tooltip title={isNullAccount ? "Burned tokens" : "Legacy OmniCoin v1 user"}>
                    <Chip
                      icon={isNullAccount ? <WarningIcon /> : <HistoryIcon />}
                      label={isNullAccount ? "BURNED" : "Legacy"}
                      size="small"
                      color={isNullAccount ? "error" : "info"}
                    />
                  </Tooltip>
                ) : undefined
              }}
            />
            
            <TextField
              fullWidth
              type={showPassword ? 'text' : 'password'}
              label="Password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              disabled={loading || isNullAccount}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      disabled={isNullAccount}
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            
            {isLegacyUser && !isNullAccount && (
              <Alert severity="info" icon={<InfoIcon />}>
                <AlertTitle>Legacy Account Detected</AlertTitle>
                <Typography variant="body2">
                  This is a legacy OmniCoin v1 account with {legacyBalance} XOM.
                  Click login to start the migration process.
                </Typography>
              </Alert>
            )}
            
            {isNullAccount && (
              <Alert severity="error" icon={<WarningIcon />}>
                <AlertTitle>Burned Account</AlertTitle>
                <Typography variant="body2">
                  The "null" account contained burned tokens that cannot be recovered or migrated.
                  These tokens were permanently removed from circulation.
                </Typography>
              </Alert>
            )}
            
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleLogin}
              disabled={loading || !isFormValid()}
              startIcon={loading ? <CircularProgress size={20} /> : <LoginIcon />}
            >
              {loading ? 'Logging in...' : isLegacyUser && !isNullAccount ? 'Login & Migrate' : 'Login'}
            </Button>
            
            <Box textAlign="center">
              <Link
                component="button"
                variant="body2"
                onClick={() => setActiveTab(1)}
                disabled={loading}
              >
                Don't have an account? Sign up
              </Link>
            </Box>
          </Stack>
        </TabPanel>
        
        {/* Sign Up Tab */}
        <TabPanel value={activeTab} index={1}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
              disabled={loading}
              error={isLegacyUser}
              helperText={
                isLegacyUser 
                  ? "This username is reserved for a legacy user"
                  : "Choose a unique username"
              }
              InputProps={{
                endAdornment: checkingUsername ? (
                  <CircularProgress size={20} />
                ) : isLegacyUser ? (
                  <Tooltip title="Reserved for legacy user">
                    <WarningIcon color="error" />
                  </Tooltip>
                ) : username && !isLegacyUser ? (
                  <Tooltip title="Username available">
                    <CheckCircleIcon color="success" />
                  </Tooltip>
                ) : undefined
              }}
            />
            
            <TextField
              fullWidth
              type={showPassword ? 'text' : 'password'}
              label="Password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              disabled={loading}
              helperText="Minimum 12 characters"
              error={password.length > 0 && password.length < 12}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            
            <TextField
              fullWidth
              type={showPassword ? 'text' : 'password'}
              label="Confirm Password"
              value={confirmPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
              disabled={loading}
              error={confirmPassword.length > 0 && confirmPassword !== password}
              helperText={
                confirmPassword.length > 0 && confirmPassword !== password
                  ? "Passwords do not match"
                  : "Re-enter your password"
              }
            />
            
            {isLegacyUser && (
              <Alert severity="warning">
                This username belongs to a legacy user. If this is your account,
                please use the login tab to migrate your balance.
              </Alert>
            )}
            
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleSignUp}
              disabled={loading || !isFormValid()}
              startIcon={loading ? <CircularProgress size={20} /> : <PersonAddIcon />}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
            
            <Box textAlign="center">
              <Link
                component="button"
                variant="body2"
                onClick={() => setActiveTab(0)}
                disabled={loading}
              >
                Already have an account? Login
              </Link>
            </Box>
          </Stack>
        </TabPanel>
        
        {/* Error/Success Messages */}
        <Fade in={!!error}>
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        </Fade>
        
        <Fade in={!!success}>
          <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        </Fade>
      </Paper>
      
      {/* Legacy Migration Modal */}
      {enableLegacyMigration && (
        <LegacyLoginModal
          open={showLegacyModal}
          username={username}
          onClose={() => setShowLegacyModal(false)}
          onSuccess={handleLegacySuccess}
          provider={provider!}
          signer={signer}
          migrationContractAddress={migrationContractAddress}
        />
      )}
    </>
  );
};

export default UnifiedLoginForm;
