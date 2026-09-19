import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import MammoAuthGate from './MammoAuthGate';
import './styles.css';

const base = import.meta.env.BASE_URL || '/';
const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MammoAuthGate
      verifyUrl={`${cleanBase}/auth/verify`}
      productName="Mammo AI"
      title="Private demo access"
      subtitle="The OncoTraceAI mammography demo is invite-only while in preview. Enter the credentials from your invitation to continue."
    >
      <App />
    </MammoAuthGate>
  </React.StrictMode>
);
