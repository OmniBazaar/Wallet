/* @jsxImportSource react */
import React from 'react';
import { Theme } from '../../../../types/theme';

// Since styled-components may not be available, use inline styles
interface ThemeProps {
  theme: Theme;
}

// CSS animations injected into document head
if (typeof document !== 'undefined' && !document.getElementById('omnicoin-loading-styles-new')) {
  const style = document.createElement('style');
  style.id = 'omnicoin-loading-styles-new';
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

const loadingContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  animation: 'fadeIn 0.3s ease-in-out'
};

const spinnerStyle: React.CSSProperties = {
  width: '40px',
  height: '40px',
  border: '3px solid #f3f4f6',
  borderTop: '3px solid #3b82f6',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
  marginBottom: '16px'
};

const loadingTextStyle: React.CSSProperties = {
  color: '#1f2937',
  fontSize: '14px',
  margin: '0',
  textAlign: 'center'
};

const progressBarStyle: React.CSSProperties = {
  width: '200px',
  height: '4px',
  background: '#f3f4f6',
  borderRadius: '2px',
  marginTop: '16px',
  overflow: 'hidden'
};

const getProgressStyle = (progress: number): React.CSSProperties => ({
  width: `${progress}%`,
  height: '100%',
  background: '#3b82f6',
  borderRadius: '2px',
  transition: 'width 0.3s ease-in-out'
});

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
        <div style={loadingContainerStyle}>
            <div style={spinnerStyle} />
            <p style={loadingTextStyle}>{text}</p>
            {showProgress && (
                <div style={progressBarStyle}>
                    <div style={getProgressStyle(progress)} />
                </div>
            )}
        </div>
    );
}; 