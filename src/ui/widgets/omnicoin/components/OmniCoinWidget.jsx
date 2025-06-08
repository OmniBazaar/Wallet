import React from 'react';
import styled from 'styled-components';
import { useOmniCoin } from '../providers/OmniCoinProvider';
import {
    OmniCoinContainer,
    OmniCoinHeader,
    OmniCoinTitle,
    OmniCoinContent,
    OmniCoinButton
} from '../styles/OmniCoinStyle';

const Container = styled.div`
  ${OmniCoinContainer}
`;

const Header = styled.div`
  ${OmniCoinHeader}
`;

const Title = styled.h1`
  ${OmniCoinTitle}
`;

const Content = styled.div`
  ${OmniCoinContent}
`;

const Button = styled.button`
  ${OmniCoinButton}
`;

export function OmniCoinWidget() {
    const { isInitialized, isConnected, balance, error } = useOmniCoin();

    if (error) {
        return (
            <Container>
                <Content>
                    <p>Error: {error}</p>
                </Content>
            </Container>
        );
    }

    if (!isInitialized) {
        return (
            <Container>
                <Content>
                    <p>Initializing OmniCoin...</p>
                </Content>
            </Container>
        );
    }

    return (
        <Container>
            <Header>
                <Title>OmniCoin</Title>
            </Header>
            <Content>
                <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
                <p>Balance: {balance} OMN</p>
                <Button onClick={() => { }}>
                    Connect Wallet
                </Button>
            </Content>
        </Container>
    );
} 