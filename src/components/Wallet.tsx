import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  AppBar,
  Toolbar,
  Typography,
  Container,
} from '@mui/material';
import { useWallet } from '../contexts/WalletContext';
import BalanceTab from './BalanceTab';
import SendTab from './SendTab';
import ReceiveTab from './ReceiveTab';
import MigrationTab from './MigrationTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`wallet-tabpanel-${index}`}
      aria-labelledby={`wallet-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const Wallet: React.FC = () => {
  const { address, balance } = useWallet();
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            OmniWallet
          </Typography>
          {address && (
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {address.slice(0, 6)}...{address.slice(-4)}
            </Typography>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="md">
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="wallet tabs"
            variant="fullWidth"
          >
            <Tab label="Balance" />
            <Tab label="Send" />
            <Tab label="Receive" />
            <Tab label="Migrate" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <BalanceTab />
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <SendTab />
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <ReceiveTab />
        </TabPanel>
        <TabPanel value={tabValue} index={3}>
          <MigrationTab />
        </TabPanel>
      </Container>
    </Box>
  );
};

export default Wallet; 