import React, { useState } from 'react';
import styled from 'styled-components';
import { useOmniCoin } from '../providers/OmniCoinProvider';
import { useOmniCoinToken } from '../hooks/useOmniCoinToken';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  padding: 24px;
  background: ${props => props.theme.background};
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
`;

const Title = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: ${props => props.theme.text};
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  color: ${props => props.theme.textSecondary};
  font-size: 14px;
`;

const Input = styled.input`
  padding: 12px;
  border: 1px solid ${props => props.theme.border};
  border-radius: 8px;
  font-size: 16px;
  background: ${props => props.theme.inputBackground};
  color: ${props => props.theme.text};

  &:focus {
    outline: none;
    border-color: ${props => props.theme.primary};
  }
`;

const Select = styled.select`
  padding: 12px;
  border: 1px solid ${props => props.theme.border};
  border-radius: 8px;
  font-size: 16px;
  background: ${props => props.theme.inputBackground};
  color: ${props => props.theme.text};

  &:focus {
    outline: none;
    border-color: ${props => props.theme.primary};
  }
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  background: ${props => props.theme.primary};
  color: ${props => props.theme.buttonText};
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.p`
  color: ${props => props.theme.error};
  font-size: 14px;
  margin: 0;
`;

export function OmniCoinTokenTransfer() {
    const { isConnected, tokens } = useOmniCoin();
    const { transferToken, isTransferring, error } = useOmniCoinToken();
    const [selectedToken, setSelectedToken] = useState('');
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');

    if (!isConnected) {
        return (
            <Container>
                <Content>
                    <p>Please connect your wallet to transfer tokens</p>
                </Content>
            </Container>
        );
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedToken || !recipient || !amount) return;

        const success = await transferToken(selectedToken, recipient, amount);
        if (success) {
            setRecipient('');
            setAmount('');
        }
    };

    return (
        <Container>
            <Header>
                <Title>Transfer Tokens</Title>
            </Header>
            <Content>
                <Form onSubmit={handleSubmit}>
                    <InputGroup>
                        <Label>Select Token</Label>
                        <Select
                            value={selectedToken}
                            onChange={(e) => setSelectedToken(e.target.value)}
                            required
                        >
                            <option value="">Select a token</option>
                            {tokens.map((token) => (
                                <option key={token.address} value={token.address}>
                                    {token.symbol}
                                </option>
                            ))}
                        </Select>
                    </InputGroup>

                    <InputGroup>
                        <Label>Recipient Address</Label>
                        <Input
                            type="text"
                            placeholder="0x..."
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            required
                        />
                    </InputGroup>

                    <InputGroup>
                        <Label>Amount</Label>
                        <Input
                            type="number"
                            placeholder="0.0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            min="0"
                            step="0.000001"
                            required
                        />
                    </InputGroup>

                    {error && <ErrorMessage>{error}</ErrorMessage>}

                    <Button type="submit" disabled={isTransferring}>
                        {isTransferring ? 'Transferring...' : 'Transfer'}
                    </Button>
                </Form>
            </Content>
        </Container>
    );
}
