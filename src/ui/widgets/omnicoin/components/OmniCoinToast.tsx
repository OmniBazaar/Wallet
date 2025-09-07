/* @jsxImportSource react */
import React, { useEffect } from 'react';

/**
 * Get toast container style based on toast type
 * @param type - Toast type (success, error, info, or pending)
 * @returns CSS style object
 */
const getToastContainerStyle = (type: 'success' | 'error' | 'info' | 'pending'): React.CSSProperties => {
  let backgroundColor: string;
  
  switch (type) {
    case 'success':
      backgroundColor = '#10b981';
      break;
    case 'error':
      backgroundColor = '#ef4444';
      break;
    case 'pending':
      backgroundColor = '#f59e0b';
      break;
    default:
      backgroundColor = '#3b82f6';
      break;
  }

  return {
    position: 'fixed',
    bottom: '2rem',
    right: '2rem',
    padding: '1rem',
    borderRadius: '8px',
    backgroundColor,
    color: 'white',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    minWidth: '200px',
    maxWidth: '400px'
  };
};

const toastMessageStyle: React.CSSProperties = {
  margin: '0',
  fontSize: '0.875rem',
  color: 'white'
};

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'white',
  cursor: 'pointer',
  padding: '0.25rem',
  marginLeft: 'auto',
  opacity: 0.7,
  transition: 'opacity 0.2s ease'
};

interface OmniCoinToastProps {
    message: string;
    type?: 'success' | 'error' | 'info' | 'pending';
    duration?: number;
    onClose?: () => void;
}

/**
 * Toast notification component for OmniCoin operations
 * @param props - Component props
 * @returns React component for toast notifications
 */
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
        // Return empty cleanup function when duration <= 0
        return () => {};
    }, [duration, onClose]);

    return (
        <div style={getToastContainerStyle(type)}>
            <p style={toastMessageStyle}>{message}</p>
            {onClose && (
                <button 
                    style={closeButtonStyle} 
                    onClick={onClose} 
                    aria-label="Close toast"
                    onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.7';
                    }}
                >
                    ×
                </button>
            )}
        </div>
    );
}; 