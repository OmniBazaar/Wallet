const { ethers } = require('ethers');

async function testConnection() {
  try {
    console.log('Connecting to Hardhat node...');
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');

    console.log('Getting network...');
    const network = await provider.getNetwork();
    console.log('Network:', {
      chainId: network.chainId.toString(),
      name: network.name
    });

    console.log('Getting block number...');
    const blockNumber = await provider.getBlockNumber();
    console.log('Block number:', blockNumber);

    console.log('Getting signer...');
    const signer = await provider.getSigner(0);
    console.log('Signer created');

    console.log('Getting signer address...');
    const address = await signer.getAddress();
    console.log('Signer address:', address);

    console.log('Getting balance...');
    const balance = await provider.getBalance(address);
    console.log('Balance:', ethers.formatEther(balance), 'ETH');

    console.log('SUCCESS: All checks passed!');
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('Full error:', error);
  }
}

testConnection();