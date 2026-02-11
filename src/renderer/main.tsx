import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { SettingsProvider } from './context/SettingsContext'
import { ConfirmProvider } from './components/common/ConfirmDialog'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <SettingsProvider>
            <App />
          </SettingsProvider>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  </React.StrictMode>
)
