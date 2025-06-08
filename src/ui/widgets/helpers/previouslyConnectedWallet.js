const KEY = '_OmniCoinConnectDialogPreviouslyConnectedWallet'

export default {
    get: () => {
        if (typeof window === 'undefined') return undefined
        return window.localStorage.getItem(KEY)
    },
    set: (wallet) => {
        if (typeof window === 'undefined') return
        window.localStorage.setItem(KEY, wallet)
    }
}
