import React from 'react'

export default function requireReactVersion() {
  if (parseInt(React.version.split('.')[0]) < 17) {
    throw ('omnicoin/widgets require at least React v17')
  }
}
