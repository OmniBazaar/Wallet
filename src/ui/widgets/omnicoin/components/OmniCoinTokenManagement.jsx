import React, { useState } from 'react';
import styled from 'styled-components';
import { useOmniCoinToken } from '../hooks/useOmniCoinToken';
import OmniCoinTooltip from './OmniCoinTooltip';
import OmniCoinToast from './OmniCoinToast';

const TokenList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const TokenItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
`;

const TokenInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const TokenSymbol = styled.div`
  font-weight: 600;
  color: #212529;
`;

const TokenBalance = styled.div`
  font-size: 14px;
  color: #6c757d;
`;

const TokenActions = styled.div`
  display: flex;
  gap: 8px;
`;

const ActionButton = styled.button`
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ApproveButton = styled(ActionButton)`
  background: #e9ecef;
  color: #495057;
  
  &:hover:not(:disabled) {
    background: #dee2e6;
  }
`;

const SendButton = styled(ActionButton)`
  background: #007bff;
  color: white;
  
  &:hover:not(:disabled) {
    background: #0056b3;
  }
`;

const TooltipLabel = styled.span`
  margin-left: 4px;
`;

const OmniCoinTokenManagement = () => {
    const { tokens, approveToken, transferToken } = useOmniCoinToken();
    const [selectedToken, setSelectedToken] = useState(null);
    const [toast, setToast] = useState(null);

    const handleApprove = async (token) => {
        setToast({ message: `Approving ${token.symbol}...`, type: 'pending' });
        try {
            await approveToken(token.address);
            setToast({ message: `${token.symbol} approved successfully!`, type: 'success' });
        } catch (error) {
            setToast({ message: `Error approving ${token.symbol}: ${error.message || error}`, type: 'error' });
        }
    };

    const handleSend = (token) => {
        setSelectedToken(token);
        setToast({ message: `Send ${token.symbol} feature coming soon.`, type: 'info' });
        // TODO: Implement send token flow
    };

    return (
        <>
            {toast && (
                <OmniCoinToast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
            <TokenList data-testid="token-list">
                {tokens.map((token) => (
                    <TokenItem key={token.address} data-testid="token-item">
                        <TokenInfo>
                            <TokenSymbol>
                                {token.symbol}
                                <TooltipLabel>
                                    <OmniCoinTooltip text={`${token.symbol} token contract address: ${token.address}`}>?</OmniCoinTooltip>
                                </TooltipLabel>
                            </TokenSymbol>
                            <TokenBalance data-testid="token-balance">
                                {token.balance} {token.symbol}
                            </TokenBalance>
                        </TokenInfo>
                        <TokenActions>
                            <ApproveButton
                                data-testid="approve-token"
                                onClick={() => handleApprove(token)}
                                disabled={token.isApproved}
                            >
                                {token.isApproved ? 'Approved' : 'Approve'}
                            </ApproveButton>
                            <SendButton
                                data-testid="send-token"
                                onClick={() => handleSend(token)}
                            >
                                Send
                            </SendButton>
                        </TokenActions>
                    </TokenItem>
                ))}
            </TokenList>
        </>
    );
};

export default OmniCoinTokenManagement;
