import Connect from './Connect'
import Login from './Login'
import Payment from './Payment'
import Sale from './Sale'
import Select from './Select'
import Loading from './Loading'

let OmniCoinWidgets = {
  Connect,
  Login,
  Payment,
  Sale,
  Select,
  Loading
}

if (typeof window !== 'undefined') {
  window.OmniCoinWidgets = OmniCoinWidgets
}

export default OmniCoinWidgets
