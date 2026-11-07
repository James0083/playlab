import '@minigames/engine/styles.css';
import './game.css';
import { configureSupabase } from '@minigames/engine';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TemplateGame } from './TemplateGame.tsx';

configureSupabase({
  url: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TemplateGame />
  </StrictMode>,
);
