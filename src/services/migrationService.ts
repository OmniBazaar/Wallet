/**
 * Migration service for legacy OmniCoin balance transfers
 */

import axios from 'axios';
import { ethers } from 'ethers';
// Note: VirtualWitnessNode import commented out - module path needs verification

/** API URL for migration service */
const API_URL = (process?.env?.['REACT_APP_MIGRATION_API_URL']) ?? 'http://localhost:3001';

/** Result of migration operation */
interface MigrationResult {
  success: boolean;
  error?: string;
  balance?: string;
}

/** Verification response from migration API */
interface VerifyResponse {
  verified: boolean;
  balance?: string;
}

/** Migration response from migration API */
interface MigrationResponse {
  success: boolean;
  error?: string;
}

/** Status response from migration API */
interface StatusResponse {
  status: string;
  balance?: string;
}

/**
 * Migrate legacy OmniCoin balance to new wallet
 * @param username Legacy account username
 * @param password Legacy account password
 * @param newWalletAddress New wallet address to receive funds
 * @returns Promise resolving to migration result
 */
export const migrateLegacyBalance = async (
  username: string,
  password: string,
  newWalletAddress: string
): Promise<MigrationResult> => {
  try {
    // Verify credentials and get balance through migration API
    const verifyResponse = await axios.post<VerifyResponse>(`${API_URL}/verify`, {
      username,
      password,
    });

    if (verifyResponse.data.verified !== true) {
      return {
        success: false,
        error: 'Invalid credentials',
      };
    }

    // Extract balance from verification response
    const balance = verifyResponse.data.balance ?? '0';
    
    if (balance === '0') {
      return {
        success: false,
        error: 'No OmniCoin balance found',
      };
    }

    // Initiate migration
    const migrationResponse = await axios.post<MigrationResponse>(`${API_URL}/migrate`, {
      username,
      balance,
      newWalletAddress,
    });

    if (migrationResponse.data.success !== true) {
      return {
        success: false,
        error: migrationResponse.data.error ?? 'Migration failed',
      };
    }

    return {
      success: true,
      balance,
    };
  } catch (error) {
    console.warn('Migration error:', error);
    return {
      success: false,
      error: 'An error occurred during migration',
    };
  }
};

/**
 * Get migration status for a legacy username from the migration API.
 * @param username Legacy username to query
 * @returns Promise resolving to status and optional balance
 */
export const getMigrationStatus = async (
  username: string
): Promise<{ status: string; balance?: string }> => {
  try {
    const response = await axios.get<StatusResponse>(`${API_URL}/status/${username}`);
    return response.data;
  } catch (error) {
    console.warn('Error getting migration status:', error);
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
    console.warn('Failed to convert legacy balance:', error);
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
    console.warn('Failed to convert legacy amount:', error);
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
    console.warn('Failed to format balance:', error);
    return '0.0000';
  }
};

/**
 * Enhanced migration function that handles decimal conversion
 * @param username Legacy account username
 * @param password Legacy account password  
 * @param newWalletAddress New wallet address to receive funds
 * @returns Promise resolving to migration result with converted balance
 */
export const migrateLegacyBalanceWithConversion = async (
  username: string,
  password: string,
  newWalletAddress: string
): Promise<MigrationResult & { convertedBalance?: string }> => {
  const result = await migrateLegacyBalance(username, password, newWalletAddress);

  if (result.success && result.balance !== undefined && result.balance !== '') {
    // Convert the 6-decimal balance to 18 decimals
    const convertedBalance = convertLegacyBalance(result.balance);

    return {
      ...result,
      convertedBalance,
    };
  }

  return result;
};
