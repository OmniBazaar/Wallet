import React, { createContext, useContext, ReactNode } from 'react';
import { useWallet } from '../hooks/useWallet';
import { WalletContextType } from '../types';

const WalletContext = createContext<WalletContextType | null>(null);

export const useWalletContext = () => {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error('useWalletContext must be used within a WalletProvider');
    }
    return context;
};

interface WalletProviderProps {
    children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
    const wallet = useWallet();

    return (
        <WalletContext.Provider value={wallet}>
            {children}
        </WalletContext.Provider>
    );
}; 