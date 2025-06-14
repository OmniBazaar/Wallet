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