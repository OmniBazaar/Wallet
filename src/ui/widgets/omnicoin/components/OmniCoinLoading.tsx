import { CSSProperties, FC, useEffect } from 'react';
// Theme interface removed - not used in this component

/**
 * Injects CSS styles into the document head if they don't exist
 * @returns void
 */
const injectStyles = (): void => {
  if (typeof document !== 'undefined' && document.getElementById('omnicoin-loading-styles') === null) {
    const style = document.createElement('style');
    style.id = 'omnicoin-loading-styles';
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
};

// Inject styles on module load
injectStyles();

const loadingContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  animation: 'fadeIn 0.3s ease-in-out'
};

const spinnerStyle: CSSProperties = {
  width: '40px',
  height: '40px',
  border: '3px solid #f3f4f6',
  borderTop: '3px solid #3b82f6',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
  marginBottom: '16px'
};

const loadingTextStyle: CSSProperties = {
  color: '#1f2937',
  fontSize: '14px',
  margin: '0',
  textAlign: 'center'
};

const progressBarStyle: CSSProperties = {
  width: '200px',
  height: '4px',
  background: '#f3f4f6',
  borderRadius: '2px',
  marginTop: '16px',
  overflow: 'hidden'
};

const getProgressStyle = (progress: number): CSSProperties => ({
  width: `${progress}%`,
  height: '100%',
  background: '#3b82f6',
  borderRadius: '2px',
  transition: 'width 0.3s ease-in-out'
});

interface OmniCoinLoadingProps {
    /** Loading text to display */
    text?: string;
    /** Progress value (0-100) for progress bar */
    progress?: number;
    /** Whether to show progress bar */
    showProgress?: boolean;
}

/**
 * Loading component with spinner and optional progress bar
 * @param props - Component props
 * @param props.text - Loading text to display
 * @param props.progress - Progress value (0-100) for progress bar
 * @param props.showProgress - Whether to show progress bar
 * @returns React component for loading state
 */
export const OmniCoinLoading: FC<OmniCoinLoadingProps> = ({
    text = 'Loading...',
    progress = 0,
    showProgress = false
}) => {
    // Ensure styles are injected when component renders
    useEffect(() => {
        injectStyles();
    }, []);

    return (
        <div style={loadingContainerStyle} data-testid="loading-container">
            <div style={spinnerStyle} data-testid="loading-spinner" />
            <p style={loadingTextStyle} data-testid="loading-text">{text}</p>
            {showProgress && (
                <div style={progressBarStyle} data-testid="progress-bar">
                    <div style={getProgressStyle(progress)} data-testid="progress-fill" />
                </div>
            )}
        </div>
    );
}; 
