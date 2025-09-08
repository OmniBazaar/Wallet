const { ethers } = require('ethers');

const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic);
const rootNode = ethers.HDNodeWallet.fromMnemonic(mnemonicObj, "m");

console.log('Root node:', rootNode.privateKey);

const child0 = rootNode.derivePath("44'/60'/0'/0/0");
console.log('Path 0:', child0.derivationPath);
console.log('Address 0:', child0.address);
console.log('Private Key 0:', child0.privateKey);

const child1 = rootNode.derivePath("44'/60'/0'/0/1");
console.log('\nPath 1:', child1.derivationPath);
console.log('Address 1:', child1.address);  
console.log('Private Key 1:', child1.privateKey);