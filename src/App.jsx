/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

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
      <footer className="app-footer">
        <p>
          Created by{' '}
          <a
            className="credit-link"
            href="https://github.com/ourbee"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ritwik Balo
          </a>
        </p>
        <p className="app-footer-copyright">© 2026 Ritwik Balo. All rights reserved.</p>
      </footer>
    </BrowserRouter>
  )
}

export default App
