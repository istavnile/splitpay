import React, { useEffect } from 'react';
import { View, Text, Platform } from 'react-native';

export default function AdContainer({ className = '' }) {
    useEffect(() => {
        if (Platform.OS === 'web') {
            try {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } catch (e) {
                console.log('Adsense error', e);
            }
        }
    }, []);

    if (Platform.OS === 'web') {
        return (
            <View className={`w-full overflow-hidden items-center justify-center my-4 ${className}`}><div style={{ width: '100%', minHeight: '90px', display: 'flex', justifyContent: 'center' }}><ins className="adsbygoogle" style={{ display: 'block', width: '100%', height: '90px' }} data-ad-client="ca-pub-XXXXXXXXXXXXX" data-ad-slot="XXXXXXXXXX" data-ad-format="auto" data-full-width-responsive="true"></ins></div>{/* Temporary Placeholder for Dev Visuals */}<View className="absolute inset-0 bg-gray-800 border border-dashed border-gray-600 rounded-lg items-center justify-center pointer-events-none"><Text className="text-gray-500 font-bold text-xs">Espacio Reservado para Anuncios</Text></View></View>
        );
    }

    // React Native Mobile Fallback (to be replaced with actual react-native-google-mobile-ads later)
    return (
        <View className={`w-full h-24 bg-gray-800 border border-dashed border-gray-600 rounded-lg items-center justify-center my-4 ${className}`}>
            <Text className="text-gray-500 font-bold text-xs uppercase tracking-widest">Espacio para Anuncios</Text>
        </View>
    );
}
