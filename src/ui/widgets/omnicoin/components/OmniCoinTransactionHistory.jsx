import React from 'react';
import styled from 'styled-components';
import { useOmniCoin } from '../providers/OmniCoinProvider';

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

const TransactionCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: ${props => props.theme.cardBackground};
  border-radius: 8px;
  border: 1px solid ${props => props.theme.border};
  margin-bottom: 16px;
`;

const TransactionRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Label = styled.span`
  color: ${props => props.theme.textSecondary};
  font-size: 14px;
`;

const Value = styled.span`
  color: ${props => props.theme.text};
  font-size: 16px;
  font-weight: 500;
`;

const StatusBadge = styled.span`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background: ${props => {
        switch (props.status) {
            case 'completed':
                return props.theme.success;
            case 'pending':
                return props.theme.warning;
            case 'failed':
                return props.theme.error;
            default:
                return props.theme.textSecondary;
        }
    }};
  color: ${props => props.theme.buttonText};
`;

export function OmniCoinTransactionHistory() {
    const { isConnected, transactions } = useOmniCoin();

    if (!isConnected) {
        return (
            <Container>
                <Content>
                    <p>Please connect your wallet to view transaction history</p>
                </Content>
            </Container>
        );
    }

    return (
        <Container>
            <Header>
                <Title>Transaction History</Title>
            </Header>
            <Content>
                {transactions.length === 0 ? (
                    <p>No transactions found</p>
                ) : (
                    transactions.map((tx, index) => (
                        <TransactionCard key={index}>
                            <TransactionRow>
                                <Label>Transaction ID</Label>
                                <Value>{tx.id}</Value>
                            </TransactionRow>
                            <TransactionRow>
                                <Label>From</Label>
                                <Value>{tx.from}</Value>
                            </TransactionRow>
                            <TransactionRow>
                                <Label>To</Label>
                                <Value>{tx.to}</Value>
                            </TransactionRow>
                            <TransactionRow>
                                <Label>Amount</Label>
                                <Value>{tx.amount} OMN</Value>
                            </TransactionRow>
                            <TransactionRow>
                                <Label>Status</Label>
                                <StatusBadge status={tx.status}>
                                    {tx.status}
                                </StatusBadge>
                            </TransactionRow>
                            <TransactionRow>
                                <Label>Date</Label>
                                <Value>{new Date(tx.timestamp).toLocaleString()}</Value>
                            </TransactionRow>
                        </TransactionCard>
                    ))
                )}
            </Content>
        </Container>
    );
} 