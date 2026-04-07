import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// --- DYNAMIC CONFIGURATION (Runtime or Build-time) ---
// We check window.APP_CONFIG first (populated at runtime by Nginx/envsubst)
// or fall back to process.env (populated at build-time by Expo/Build Args)
let supabaseUrl = (window.APP_CONFIG?.SUPABASE_URL && window.APP_CONFIG.SUPABASE_URL.trim() !== "" && window.APP_CONFIG.SUPABASE_URL !== "${EXPO_PUBLIC_SUPABASE_URL}") 
    ? window.APP_CONFIG.SUPABASE_URL 
    : (typeof window !== 'undefined' ? (window.location.origin === "http://localhost:8081" || window.location.origin.includes("192.168") ? process.env.EXPO_PUBLIC_SUPABASE_URL : window.location.origin) : process.env.EXPO_PUBLIC_SUPABASE_URL);

const supabaseAnonKey = (window.APP_CONFIG?.SUPABASE_ANON_KEY && window.APP_CONFIG.SUPABASE_ANON_KEY.trim() !== "" && window.APP_CONFIG.SUPABASE_ANON_KEY !== "${EXPO_PUBLIC_SUPABASE_ANON_KEY}") 
    ? window.APP_CONFIG.SUPABASE_ANON_KEY 
    : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// --- Sanitización del URL ---
// Si el URL no tiene protocolo y no es una ruta relativa, le añadimos https://
if (supabaseUrl && !supabaseUrl.startsWith('http') && !supabaseUrl.startsWith('/')) {
    supabaseUrl = `https://${supabaseUrl}`;
}

// --- DIAGNÓSTICO DE CONFIGURACIÓN ---
console.log("🔍 [Supabase Diagnostic] Raw URL:", window.APP_CONFIG?.SUPABASE_URL || "N/A");
console.log("🔍 [Supabase Diagnostic] Sanitized URL:", supabaseUrl || "MISSING");
console.log("🔍 [Supabase Diagnostic] Key Length:", supabaseAnonKey ? supabaseAnonKey.length : 0);
console.log("🔍 [Supabase Diagnostic] Origin:", typeof window !== 'undefined' ? window.location.origin : "N/A");

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === "MISSING_URL") {
    console.error("❌ CRITICAL: Missing Supabase Configuration!");
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

/**
 * Checks if the Supabase client can reach the backend.
 * Returns { ok: boolean, error?: string }
 */
export const checkSupabaseConnection = async () => {
    try {
        const { data, error } = await supabase.from('_non_existent_table_').select('*').limit(1);
        // If we get an error that is NOT a network error (e.g. 401, 404, or regular Supabase error), 
        // it means we ARE connected but just hit a permissions or table issue.
        // A "Failed to fetch" usually indicates a network/connectivity issue.
        if (error && (error.message.includes("fetch") || error.message.includes("network"))) {
            return { ok: false, error: error.message };
        }
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err.message };
    }
};

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
