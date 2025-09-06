/* @jsxImportSource react */
import React, { useEffect } from 'react';
import styled from 'styled-components';

const ToastContainer = styled.div<{ type: 'success' | 'error' | 'info' | 'pending' }>`
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  padding: 1rem;
  border-radius: 8px;
  background: ${props => {
        switch (props.type) {
            case 'success':
                return props.theme.colors.success;
            case 'error':
                return props.theme.colors.error;
            case 'pending':
                return props.theme.colors.warning;
            default:
                return props.theme.colors.primary;
        }
    }};
  color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 200px;
  max-width: 400px;
`;

const ToastMessage = styled.p`
  margin: 0;
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.primary};
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 0.25rem;
  margin-left: auto;
  opacity: 0.7;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 1;
  }
`;

interface OmniCoinToastProps {
    message: string;
    type?: 'success' | 'error' | 'info' | 'pending';
    duration?: number;
    onClose?: () => void;
}

export const OmniCoinToast: React.FC<OmniCoinToastProps> = ({
    message,
    type = 'info',
    duration = 3000,
    onClose
}) => {
    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                onClose?.();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    return (
        <ToastContainer type={type}>
            <ToastMessage>{message}</ToastMessage>
            {onClose && (
                <CloseButton onClick={onClose} aria-label="Close toast">
                    ×
                </CloseButton>
            )}
        </ToastContainer>
    );
}; 
