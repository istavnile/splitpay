import React from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function FAQScreen() {
    const router = useRouter();

    return (
        <SafeAreaView className="flex-1 bg-gray-950">
            {/* Header */}
            <View className="flex-row items-center p-4 border-b border-gray-800 bg-gray-900 z-10">
                <TouchableOpacity onPress={() => router.back()} className="p-2 mr-2">
                    <Ionicons name="arrow-back" size={24} color="#34d399" />
                </TouchableOpacity>
                <Text className="text-white text-xl font-bold">Preguntas Frecuentes (FAQ)</Text>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
                <View className="max-w-4xl mx-auto w-full">

                    {/* SEO Rich Text for Google Adsense Crawlers */}
                    {Platform.OS === 'web' ? (
                        <div style={{ color: '#d1d5db', lineHeight: '1.6' }}>
                            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>Acerca de SplitPay</h1>
                            <p style={{ marginBottom: '1.5rem' }}>
                                SplitPay es la solución definitiva para gestionar gastos compartidos, dividir cuentas en viajes, o cuadrar finanzas con compañeros de piso.
                                Nuestra plataforma de cálculo y división de gastos está diseñada para ser ultra rápida y equitativa.
                            </p>

                            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginTop: '2rem', marginBottom: '1rem' }}>¿Cómo funciona el cálculo de deudas?</h2>
                            <p style={{ marginBottom: '1.5rem' }}>
                                A diferencia de otras calculadoras, SplitPay utiliza un algoritmo dinámico que asume que <strong>todos</strong> los integrantes del evento
                                participaron equitativamente en todos los gastos. El sistema suma el total de los gastos, lo divide entre el número de participantes
                                para encontrar la <em>cuota ideal</em>, y luego calcula quién pagó más o menos de su cuota, generando la ruta de transferencias más directa.
                            </p>

                            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginTop: '2rem', marginBottom: '1rem' }}>¿Qué es el Modo Invitado (Offline)?</h2>
                            <p style={{ marginBottom: '1.5rem' }}>
                                Entendemos la necesidad de privacidad. El Modo Invitado permite usar toda la potencia de la calculadora de SplitPay
                                bajo una arquitectura <em>offline</em>. Tus datos, participantes, y gastos vivirán exclusivamente en la memoria temporal de tu navegador
                                o dispositivo. Una vez que cierras la pestaña, toda la información desaparece sin dejar rastro en nuestros servidores.
                            </p>

                            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginTop: '2rem', marginBottom: '1rem' }}>Privacidad y Almacenamiento</h2>
                            <p style={{ marginBottom: '1.5rem' }}>
                                Si decides registrarte, tu información se almacena de manera segura en bases de datos encriptadas (Supabase).
                                Ni siquiera nosotros tenemos acceso a tus contraseñas, y puedes solicitar la eliminación permanente de tu cuenta y eventos
                                en cualquier momento desde la interfaz principal.
                            </p>
                        </div>
                    ) : (
                        <View>
                            <Text className="text-3xl font-bold text-white mb-4">Acerca de SplitPay</Text>
                            <Text className="text-gray-300 text-base mb-6 leading-relaxed">
                                SplitPay es la solución definitiva para gestionar gastos compartidos, dividir cuentas en viajes, o cuadrar finanzas con compañeros de piso. Nuestra plataforma de cálculo y división de gastos está diseñada para ser ultra rápida y equitativa.
                            </Text>

                            <Text className="text-2xl font-bold text-white mb-4 mt-4">¿Cómo funciona el cálculo de deudas?</Text>
                            <Text className="text-gray-300 text-base mb-6 leading-relaxed">
                                A diferencia de otras calculadoras, SplitPay utiliza un algoritmo dinámico que asume que todos los integrantes del evento participaron equitativamente en todos los gastos. El sistema suma el total de los gastos, lo divide entre el número de participantes para encontrar la cuota ideal, y luego calcula quién pagó más o menos de su cuota, generando la ruta de transferencias más directa.
                            </Text>

                            <Text className="text-2xl font-bold text-white mb-4 mt-4">¿Qué es el Modo Invitado (Offline)?</Text>
                            <Text className="text-gray-300 text-base mb-6 leading-relaxed">
                                Entendemos la necesidad de privacidad. El Modo Invitado permite usar toda la potencia de la calculadora de SplitPay bajo una arquitectura offline. Tus datos, participantes, y gastos vivirán exclusivamente en la memoria temporal de tu navegador o dispositivo. Una vez que cierras la pestaña, toda la información desaparece sin dejar rastro en nuestros servidores.
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
