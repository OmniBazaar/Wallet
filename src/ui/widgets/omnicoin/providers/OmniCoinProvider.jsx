import React, { createContext, useContext, useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { usePayment } from '../contexts/PaymentContext';

const OmniCoinContext = createContext();

export function OmniCoinProvider({ children }) {
    const { wallet } = useWallet();
    const { payment } = usePayment();
    const [omnicoinState, setOmnicoinState] = useState({
        isInitialized: false,
        isConnected: false,
        balance: '0',
        transactions: [],
        error: null
    });

    useEffect(() => {
        if (wallet?.address) {
            initializeOmniCoin();
        }
    }, [wallet?.address]);

    const initializeOmniCoin = async () => {
        try {
            // Initialize OmniCoin connection
            setOmnicoinState(prev => ({
                ...prev,
                isInitialized: true,
                isConnected: true
            }));
        } catch (error) {
            setOmnicoinState(prev => ({
                ...prev,
                error: error.message
            }));
        }
    };

    const value = {
        ...omnicoinState,
        initializeOmniCoin
    };

    return (
        <OmniCoinContext.Provider value={value}>
            {children}
        </OmniCoinContext.Provider>
    );
}

export function useOmniCoin() {
    const context = useContext(OmniCoinContext);
    if (!context) {
        throw new Error('useOmniCoin must be used within an OmniCoinProvider');
    }
    return context;
} 