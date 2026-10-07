import '@fontsource-variable/inter';
import './styles/index.css';
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { createQueryClient } from './api/queries';
import { App } from './App';
import { PreloadedModelContext, readPageData } from './features/models/preloaded';

const container = document.getElementById('root');
if (!container) throw new Error('Root element missing');

const app = (
  <StrictMode>
    <PreloadedModelContext.Provider value={readPageData()}>
      <BrowserRouter>
        <App queryClient={createQueryClient()} />
      </BrowserRouter>
    </PreloadedModelContext.Provider>
  </StrictMode>
);

// Prerendered pages are hydrated; everything else renders into the empty shell.
if (container.dataset.prerendered === 'true') hydrateRoot(container, app);
else createRoot(container).render(app);
