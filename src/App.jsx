import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import TripPage from './pages/TripPage'
import JoinPage from './pages/JoinPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/trip/:tripId" element={<TripPage />} />
        <Route path="/trip/:tripId/join" element={<JoinPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
