import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import { useWallet } from '../contexts/WalletContext';
import { migrateLegacyBalance } from '../services/migrationService';

interface MigrationFormData {
  username: string;
  password: string;
}

const MigrationTab: React.FC = () => {
  const { address } = useWallet();
  const [formData, setFormData] = useState<MigrationFormData>({
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Verify legacy account and get balance
      const result = await migrateLegacyBalance(
        formData.username,
        formData.password,
        address
      );

      if (result.success) {
        setSuccess(true);
        setFormData({ username: '', password: '' });
      } else {
        setError(result.error || 'Migration failed. Please try again.');
      }
    } catch (err) {
      setError('An error occurred during migration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Migrate Legacy OmniCoin Balance
      </Typography>
      
      <Paper sx={{ p: 3, mt: 2 }}>
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Legacy Username"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            margin="normal"
            required
            disabled={loading}
          />
          
          <TextField
            fullWidth
            label="Legacy Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleInputChange}
            margin="normal"
            required
            disabled={loading}
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 3 }}
            disabled={loading || !formData.username || !formData.password}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              'Migrate Balance'
            )}
          </Button>
        </form>
      </Paper>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={success}
        autoHideDuration={6000}
        onClose={() => setSuccess(false)}
      >
        <Alert severity="success" onClose={() => setSuccess(false)}>
          Migration successful! Your balance has been transferred.
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MigrationTab; 