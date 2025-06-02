const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const { OmniCoinPaymentRouter } = require('../../lib/payments/omnicoin-router');
const config = require('../../lib/payments/config');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize provider and router
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const router = new OmniCoinPaymentRouter(provider);

// Get best route
app.get('/routes/best', async (req, res) => {
  try {
    const { fromToken, toToken, fromAmount, fromAddress, toAddress } = req.query;
    
    if (!fromToken || !toToken || !fromAmount || !fromAddress || !toAddress) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const route = await router.findBestRoute({
      fromToken,
      toToken,
      fromAmount: ethers.BigNumber.from(fromAmount),
      fromAddress,
      toAddress
    });

    res.json(route);
  } catch (error) {
    console.error('Error finding best route:', error);
    res.status(500).json({ error: 'Failed to find best route' });
  }
});

// Get all routes
app.get('/routes/all', async (req, res) => {
  try {
    const { fromToken, toToken, fromAmount, fromAddress, toAddress } = req.query;
    
    if (!fromToken || !toToken || !fromAmount || !fromAddress || !toAddress) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const routes = await router.findAllRoutes({
      fromToken,
      toToken,
      fromAmount: ethers.BigNumber.from(fromAmount),
      fromAddress,
      toAddress
    });

    res.json(routes);
  } catch (error) {
    console.error('Error finding all routes:', error);
    res.status(500).json({ error: 'Failed to find all routes' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
}); 