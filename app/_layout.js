import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../src/providers/AuthProvider';
import { View, ActivityIndicator } from 'react-native';
import '../global.css'; // NativeWind

// Componente Wrapper para proteger rutas
const InitialLayout = () => {
    const { user, isGuest, loading } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        console.log("🚀 App Started - Initializing Layout");
        if (loading) {
            console.log("⏳ Still Loading Auth...");
            return;
        }

        console.log("✅ Auth Loaded - User:", user?.email || (isGuest ? "Guest" : "Anonymous"));

        const inAppGroup = segments[0] === '(app)';
        const isAuthenticated = user || isGuest;

        if (!isAuthenticated && inAppGroup) {
            router.replace('/login');
        } else if (isAuthenticated && !inAppGroup) {
            router.replace('/(app)');
        }
    }, [user, isGuest, loading, segments]);

    if (loading) {
        return (
            <View className="flex-1 bg-gray-900 items-center justify-center">
                <ActivityIndicator size="large" color="#34d399" />
            </View>
        );
    }

    const inAppGroup = segments[0] === '(app)';

    if (inAppGroup) {
        return (
            <View className="flex-1 bg-gray-900">
                {/* 
                We remove md:max-w-md and md:border-x to allow the app to expand horizontally 
                natively using Tailwind's max-w-7xl, making it feel like a true desktop app.
                */}
                <View className="flex-1 w-full max-w-7xl mx-auto bg-gray-900 md:my-0 shadow-2xl relative transition-all duration-500 ease-in-out">
                    <Slot />
                </View>
            </View>
        );
    }

    // Para login u otras pantallas fuera de app, expandir al 100%
    return <Slot />;
};

export default function RootLayout() {
    return (
        <AuthProvider>
            <InitialLayout />
        </AuthProvider>
    );
}
