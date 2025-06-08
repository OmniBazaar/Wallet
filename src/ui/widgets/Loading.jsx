import React from 'react'
import styled from 'styled-components'
import { ReactDialog } from '@omnicoin/react-dialog'
import { ReactDialogStack } from '@omnicoin/react-dialog-stack'
import { NavigateStackContext } from '@omnicoin/react-dialog-stack'
import { useContext } from 'react'

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
`

const LoadingMessage = styled.p`
  margin: 16px 0 0 0;
  font-size: 16px;
  color: ${props => props.theme.text};
`

export default function Loading({ container, message }) {
  const { navigate } = useContext(NavigateStackContext)

  const unmount = () => {
    navigate('back')
  }

  if (typeof window !== 'undefined') {
    window._omnicoinUnmountLoading = unmount
  }

  return (
    <ReactDialog>
      <ReactDialogStack>
        <LoadingContainer>
          <div className="LoadingSpinner" />
          {message && <LoadingMessage>{message}</LoadingMessage>}
        </LoadingContainer>
      </ReactDialogStack>
    </ReactDialog>
  )
}
