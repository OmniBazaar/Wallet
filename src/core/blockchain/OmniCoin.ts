import { ethers } from 'ethers';
import type { Provider, Signer } from 'ethers';

export const OmniCoinMetadata = {
  symbol: 'OMNI',
  decimals: 18,
  // TODO: Update this placeholder with the actual deployed OmniCoin contract address.
  contractAddress: '0x0000000000000000000000000000000000000000',
  name: 'OmniCoin',
} as const;

export const getOmniCoinContract = (provider: Provider) => {
  const abi = [
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
  ] as const;
  return new ethers.Contract(OmniCoinMetadata.contractAddress, abi, provider);
};

export const getOmniCoinBalance = async (address: string, provider: Provider): Promise<bigint> => {
  const contract = getOmniCoinContract(provider);
  const balance = await contract.balanceOf(address);
  return balance;
};

export const transferOmniCoin = async (
  to: string,
  amount: string,
  signer: Signer
): Promise<ethers.TransactionReceipt> => {
  const contract = getOmniCoinContract(signer.provider!);
  const parsedAmount = ethers.parseUnits(amount, OmniCoinMetadata.decimals);
  const tx = await contract.transfer(to, parsedAmount);
  return tx.wait();
}; 