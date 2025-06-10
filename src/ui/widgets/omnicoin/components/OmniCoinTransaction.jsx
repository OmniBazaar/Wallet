import React, { useState } from 'react';
import styled from 'styled-components';
import { useOmniCoin } from '../providers/OmniCoinProvider';
import { useOmniCoinTransaction } from '../hooks/useOmniCoinTransaction';
import {
    OmniCoinContainer,
    OmniCoinHeader,
    OmniCoinTitle,
    OmniCoinContent,
    OmniCoinButton,
    OmniCoinForm,
    OmniCoinInput,
    OmniCoinErrorMessage
} from '../styles/OmniCoinStyle';

const Container = styled.div`
  ${OmniCoinContainer}
`;

const Header = styled.div`
  ${OmniCoinHeader}
`;

const Title = styled.h2`
  ${OmniCoinTitle}
  font-size: 20px;
`;

const Content = styled.div`
  ${OmniCoinContent}
`;

const Form = styled.form`
  ${OmniCoinForm}
`;

const Input = styled.input`
  ${OmniCoinInput}
`;

const Button = styled.button`
  ${OmniCoinButton}
`;

const ErrorMessage = styled.p`
  ${OmniCoinErrorMessage}
`;

const TransactionContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: ${props => props.theme.colors.backgroundAlt};
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const TransactionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const TransactionType = styled.span`
  color: ${props => props.theme.colors.text.primary};
  font-weight: bold;
  font-size: 16px;
`;

const TransactionAmount = styled.span`
  color: ${props => props.theme.colors.primary};
  font-weight: bold;
  font-size: 16px;
`;

const TransactionDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const TransactionDetail = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const DetailLabel = styled.span`
  color: ${props => props.theme.colors.text.secondary};
  font-size: 14px;
`;

const DetailValue = styled.span`
  color: ${props => props.theme.colors.text.primary};
  font-size: 14px;
`;

export function OmniCoinTransaction() {
    const { isConnected } = useOmniCoin();
    const { sendTransaction, isLoading, error, transaction } = useOmniCoinTransaction();
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            await sendTransaction(recipient, amount);
            // Clear form on success
            setRecipient('');
            setAmount('');
        } catch (err) {
            // Error is handled by the hook
        }
    };

    if (!isConnected) {
        return (
            <Container>
                <Content>
                    <p>Please connect your wallet to send transactions</p>
                </Content>
            </Container>
        );
    }

    return (
        <Container>
            <Header>
                <Title>Send OmniCoin</Title>
            </Header>
            <Content>
                <Form onSubmit={handleSubmit}>
                    <Input
                        type="text"
                        placeholder="Recipient Address"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        disabled={isLoading}
                    />
                    <Input
                        type="number"
                        placeholder="Amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        min="0"
                        step="0.000001"
                        disabled={isLoading}
                    />
                    {error && <ErrorMessage>{error}</ErrorMessage>}
                    {transaction && (
                        <TransactionContainer>
                            <TransactionHeader>
                                <TransactionType>{transaction.type}</TransactionType>
                                <TransactionAmount>{transaction.amount} OC</TransactionAmount>
                            </TransactionHeader>
                            <TransactionDetails>
                                <TransactionDetail>
                                    <DetailLabel>Date</DetailLabel>
                                    <DetailValue>{new Date(transaction.timestamp).toLocaleString()}</DetailValue>
                                </TransactionDetail>
                                <TransactionDetail>
                                    <DetailLabel>Transaction Hash</DetailLabel>
                                    <DetailValue>{transaction.hash}</DetailValue>
                                </TransactionDetail>
                                <TransactionDetail>
                                    <DetailLabel>Status</DetailLabel>
                                    <DetailValue>{transaction.status}</DetailValue>
                                </TransactionDetail>
                            </TransactionDetails>
                        </TransactionContainer>
                    )}
                    <Button type="submit" disabled={isLoading}>
                        {isLoading ? 'Sending...' : 'Send Transaction'}
                    </Button>
                </Form>
            </Content>
        </Container>
    );
} 