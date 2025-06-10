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
  background: #ffffff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  @media (max-width: 600px) {
    border-radius: 0;
    box-shadow: none;
    padding: 0;
  }
`;

const Header = styled.div`
  background: #f8f9fa;
  padding: 16px;
  border-bottom: 1px solid #e9ecef;
`;

const NetworkSelector = styled.select`
  background: #ffffff;
  border: 1px solid #ced4da;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 14px;
  color: #495057;
  cursor: pointer;
  margin-left: 12px;
`;

const AccountInfo = styled.div`
  padding: 16px;
  background: #ffffff;
  border-bottom: 1px solid #e9ecef;
`;

const Address = styled.div`
  font-family: monospace;
  font-size: 14px;
  color: #6c757d;
  margin-bottom: 8px;
  word-break: break-all;
`;

const Balance = styled.div`
  font-size: 20px;
  font-weight: 600;
  color: #212529;
`;

const TabContainer = styled.div`
  display: flex;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
`;

const Tab = styled.button`
  padding: 12px 24px;
  background: ${props => props.active ? '#ffffff' : 'transparent'};
  border: none;
  border-bottom: 2px solid ${props => props.active ? '#007bff' : 'transparent'};
  cursor: pointer;
  font-weight: ${props => props.active ? '600' : '400'};
  color: ${props => props.active ? '#007bff' : '#495057'};
  
  &:hover {
    color: #007bff;
  }
`;

const TabContent = styled.div`
  padding: 24px;
  background: #ffffff;
`;

const TooltipLabel = styled.span`
  margin-left: 4px;
`;

const OmniCoinIntegratedWallet = () => {
    const [activeTab, setActiveTab] = useState('tokens');
    const { account, balance, network, switchNetwork, isLoading } = useOmniCoin();
    const { tokens } = useOmniCoinToken();

    const handleNetworkChange = (event) => {
        switchNetwork(event.target.value);
    };

    return (
        <OmniCoinErrorBoundary>
            <WalletContainer data-testid="integrated-wallet">
                <Header>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 style={{ margin: 0 }}>
                            Wallet
                            <TooltipLabel>
                                <OmniCoinTooltip text="This is your wallet tab inside OmniBazaar. Manage tokens, view history, and switch networks.">?</OmniCoinTooltip>
                            </TooltipLabel>
                        </h3>
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
                        Transaction History
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
                                    <h4>Wallet Settings</h4>
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

export default OmniCoinIntegratedWallet; 