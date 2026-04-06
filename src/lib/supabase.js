import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// --- DYNAMIC CONFIGURATION (Runtime or Build-time) ---
// We check window.APP_CONFIG first (populated at runtime by Nginx/envsubst)
// or fall back to process.env (populated at build-time by Expo/Build Args)
const supabaseUrl = (window.APP_CONFIG?.SUPABASE_URL && window.APP_CONFIG.SUPABASE_URL.trim() !== "") 
    ? window.APP_CONFIG.SUPABASE_URL 
    : process.env.EXPO_PUBLIC_SUPABASE_URL;

const supabaseAnonKey = (window.APP_CONFIG?.SUPABASE_ANON_KEY && window.APP_CONFIG.SUPABASE_ANON_KEY.trim() !== "") 
    ? window.APP_CONFIG.SUPABASE_ANON_KEY 
    : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === "MISSING_URL") {
    console.error("❌ CRITICAL: Missing Supabase Configuration!");
    if (typeof window !== 'undefined') {
        alert("⚠️ Configuración de Supabase faltante. Revisa tus variables de entorno en el VPS.\nURL: " + supabaseUrl);
    }
}

// Fallback to empty strings if missing to avoid breaking imports
export const supabase = createClient(supabaseUrl || "MISSING_URL", supabaseAnonKey || "MISSING_KEY", {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// Tells Supabase Auth to continuously refresh the session automatically if
// the app is in the foreground. When this is added, you will continue to receive
// `onAuthStateChange` events with the `TOKEN_REFRESHED` or `SIGNED_OUT` event
// if the user's session is terminated. This should only be registered once.
AppState.addEventListener('change', (state) => {
    if (state === 'active') {
        supabase.auth.startAutoRefresh();
    } else {
        supabase.auth.stopAutoRefresh();
    }
});
