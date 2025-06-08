import React from 'react'
import styled from 'styled-components'
import { useWallet } from '../contexts/WalletContext'
import link from '../helpers/link'

const PoweredByContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  font-size: 12px;
  color: ${props => props.theme.textSecondary};
`

const PoweredByLink = styled.a`
  color: ${props => props.theme.primary};
  text-decoration: none;
  margin-left: 4px;

  &:hover {
    text-decoration: underline;
  }
`

export default function PoweredBy() {
  const { wallet } = useWallet()

  return (
    <PoweredByContainer>
      powered by
      <PoweredByLink
        href={link({ url: 'https://omnicoin.com', target: '_blank', wallet })}
        rel="noopener noreferrer"
        target="_blank"
        className="PoweredByLink"
        title="powered by OmniCoin"
      >
        OmniCoin
      </PoweredByLink>
    </PoweredByContainer>
  )
}
