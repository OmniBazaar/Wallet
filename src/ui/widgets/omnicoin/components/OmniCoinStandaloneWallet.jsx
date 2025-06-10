import React, { useState } from 'react';
import styled from 'styled-components';
import { useOmniCoin } from '../hooks/useOmniCoin';
import { useOmniCoinToken } from '../hooks/useOmniCoinToken';
import { OmniCoinTransactionHistory } from './OmniCoinTransactionHistory';
import { OmniCoinTokenManagement } from './OmniCoinTokenManagement';
import OmniCoinErrorBoundary from './OmniCoinErrorBoundary';
import OmniCoinLoading from './OmniCoinLoading';
import OmniCoinTooltip from './OmniCoinTooltip';

const WalletContainer = styled.div`
  width: 100%;
  max-width: 360px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  @media (max-width: 480px) {
    max-width: 100vw;
    border-radius: 0;
    box-shadow: none;
  }
`;

const Header = styled.div`
  background: #1a1a1a;
  color: #ffffff;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const NetworkSelector = styled.select`
  background: transparent;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
`;

const AccountInfo = styled.div`
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
`;

const Address = styled.div`
  font-family: monospace;
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
  word-break: break-all;
`;

const Balance = styled.div`
  font-size: 24px;
  font-weight: bold;
  color: #1a1a1a;
`;

const TabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #e0e0e0;
`;

const Tab = styled.button`
  flex: 1;
  padding: 12px;
  background: ${props => props.active ? '#f5f5f5' : 'transparent'};
  border: none;
  cursor: pointer;
  font-weight: ${props => props.active ? 'bold' : 'normal'};
  color: ${props => props.active ? '#1a1a1a' : '#666'};
  
  &:hover {
    background: #f5f5f5;
  }
`;

const TabContent = styled.div`
  padding: 16px;
`;

const TooltipLabel = styled.span`
  margin-left: 4px;
`;

const OmniCoinStandaloneWallet = () => {
    const [activeTab, setActiveTab] = useState('tokens');
    const { account, balance, network, switchNetwork, isLoading } = useOmniCoin();
    const { tokens } = useOmniCoinToken();

    const handleNetworkChange = (event) => {
        switchNetwork(event.target.value);
    };

    return (
        <OmniCoinErrorBoundary>
            <WalletContainer data-testid="wallet-container">
                <Header>
                    <h2>
                        OmniCoin Wallet
                        <TooltipLabel>
                            <OmniCoinTooltip text="This is your standalone OmniCoin wallet. You can manage tokens, view history, and switch networks here.">?</OmniCoinTooltip>
                        </TooltipLabel>
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <NetworkSelector
                            data-testid="network-selector"
                            value={network}
                            onChange={handleNetworkChange}
                        >
                            <option value="ethereum">Ethereum Mainnet</option>
                            <option value="polygon">Polygon</option>
                            <option value="bsc">BSC</option>
                            <option value="arbitrum">Arbitrum</option>
                            <option value="optimism">Optimism</option>
                        </NetworkSelector>
                        <TooltipLabel>
                            <OmniCoinTooltip text="Switch between supported blockchains.">?</OmniCoinTooltip>
                        </TooltipLabel>
                    </div>
                </Header>

                <AccountInfo>
                    <Address data-testid="wallet-address">
                        {account}
                        <TooltipLabel>
                            <OmniCoinTooltip text="This is your wallet address. Copy and share it to receive tokens.">?</OmniCoinTooltip>
                        </TooltipLabel>
                    </Address>
                    <Balance data-testid="token-balance">
                        {balance} OMN
                        <TooltipLabel>
                            <OmniCoinTooltip text="Your current OmniCoin balance.">?</OmniCoinTooltip>
                        </TooltipLabel>
                    </Balance>
                </AccountInfo>

                <TabContainer>
                    <Tab
                        data-testid="tokens-tab"
                        active={activeTab === 'tokens'}
                        onClick={() => setActiveTab('tokens')}
                    >
                        Tokens
                        <TooltipLabel>
                            <OmniCoinTooltip text="Manage your tokens here.">?</OmniCoinTooltip>
                        </TooltipLabel>
                    </Tab>
                    <Tab
                        data-testid="history-tab"
                        active={activeTab === 'history'}
                        onClick={() => setActiveTab('history')}
                    >
                        History
                        <TooltipLabel>
                            <OmniCoinTooltip text="View your transaction history.">?</OmniCoinTooltip>
                        </TooltipLabel>
                    </Tab>
                    <Tab
                        data-testid="settings-tab"
                        active={activeTab === 'settings'}
                        onClick={() => setActiveTab('settings')}
                    >
                        Settings
                        <TooltipLabel>
                            <OmniCoinTooltip text="Wallet settings and preferences.">?</OmniCoinTooltip>
                        </TooltipLabel>
                    </Tab>
                </TabContainer>

                <TabContent>
                    {isLoading ? (
                        <OmniCoinLoading data-testid="loading-spinner" text="Loading wallet data..." />
                    ) : (
                        <>
                            {activeTab === 'tokens' && (
                                <OmniCoinTokenManagement />
                            )}
                            {activeTab === 'history' && (
                                <OmniCoinTransactionHistory />
                            )}
                            {activeTab === 'settings' && (
                                <div>
                                    <h3>Settings</h3>
                                    {/* Add settings content */}
                                </div>
                            )}
                        </>
                    )}
                </TabContent>
            </WalletContainer>
        </OmniCoinErrorBoundary>
    );
};

export default OmniCoinStandaloneWallet; 