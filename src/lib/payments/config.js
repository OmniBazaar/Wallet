export default {
  endpoints: {
    routesBest: 'https://api.omnibazaar.com/routes/best',
    routesAll: 'https://api.omnibazaar.com/routes/all'
  },
  omnicoinAddress: process.env.OMNICOIN_ADDRESS || '0x0000000000000000000000000000000000000000', // Replace with actual OmniCoin address
  omnicoinConfig: {
    privacyEnabled: true,
    stakingEnabled: true,
    reputationEnabled: true,
    accountAbstractionEnabled: true
  }
}

