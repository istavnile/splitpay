import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    // --- GUEST MODE OFFLINE STATE ---
    const [isGuest, setIsGuest] = useState(false);
    const [guestEvents, setGuestEvents] = useState([]);
    const [guestParticipants, setGuestParticipants] = useState([]);
    const [guestExpenses, setGuestExpenses] = useState([]);

    useEffect(() => {
        // Escuchar el estado de la sesión actual al cargar
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Escuchar cambios de estado en Auth
        const { data: authListener } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setSession(session);
                setUser(session?.user ?? null);

                if (event === 'PASSWORD_RECOVERY') {
                    // El usuario hizo clic en el enlace del correo electrónico "Olvidé mi contraseña"
                    router.replace('/reset-password');
                }

                setLoading(false);
            }
        );
        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const enterGuestMode = () => {
        setIsGuest(true);
        setLoading(false);
        // Reset old session data if re-entering
        setGuestEvents([]);
        setGuestParticipants([]);
        setGuestExpenses([]);
    };

    const logout = async () => {
        if (isGuest) {
            setIsGuest(false);
            setGuestEvents([]);
            setGuestParticipants([]);
            setGuestExpenses([]);
        } else {
            await supabase.auth.signOut();
        }
    };

    // Helper Context Values for offline operations
    const guestState = {
        events: guestEvents,
        participants: guestParticipants,
        expenses: guestExpenses,
        setGuestEvents,
        setGuestParticipants,
        setGuestExpenses
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, isGuest, enterGuestMode, logout, guestState }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
