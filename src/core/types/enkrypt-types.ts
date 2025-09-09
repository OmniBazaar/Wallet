/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Network names enum for blockchain networks
 * @enum {string}
 */
export enum NetworkNames {
  // Ethereum family
  Ethereum = "Ethereum",
  Sepolia = "Sepolia",
  Arbitrum = "Arbitrum",
  Optimism = "Optimism",
  Base = "Base",
  Matic = "Matic",
  MaticZK = "MaticZK",
  Avalanche = "Avalanche",
  Binance = "Binance",
  Rootstock = "Rootstock",
  EthereumClassic = "EthereumClassic",
  Moonbeam = "Moonbeam",
  Moonriver = "Moonriver",
  Fantom = "Fantom",
  Cronos = "Cronos",
  Metis = "Metis",
  Aurora = "Aurora",
  Zora = "Zora",
  Blast = "Blast",
  
  // Bitcoin family
  Bitcoin = "Bitcoin",
  Litecoin = "Litecoin",
  Dogecoin = "Dogecoin",
  
  // Other chains
  Solana = "Solana",
  Polkadot = "Polkadot",
  Kusama = "Kusama",
  Acala = "Acala",
  Karura = "Karura",
}

/**
 * Hardware wallet capabilities enum
 * @enum {string}
 */
export enum HWwalletCapabilities {
  signMessage = "signMessage",
  signTx = "signTx",
  eip1559 = "eip1559",
  typedMessage = "typedMessage",
}
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Re-export common utility functions used across the codebase
 */
export { default as bufferToHex } from "../utils/bufferToHex";
export { default as hexToBuffer } from "../utils/hexToBuffer";
export { default as bigIntToHex } from "../utils/bigIntToHex";