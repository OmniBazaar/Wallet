import React, { useState } from 'react';
import styled from 'styled-components';
import { useTokenBalance } from '../../../../../hooks/useTokenBalance';
import { useTokenTransfer } from '../../../../../hooks/useTokenTransfer';
import { OmniCoinLoading } from './OmniCoinLoading';
import { OmniCoinToast } from './OmniCoinToast';
import { OmniCoinTooltip } from './OmniCoinTooltip';

const BalanceContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: ${props => props.theme.colors.background};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const TokenInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const TokenIcon = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 50%;
`;

const TokenDetails = styled.div`
  flex: 1;
`;

const TokenName = styled.h3`
  margin: 0;
  font-size: 1rem;
  color: ${props => props.theme.colors.text.primary};
`;

const TokenSymbol = styled.span`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
`;

const BalanceAmount = styled.div`
  font-size: 1.25rem;
  font-weight: bold;
  color: ${props => props.theme.colors.text.primary};
`;

const TransferForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Input = styled.input`
  padding: 0.5rem;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  font-size: 0.875rem;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  background: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    background: ${props => props.theme.colors.disabled};
    cursor: not-allowed;
  }
`;

interface TokenBalanceProps {
  tokenAddress: string;
}

export const TokenBalance: React.FC<TokenBalanceProps> = ({ tokenAddress }) => {
  const { tokenInfo, balance: _balance, formattedBalance, isLoading: isBalanceLoading, error: balanceError } = useTokenBalance(tokenAddress);
  const { transfer, isTransferring, error: transferError } = useTokenTransfer(tokenAddress);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info' | 'pending'>('info');

  const handleTransfer = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!tokenInfo) return;

    try {
      setToastType('pending');
      setToastMessage('Processing transfer...');
      setShowToast(true);

      const _tx = await transfer(recipient, amount);

      setToastType('success');
      setToastMessage('Transfer successful!');
      setRecipient('');
      setAmount('');
    } catch (err) {
      setToastType('error');
      setToastMessage(err instanceof Error ? err.message : 'Transfer failed');
    }
  };

  if (isBalanceLoading) {
    return <OmniCoinLoading text="Loading token balance..." />;
  }

  if (balanceError) {
    return <OmniCoinToast type="error" message={balanceError} />;
  }

  if (!tokenInfo) {
    return <OmniCoinToast type="error" message="Token not found" />;
  }

  return (
    <BalanceContainer>
      {showToast && (
        <OmniCoinToast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}

      <TokenInfo>
        <TokenIcon src={tokenInfo.logoURI} alt={tokenInfo.symbol} />
        <TokenDetails>
          <TokenName>{tokenInfo.name}</TokenName>
          <TokenSymbol>{tokenInfo.symbol}</TokenSymbol>
        </TokenDetails>
        <BalanceAmount>
          <OmniCoinTooltip content="Your current token balance">
            {formattedBalance} {tokenInfo.symbol}
          </OmniCoinTooltip>
        </BalanceAmount>
      </TokenInfo>

      <TransferForm onSubmit={handleTransfer} aria-label="Token Transfer Form">
        <Input
          type="text"
          placeholder="Recipient Address"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          required
          aria-label="Recipient Address"
        />
        <Input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          min="0"
          step="any"
          aria-label="Amount"
        />
        <Button type="submit" disabled={isTransferring} aria-label="Transfer Token">
          {isTransferring ? 'Transferring...' : 'Transfer'}
        </Button>
      </TransferForm>

      {transferError && (
        <OmniCoinToast type="error" message={transferError} />
      )}
    </BalanceContainer>
  );
}; 