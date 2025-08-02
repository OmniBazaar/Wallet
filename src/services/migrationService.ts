import axios from 'axios';
import { ethers } from 'ethers';
import { VirtualWitnessNode } from '../../../Migrate/virtual_witness_node';

const API_URL = process.env.REACT_APP_MIGRATION_API_URL || 'http://localhost:3001';

interface MigrationResult {
  success: boolean;
  error?: string;
  balance?: string;
}

export const migrateLegacyBalance = async (
  username: string,
  password: string,
  newWalletAddress: string
): Promise<MigrationResult> => {
  try {
    // Initialize virtual witness node
    const node = new VirtualWitnessNode(process.env.REACT_APP_WITNESS_NODE_DATA_DIR || 'witness_node_data_dir');

    // Verify legacy account
    const account = node.get_account(username);
    if (!account) {
      return {
        success: false,
        error: 'Legacy account not found',
      };
    }

    // Get account balances
    const balances = node.get_balances(account.id);
    if (!balances || balances.length === 0) {
      return {
        success: false,
        error: 'No balance found for this account',
      };
    }

    // Find OmniCoin balance
    const omnicoinBalance = balances.find(balance => {
      const asset = node.get_asset(balance.asset_id);
      return asset && asset.symbol === 'OMNI';
    });

    if (!omnicoinBalance) {
      return {
        success: false,
        error: 'No OmniCoin balance found',
      };
    }

    // Verify credentials with migration API
    const verifyResponse = await axios.post(`${API_URL}/verify`, {
      username,
      password,
      accountId: account.id,
    });

    if (!verifyResponse.data.verified) {
      return {
        success: false,
        error: 'Invalid credentials',
      };
    }

    // Initiate migration
    const migrationResponse = await axios.post(`${API_URL}/migrate`, {
      username,
      accountId: account.id,
      balance: omnicoinBalance.amount.toString(),
      newWalletAddress,
    });

    if (!migrationResponse.data.success) {
      return {
        success: false,
        error: migrationResponse.data.error || 'Migration failed',
      };
    }

    return {
      success: true,
      balance: omnicoinBalance.amount.toString(),
    };
  } catch (error) {
    console.error('Migration error:', error);
    return {
      success: false,
      error: 'An error occurred during migration',
    };
  }
};

export const getMigrationStatus = async (
  username: string
): Promise<{ status: string; balance?: string }> => {
  try {
    const response = await axios.get(`${API_URL}/status/${username}`);
    return response.data;
  } catch (error) {
    console.error('Error getting migration status:', error);
    throw new Error('Failed to get migration status');
  }
};

// =============================================================================
// DECIMAL CONVERSION UTILITIES
// =============================================================================

/**
 * Conversion constants for legacy balance migration
 */
export const LEGACY_DECIMALS = 6;
export const NEW_DECIMALS = 18;
export const CONVERSION_FACTOR = BigInt(10 ** (NEW_DECIMALS - LEGACY_DECIMALS)); // 10^12

/**
 * Convert a legacy balance from 6 decimals to 18 decimals
 * @param legacyBalance Balance with 6 decimals as string
 * @returns Converted balance with 18 decimals as string
 */
export const convertLegacyBalance = (legacyBalance: string): string => {
  try {
    // Parse the legacy balance (6 decimals)
    const legacyBigInt = BigInt(legacyBalance);
    
    // Multiply by conversion factor (10^12) to get 18 decimals
    const newBalance = legacyBigInt * CONVERSION_FACTOR;
    
    return newBalance.toString();
  } catch (error) {
    console.error('Failed to convert legacy balance:', error);
    throw new Error(`Invalid legacy balance: ${legacyBalance}`);
  }
};

/**
 * Convert a human-readable amount with 6 decimals to 18 decimals
 * @param amount Human-readable amount (e.g., "100.5" XOM)
 * @returns Amount with 18 decimals as string
 */
export const convertLegacyAmount = (amount: string): string => {
  try {
    // First parse with 6 decimals to get the base units
    const baseUnits = ethers.parseUnits(amount, LEGACY_DECIMALS);
    
    // Then multiply by conversion factor
    const newBaseUnits = baseUnits * CONVERSION_FACTOR;
    
    return newBaseUnits.toString();
  } catch (error) {
    console.error('Failed to convert legacy amount:', error);
    throw new Error(`Invalid amount: ${amount}`);
  }
};

/**
 * Format balance for display with proper decimal places
 * @param balance Balance as string (with 18 decimals)
 * @param displayDecimals Number of decimal places to show (default: 4)
 * @returns Formatted balance string
 */
export const formatBalance = (balance: string, displayDecimals: number = 4): string => {
  try {
    // Use ethers to format with 18 decimals
    const formatted = ethers.formatUnits(balance, NEW_DECIMALS);
    
    // Parse and format to desired decimal places
    const num = parseFloat(formatted);
    return num.toFixed(displayDecimals);
  } catch (error) {
    console.error('Failed to format balance:', error);
    return '0.0000';
  }
};

/**
 * Enhanced migration function that handles decimal conversion
 */
export const migrateLegacyBalanceWithConversion = async (
  username: string,
  password: string,
  newWalletAddress: string
): Promise<MigrationResult & { convertedBalance?: string }> => {
  const result = await migrateLegacyBalance(username, password, newWalletAddress);
  
  if (result.success && result.balance) {
    // Convert the 6-decimal balance to 18 decimals
    const convertedBalance = convertLegacyBalance(result.balance);
    
    return {
      ...result,
      convertedBalance,
    };
  }
  
  return result;
}; 