import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@excalidraw/excalidraw/index.css'
import App from './App.tsx'

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

document.documentElement.style.height = '100%';
document.body.style.height = '100%';
document.body.style.margin = '0';
rootElement.style.height = '100%';

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
