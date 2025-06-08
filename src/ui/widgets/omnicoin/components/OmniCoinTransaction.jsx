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
                        <p>Transaction {transaction.status === 'completed' ? 'completed' : 'pending'}...</p>
                    )}
                    <Button type="submit" disabled={isLoading}>
                        {isLoading ? 'Sending...' : 'Send Transaction'}
                    </Button>
                </Form>
            </Content>
        </Container>
    );
} 