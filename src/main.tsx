import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import App from './App'
import './index.css'
import { useAppStore } from './store/appStore'
import { SupabaseRepository } from './data/supabaseRepository'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (see .env.example).',
  )
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)
useAppStore.getState().init(new SupabaseRepository(supabase))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
