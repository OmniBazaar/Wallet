import { useState, CSSProperties, FC, ChangeEvent, FormEvent } from 'react';
import { useTokenBalance } from '../../../../hooks/useTokenBalance';
import { useTokenTransfer } from '../../../../hooks/useTokenTransfer';
import { OmniCoinLoading } from './OmniCoinLoading';
import { OmniCoinToast } from './OmniCoinToast';

const balanceContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  padding: '1rem',
  background: '#ffffff',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
};

const tokenInfoStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem'
};

const tokenIconStyle: CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '50%'
};

const tokenDetailsStyle: CSSProperties = {
  flex: 1
};

const tokenNameStyle: CSSProperties = {
  margin: '0',
  fontSize: '1rem',
  color: '#1f2937'
};

const tokenSymbolStyle: CSSProperties = {
  fontSize: '0.875rem',
  color: '#6b7280'
};

const balanceAmountStyle: CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 'bold',
  color: '#1f2937'
};

const transferFormStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem'
};

const inputStyle: CSSProperties = {
  padding: '0.5rem',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  fontSize: '0.875rem'
};

const buttonStyle: CSSProperties = {
  padding: '0.5rem 1rem',
  background: '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
};

const buttonDisabledStyle: CSSProperties = {
  ...buttonStyle,
  background: '#9ca3af',
  cursor: 'not-allowed'
};

interface TokenBalanceProps {
  tokenAddress: string;
}

/**
 * Component for displaying token balance and transfer functionality
 * @param props - Component props
 * @param props.tokenAddress - The address of the token contract
 * @returns Token balance component
 */
export const TokenBalance: FC<TokenBalanceProps> = ({ tokenAddress }) => {
  const { tokenInfo, balance: _balance, formattedBalance, isLoading: isBalanceLoading, error: balanceError } = useTokenBalance(tokenAddress);
  const { transfer, isTransferring, error: transferError } = useTokenTransfer(tokenAddress);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info' | 'pending'>('info');

  /**
   * Handle token transfer form submission
   * @param e - Form event
   */
  const handleTransfer = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (tokenInfo === null) return;

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

  /**
   * Handle input change with proper typing
   * @param e - Change event
   */
  const handleRecipientChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setRecipient(e.target.value);
  };

  /**
   * Handle amount change with proper typing
   * @param e - Change event
   */
  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setAmount(e.target.value);
  };

  if (isBalanceLoading) {
    return <OmniCoinLoading text="Loading token balance..." />;
  }

  if (typeof balanceError === 'string' && balanceError.length > 0) {
    return <OmniCoinToast type="error" message={balanceError} />;
  }

  if (tokenInfo === null) {
    return <OmniCoinToast type="error" message="Token not found" />;
  }

  return (
    <div style={balanceContainerStyle} data-testid="token-balance-container">
      {showToast && (
        <OmniCoinToast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}

      <div style={tokenInfoStyle}>
        {typeof tokenInfo.logoURI === 'string' && tokenInfo.logoURI.length > 0 && (
          <img 
            src={tokenInfo.logoURI} 
            alt={tokenInfo.symbol}
            style={tokenIconStyle}
          />
        )}
        <div style={tokenDetailsStyle}>
          <h3 style={tokenNameStyle}>{tokenInfo.name}</h3>
          <span style={tokenSymbolStyle}>{tokenInfo.symbol}</span>
        </div>
        <div style={balanceAmountStyle} title="Your current token balance">
          {formattedBalance} {tokenInfo.symbol}
        </div>
      </div>

      <form style={transferFormStyle} onSubmit={(e) => { void handleTransfer(e); }} aria-label="Token Transfer Form">
        <input
          type="text"
          placeholder="Recipient Address"
          value={recipient}
          onChange={handleRecipientChange}
          required
          aria-label="Recipient Address"
          style={inputStyle}
        />
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={handleAmountChange}
          required
          min="0"
          step="any"
          aria-label="Amount"
          style={inputStyle}
        />
        <button 
          type="submit" 
          disabled={isTransferring} 
          aria-label="Transfer Token"
          style={isTransferring ? buttonDisabledStyle : buttonStyle}
        >
          {isTransferring ? 'Transferring...' : 'Transfer'}
        </button>
      </form>

      {typeof transferError === 'string' && transferError.length > 0 && (
        <OmniCoinToast type="error" message={transferError} />
      )}
    </div>
  );
}; 