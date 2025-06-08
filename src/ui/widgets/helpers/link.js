export default function link({ url, target, wallet }) {
  if (url && url.length && target == '_blank' && wallet?.name === 'World App' && url.match('omnicoin.com')) {
    return `https://integrate.omnicoin.fi/redirect?to=${encodeURIComponent(url)}`
  }
  return url
}
