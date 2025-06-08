const sockets = {}
const socketsPingIntervals = {}
const keepAliveIntervals = {}
const retryCounts = {}
const endpointIndices = {}

const openManagedSocket = ({ endpoints, endpoint, onMessage, onError, onClose }) => {
  const endpointsList = Array.isArray(endpoints) ? endpoints : [(endpoint || 'wss://integrate.omnicoin.com/cable')]
  let currentEndpointIndex = 0
  let socket = null
  let reconnectTimeout = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 5
  const baseReconnectDelay = 1000

  const connect = () => {
    if (socket) {
      socket.close()
    }

    const currentEndpoint = endpointsList[currentEndpointIndex]
    socket = new WebSocket(currentEndpoint)

    socket.onopen = () => {
      reconnectAttempts = 0
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
        reconnectTimeout = null
      }
    }

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        onMessage(message)
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
      if (onError) {
        onError(error)
      }
    }

    socket.onclose = () => {
      if (reconnectAttempts < maxReconnectAttempts) {
        const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts)
        reconnectTimeout = setTimeout(() => {
          reconnectAttempts++
          currentEndpointIndex = (currentEndpointIndex + 1) % endpointsList.length
          connect()
        }, delay)
      } else if (onClose) {
        onClose()
      }
    }
  }

  connect()

  return {
    send: (message) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message))
      }
    },
    close: () => {
      if (socket) {
        socket.close()
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
    }
  }
}

export default openManagedSocket
