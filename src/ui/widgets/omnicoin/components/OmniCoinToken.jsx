import React from 'react';
import styled from 'styled-components';
import { useOmniCoin } from '../providers/OmniCoinProvider';
import {
    OmniCoinContainer,
    OmniCoinHeader,
    OmniCoinTitle,
    OmniCoinContent
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

const TokenInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: ${props => props.theme.cardBackground};
  border-radius: 8px;
  border: 1px solid ${props => props.theme.border};
`;

const TokenRow = styled.div`
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

export function OmniCoinToken() {
    const { isConnected, balance } = useOmniCoin();

    if (!isConnected) {
        return (
            <Container>
                <Content>
                    <p>Please connect your wallet to view token information</p>
                </Content>
            </Container>
        );
    }

    return (
        <Container>
            <Header>
                <Title>OmniCoin Token</Title>
            </Header>
            <Content>
                <TokenInfo>
                    <TokenRow>
                        <Label>Token Symbol</Label>
                        <Value>OMN</Value>
                    </TokenRow>
                    <TokenRow>
                        <Label>Your Balance</Label>
                        <Value>{balance} OMN</Value>
                    </TokenRow>
                    <TokenRow>
                        <Label>Token Address</Label>
                        <Value>0x...</Value>
                    </TokenRow>
                    <TokenRow>
                        <Label>Decimals</Label>
                        <Value>18</Value>
                    </TokenRow>
                </TokenInfo>
            </Content>
        </Container>
    );
} 