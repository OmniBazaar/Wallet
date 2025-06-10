import React from 'react';
import styled from 'styled-components';

const BalanceContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  background: ${props => props.theme.colors.backgroundAlt};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const BalanceLabel = styled.span`
  color: ${props => props.theme.colors.text.secondary};
  font-size: 14px;
  margin-bottom: 8px;
`;

const BalanceAmount = styled.span`
  color: ${props => props.theme.colors.text.primary};
  font-size: 24px;
  font-weight: bold;
`;

const OmniCoinBalance = ({ balance = '0.00' }) => {
    return (
        <BalanceContainer>
            <BalanceLabel>OmniCoin Balance</BalanceLabel>
            <BalanceAmount>{balance} OC</BalanceAmount>
        </BalanceContainer>
    );
};

export default OmniCoinBalance; 