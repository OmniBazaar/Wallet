import React from 'react';
import styled from 'styled-components';

const ErrorContainer = styled.div`
  padding: 24px;
  background: #fff3f3;
  border: 1px solid #ffcdd2;
  border-radius: 8px;
  margin: 16px;
`;

const ErrorTitle = styled.h3`
  color: #d32f2f;
  margin: 0 0 12px 0;
`;

const ErrorMessage = styled.p`
  color: #b71c1c;
  margin: 0 0 16px 0;
  font-size: 14px;
`;

const RetryButton = styled.button`
  background: #d32f2f;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  
  &:hover {
    background: #b71c1c;
  }
`;

class OmniCoinErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({
            error,
            errorInfo
        });
        // Log error to error reporting service
        console.error('OmniCoin Wallet Error:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <ErrorContainer>
                    <ErrorTitle>Something went wrong</ErrorTitle>
                    <ErrorMessage>
                        {this.state.error?.message || 'An unexpected error occurred'}
                    </ErrorMessage>
                    <RetryButton onClick={this.handleRetry}>
                        Try Again
                    </RetryButton>
                </ErrorContainer>
            );
        }

        return this.props.children;
    }
}

export default OmniCoinErrorBoundary; 