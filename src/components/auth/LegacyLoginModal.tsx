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

import React, { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  AlertTitle,
  Box,
  Typography,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  AccountBalance as AccountBalanceIcon,
  VpnKey as VpnKeyIcon,
  Transform as TransformIcon,
  Wallet as WalletIcon,
  History as HistoryIcon,
  HelpOutline as HelpIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { LegacyMigrationService, MigrationStatus, ValidationResult, ClaimResult } from '../../services/LegacyMigrationService';
import { KeyringManager } from '../../core/keyring/KeyringManager';

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
  signer?: ethers.Signer;
  /** Migration contract address */
  migrationContractAddress?: string;
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
    if (open && provider) {
      const service = new LegacyMigrationService(
        provider,
        signer,
        migrationContractAddress
      );
      service.initialize().then(() => {
        setMigrationService(service);
      });
    }
  }, [open, provider, signer, migrationContractAddress]);
  
  /**
   * Check if username is legacy when it changes
   */
  useEffect(() => {
    const checkLegacyUser = async () => {
      if (username && migrationService) {
        // Special case: block "null" account
        if (username.toLowerCase() === 'null') {
          setError('The null account cannot be migrated (tokens were burned)');
          return;
        }
        
        const isLegacy = await migrationService.isLegacyUser(username);
        if (isLegacy) {
          const status = await migrationService.getMigrationStatus(username);
          setMigrationStatus(status);
          
          if (status?.isClaimed) {
            setError(`This account was already migrated on ${new Date(status.claimTimestamp! * 1000).toLocaleDateString()}`);
          }
        }
      }
    };
    
    const debounceTimer = setTimeout(checkLegacyUser, 500);
    return () => clearTimeout(debounceTimer);
  }, [username, migrationService]);
  
  /**
   * Step 1: Verify legacy credentials
   */
  const handleVerifyLegacy = async () => {
    if (!migrationService) {
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
      const result = await migrationService.validateLegacyCredentials(username, password);
      
      if (result.isValid) {
        setValidationResult(result);
        setSuccess(`Legacy account verified! Balance: ${ethers.formatUnits(result.balance || '0', 6)} XOM (legacy)`);
        setActiveStep(MigrationStep.CREATE_WALLET);
      } else {
        setError(result.error || 'Invalid credentials');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify legacy account');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Step 2: Create new wallet
   */
  const handleCreateWallet = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
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
    } catch (err: any) {
      // If username exists, try login instead
      if (err.message.includes('already exists')) {
        try {
          const session = await keyringManager.loginUser({
            username,
            password: newPassword
          });
          setNewAddress(session.accounts.omnicoin.address);
          setSuccess('Wallet accessed successfully!');
          setActiveStep(MigrationStep.CLAIM_BALANCE);
        } catch (loginErr: any) {
          setError('Username exists but password is incorrect');
        }
      } else {
        setError(err.message || 'Failed to create wallet');
      }
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Step 3: Claim legacy balance
   */
  const handleClaimBalance = async () => {
    if (!migrationService || !newAddress) {
      setError('Migration not properly initialized');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await migrationService.claimLegacyBalance(
        username,
        password, // Legacy password for verification
        newAddress
      );
      
      if (result.success) {
        setClaimResult(result);
        setSuccess(`Successfully claimed ${result.amount} XOM!`);
        setActiveStep(MigrationStep.COMPLETE);
        
        // Notify parent component
        setTimeout(() => {
          onSuccess(username, newAddress, result.amount || '0');
        }, 2000);
      } else {
        setError(result.error || 'Failed to claim balance');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to claim balance');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Reset form
   */
  const handleReset = () => {
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
   */
  const formatBalance = (balance: string, decimals: number = 18): string => {
    try {
      return ethers.formatUnits(balance, decimals);
    } catch {
      return '0';
    }
  };
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          minHeight: '60vh'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <HistoryIcon color="primary" />
            <Typography variant="h6">Legacy Account Migration</Typography>
            <Chip 
              label="OmniCoin v1 → v2" 
              size="small" 
              color="info"
              variant="outlined"
            />
          </Box>
          <Box>
            <Tooltip title="Help">
              <IconButton size="small" onClick={() => setShowHelp(!showHelp)}>
                <HelpIcon />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {/* Help Section */}
        <Collapse in={showHelp}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>Legacy Migration Help</AlertTitle>
            <Typography variant="body2" paragraph>
              This tool helps legacy OmniCoin v1 users migrate their accounts to the new system.
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon><CheckCircleIcon fontSize="small" /></ListItemIcon>
                <ListItemText 
                  primary="Step 1: Verify your legacy account"
                  secondary="Enter your v1 username and password"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon fontSize="small" /></ListItemIcon>
                <ListItemText 
                  primary="Step 2: Create new wallet"
                  secondary="Set a new secure password for v2"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircleIcon fontSize="small" /></ListItemIcon>
                <ListItemText 
                  primary="Step 3: Claim your balance"
                  secondary="Transfer tokens to your new wallet"
                />
              </ListItem>
            </List>
            <Typography variant="body2" color="warning.main">
              Note: The "null" account cannot be migrated (tokens were burned).
            </Typography>
          </Alert>
        </Collapse>
        
        {/* Migration Status */}
        {migrationStatus && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <AccountBalanceIcon color="primary" />
              <Typography variant="subtitle2">Account Status</Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Legacy Balance
                </Typography>
                <Typography variant="body1">
                  {formatBalance(migrationStatus.legacyBalance, 6)} XOM
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  New Balance (18 decimals)
                </Typography>
                <Typography variant="body1">
                  {formatBalance(migrationStatus.newBalance, 18)} XOM
                </Typography>
              </Grid>
              {migrationStatus.isClaimed && (
                <Grid item xs={12}>
                  <Alert severity="warning">
                    This account was already migrated on {
                      new Date(migrationStatus.claimTimestamp! * 1000).toLocaleDateString()
                    }
                  </Alert>
                </Grid>
              )}
            </Grid>
          </Paper>
        )}
        
        {/* Error/Success Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}
        
        {/* Migration Steps */}
        <Stepper activeStep={activeStep} orientation="vertical">
          {/* Step 1: Verify Legacy Account */}
          <Step>
            <StepLabel
              StepIconComponent={() => <VpnKeyIcon color={activeStep >= 0 ? "primary" : "disabled"} />}
            >
              Verify Legacy Account
            </StepLabel>
            <StepContent>
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="Legacy Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  margin="normal"
                  helperText={
                    username.toLowerCase() === 'null' 
                      ? "This account cannot be migrated (burned tokens)"
                      : "Enter your OmniCoin v1 username"
                  }
                  error={username.toLowerCase() === 'null'}
                  disabled={loading}
                />
                <TextField
                  fullWidth
                  type="password"
                  label="Legacy Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  margin="normal"
                  helperText="Enter your OmniCoin v1 password"
                  disabled={loading || username.toLowerCase() === 'null'}
                />
              </Box>
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleVerifyLegacy}
                  disabled={!username || !password || loading || username.toLowerCase() === 'null'}
                  sx={{ mr: 1 }}
                >
                  Verify Account
                </Button>
              </Box>
            </StepContent>
          </Step>
          
          {/* Step 2: Create New Wallet */}
          <Step>
            <StepLabel
              StepIconComponent={() => <WalletIcon color={activeStep >= 1 ? "primary" : "disabled"} />}
            >
              Create New Wallet
            </StepLabel>
            <StepContent>
              <Alert severity="info" sx={{ mb: 2 }}>
                Your username will remain the same, but you need to set a new secure password for v2.
              </Alert>
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  type="password"
                  label="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  margin="normal"
                  helperText="Minimum 12 characters"
                  disabled={loading}
                />
                <TextField
                  fullWidth
                  type="password"
                  label="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  margin="normal"
                  error={confirmPassword !== '' && confirmPassword !== newPassword}
                  helperText={
                    confirmPassword !== '' && confirmPassword !== newPassword
                      ? "Passwords do not match"
                      : "Re-enter your new password"
                  }
                  disabled={loading}
                />
              </Box>
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleCreateWallet}
                  disabled={!newPassword || newPassword !== confirmPassword || loading}
                  sx={{ mr: 1 }}
                >
                  Create Wallet
                </Button>
                <Button onClick={() => setActiveStep(MigrationStep.VERIFY_LEGACY)}>
                  Back
                </Button>
              </Box>
            </StepContent>
          </Step>
          
          {/* Step 3: Claim Balance */}
          <Step>
            <StepLabel
              StepIconComponent={() => <TransformIcon color={activeStep >= 2 ? "primary" : "disabled"} />}
            >
              Claim Your Balance
            </StepLabel>
            <StepContent>
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Migration Summary
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" color="text.secondary">
                    Legacy Balance (6 decimals):
                  </Typography>
                  <Typography variant="body2">
                    {validationResult ? formatBalance(validationResult.balance!, 6) : '0'} XOM
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" color="text.secondary">
                    New Balance (18 decimals):
                  </Typography>
                  <Typography variant="body2" color="primary">
                    {validationResult ? formatBalance(
                      (BigInt(validationResult.balance!) * BigInt(10 ** 12)).toString(),
                      18
                    ) : '0'} XOM
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Recipient Address:
                  </Typography>
                  <Typography variant="body2" sx={{ 
                    fontFamily: 'monospace',
                    fontSize: '0.75rem'
                  }}>
                    {newAddress ? `${newAddress.slice(0, 6)}...${newAddress.slice(-4)}` : ''}
                  </Typography>
                </Box>
              </Paper>
              
              <Alert severity="warning" sx={{ mb: 2 }}>
                This action cannot be undone. Once claimed, your legacy balance will be transferred to your new wallet.
              </Alert>
              
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleClaimBalance}
                  disabled={loading}
                  sx={{ mr: 1 }}
                >
                  Claim Balance
                </Button>
                <Button onClick={() => setActiveStep(MigrationStep.CREATE_WALLET)}>
                  Back
                </Button>
              </Box>
            </StepContent>
          </Step>
          
          {/* Step 4: Complete */}
          <Step>
            <StepLabel
              StepIconComponent={() => <CheckCircleIcon color="success" />}
            >
              Migration Complete
            </StepLabel>
            <StepContent>
              <Alert severity="success" sx={{ mb: 2 }}>
                <AlertTitle>Migration Successful!</AlertTitle>
                Your legacy balance has been successfully transferred to your new wallet.
              </Alert>
              
              {claimResult && (
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Transaction Details
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      Amount Claimed:
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      {claimResult.amount} XOM
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Transaction Hash:
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      fontFamily: 'monospace',
                      fontSize: '0.75rem'
                    }}>
                      {claimResult.txHash ? `${claimResult.txHash.slice(0, 10)}...` : ''}
                    </Typography>
                  </Box>
                </Paper>
              )}
              
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="contained"
                  onClick={onClose}
                >
                  Close
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
        
        {/* Loading Indicator */}
        {loading && <LinearProgress sx={{ mt: 2 }} />}
      </DialogContent>
      
      <DialogActions>
        {activeStep < MigrationStep.COMPLETE && (
          <>
            <Button onClick={handleReset} disabled={loading}>
              Reset
            </Button>
            <Button onClick={onClose} disabled={loading}>
              Cancel
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

// Missing import for Grid
import { Grid } from '@mui/material';

export default LegacyLoginModal;