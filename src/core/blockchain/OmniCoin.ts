import { ethers } from 'ethers';
import type { Provider, Signer } from 'ethers';

export const OmniCoinMetadata = {
  symbol: 'OMNI',
  decimals: 18,
  contractAddress: '0x0000000000000000000000000000000000000000', // Replace with actual contract address
  name: 'OmniCoin',
};

export const getOmniCoinContract = (provider: Provider) => {
  const abi = [
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
  ];
  return new ethers.Contract(OmniCoinMetadata.contractAddress, abi, provider);
};

export const getOmniCoinBalance = async (address: string, provider: Provider) => {
  const contract = getOmniCoinContract(provider);
  const balance = await contract.balanceOf(address);
  return ethers.utils.formatUnits(balance, OmniCoinMetadata.decimals);
};

export const transferOmniCoin = async (
  to: string,
  amount: string,
  signer: Signer
) => {
  const contract = getOmniCoinContract(signer.provider!);
  const tx = await contract.transfer(to, ethers.utils.parseUnits(amount, OmniCoinMetadata.decimals));
  return tx.wait();
}; 