import React from 'react';
import styled, { keyframes } from 'styled-components';

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: ${fadeIn} 0.3s ease-in-out;
`;

const Spinner = styled.div`
  width: 40px;
  height: 40px;
  border: 3px solid ${props => props.theme.colors.backgroundAlt};
  border-top: 3px solid ${props => props.theme.colors.primary};
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
  margin-bottom: 16px;
`;

const LoadingText = styled.p`
  color: ${props => props.theme.colors.text.primary};
  font-size: 14px;
  margin: 0;
  text-align: center;
`;

const ProgressBar = styled.div`
  width: 200px;
  height: 4px;
  background: ${props => props.theme.colors.backgroundAlt};
  border-radius: 2px;
  margin-top: 16px;
  overflow: hidden;
`;

const Progress = styled.div<{ progress: number }>`
  width: ${props => props.progress}%;
  height: 100%;
  background: ${props => props.theme.colors.primary};
  border-radius: 2px;
  transition: width 0.3s ease-in-out;
`;

interface OmniCoinLoadingProps {
    text?: string;
    progress?: number;
    showProgress?: boolean;
}

export const OmniCoinLoading: React.FC<OmniCoinLoadingProps> = ({
    text = 'Loading...',
    progress = 0,
    showProgress = false
}) => {
    return (
        <LoadingContainer>
            <Spinner />
            <LoadingText>{text}</LoadingText>
            {showProgress && (
                <ProgressBar>
                    <Progress progress={progress} />
                </ProgressBar>
            )}
        </LoadingContainer>
    );
}; 