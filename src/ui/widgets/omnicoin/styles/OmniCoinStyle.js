import { css } from 'styled-components';

export const OmniCoinContainer = css`
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

export const OmniCoinHeader = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
`;

export const OmniCoinTitle = css`
  font-size: 24px;
  font-weight: 600;
  color: ${props => props.theme.text};
`;

export const OmniCoinContent = css`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const OmniCoinButton = css`
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

export const OmniCoinForm = css`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const OmniCoinInput = css`
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

export const OmniCoinCard = css`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: ${props => props.theme.cardBackground};
  border-radius: 8px;
  border: 1px solid ${props => props.theme.border};
`;

export const OmniCoinRow = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const OmniCoinLabel = css`
  color: ${props => props.theme.textSecondary};
  font-size: 14px;
`;

export const OmniCoinValue = css`
  color: ${props => props.theme.text};
  font-size: 16px;
  font-weight: 500;
`;

export const OmniCoinErrorMessage = css`
  color: ${props => props.theme.error};
  font-size: 14px;
  margin: 0;
`; 