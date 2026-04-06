import React from 'react';
import { Stack } from 'expo-router';

export default function AppLayout() {
    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: '#111827', // bg-gray-900
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
            }}
        >
            <Stack.Screen
                name="index"
                options={{
                    headerShown: false,
                    title: 'Mis Eventos',
                }}
            />
            <Stack.Screen
                name="event/[id]"
                options={{
                    headerTitle: 'Detalle',
                    headerBackTitleVisible: false,
                }}
            />
            <Stack.Screen
                name="event/[id]/history"
                options={{
                    title: 'Historial',
                    presentation: 'modal',
                    headerBackTitleVisible: false,
                }}
            />
        </Stack>
    );
}
