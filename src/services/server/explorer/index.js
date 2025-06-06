const express = require('express');
const { ethers } = require('ethers');
const { OmniCoinPaymentRouter } = require('../../lib/payments/omnicoin-router');
const config = require('../../lib/payments/config');

const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Initialize provider and router
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const router = new OmniCoinPaymentRouter(provider);

// Home page
app.get('/', (req, res) => {
  res.render('index', { title: 'OmniBazaar Explorer' });
});

// Transaction details page
app.get('/tx/:chainId/:txHash', async (req, res) => {
  try {
    const { chainId, txHash } = req.params;
    const { sender, receiver, deadline } = req.query;

    // Get transaction details
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);

    // Get additional OmniCoin-specific details
    const paymentDetails = await router.getPaymentDetails(txHash);

    res.render('transaction', {
      title: 'Transaction Details',
      transaction: tx,
      receipt,
      paymentDetails,
      sender,
      receiver,
      deadline
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).render('error', { 
      title: 'Error',
      message: 'Failed to fetch transaction details'
    });
  }
});

// Search endpoint
app.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Missing search query' });
    }

    // Check if query is a transaction hash
    if (ethers.utils.isHexString(q, 32)) {
      const tx = await provider.getTransaction(q);
      if (tx) {
        return res.redirect(`/tx/${tx.chainId}/${q}`);
      }
    }

    // Check if query is an address
    if (ethers.utils.isAddress(q)) {
      const balance = await provider.getBalance(q);
      const txCount = await provider.getTransactionCount(q);
      
      return res.render('address', {
        title: 'Address Details',
        address: q,
        balance: ethers.utils.formatEther(balance),
        txCount
      });
    }

    res.status(404).render('error', {
      title: 'Not Found',
      message: 'No results found for your search'
    });
  } catch (error) {
    console.error('Error processing search:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to process search'
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Explorer server running on port ${PORT}`);
}); 