import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { supabase, checkSupabaseConnection } from '../src/lib/supabase';
import { useAuth } from '../src/providers/AuthProvider';
import { useRouter } from 'expo-router';
import AdContainer from './components/AdContainer';
import { useEffect } from 'react';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // Custom Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [connectionStatus, setConnectionStatus] = useState('checking'); // 'checking', 'ok', 'error'
    const [connectionError, setConnectionError] = useState(null);

    useEffect(() => {
        const checkConn = async () => {
            const result = await checkSupabaseConnection();
            if (result.ok) {
                setConnectionStatus('ok');
            } else {
                setConnectionStatus('error');
                setConnectionError(result.error);
                console.error("❌ Supabase Connection Error:", result.error);
            }
        };
        checkConn();
    }, []);

    const { enterGuestMode } = useAuth();
    const router = useRouter();

    const showModal = (title, message) => {
        setModalTitle(title);
        setModalMessage(message);
        setModalVisible(true);
    };

    const handleLogin = async () => {
        if (!email || !password) {
            showModal('Error', 'Por favor ingresa tu correo y contraseña.');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        setLoading(false);

        if (error) {
            console.error("❌ Login Error Detail:", error);
            // Supabase returns generic error or specific text, we translate loosely or show it
            showModal('Error al iniciar sesión', error.message + (error.status ? ` (Status: ${error.status})` : ''));
        } else {
            router.replace('/(app)');
        }
    };

    const handleRegister = async () => {
        if (!email || !password) {
            showModal('Error', 'Por favor ingresa tu correo y contraseña para registrarte.');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.signUp({
            email,
            password,
        });
        setLoading(false);

        if (error) {
            console.error("❌ Registration Error Detail:", error);
            showModal('Error de registro', error.message + (error.status ? ` (Status: ${error.status})` : ''));
        } else {
            showModal('Registro exitoso', '¡Revisa tu correo para verificar tu cuenta o inicia sesión ahora mismo!');
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            showModal('Atención', 'Por favor ingresa tu correo electrónico para enviarte las instrucciones de recuperación.');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        setLoading(false);

        if (error) {
            showModal('Error', error.message);
        } else {
            showModal('Correo enviado', 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña en unos minutos.');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-950 relative z-0">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 px-4 md:px-12 py-6">

                {/* Animated Split Container */}
                <View className="flex-1 flex-col md:flex-row max-w-6xl mx-auto w-full transition-all duration-700 ease-in-out">

                    {/* Left Pane: Branding & Intro */}
                    <View className="flex-[0.8] md:flex-1 justify-center items-center md:items-start md:pr-12 md:mr-8 transition-all duration-700 mb-8 md:mb-0">
                        {/* Header and Logo */}
                        <View className="items-center md:items-start mb-6 md:mb-10 w-full">
                            <View className="py-2">
                                <Text className="text-6xl md:text-7xl lg:text-8xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300 tracking-tighter leading-tight">
                                    SplitPay
                                </Text>
                            </View>
                            <Text className="text-gray-400 text-center md:text-left text-sm md:text-lg lg:text-xl max-w-sm md:max-w-md leading-relaxed">
                                Gestiona tus gastos grupales de forma equitativa y colaborativa. Sin matemáticas, sin estrés.
                            </Text>
                        </View>

                    </View>

                    {/* Right Pane: Main Auth Form Card */}
                    <View className="flex-1 justify-center transition-all duration-700 relative w-full max-w-sm md:max-w-md mx-auto md:mx-0">
                        <View className="bg-gray-900/90 backdrop-blur-md p-6 md:p-8 rounded-[2rem] border border-gray-800 shadow-2xl overflow-hidden relative w-full">
                            {/* Subtle background glow effect */}
                            <View className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-50"></View>

                            <Text className="text-gray-300 font-bold mb-2 text-sm ml-1">Correo electrónico</Text>
                            <TextInput
                                className="w-full bg-gray-950 text-white border border-gray-800 rounded-xl p-4 mb-4 shadow-inner transition-colors duration-200 focus:border-emerald-500/50"
                                placeholder="ejemplo@correo.com"
                                placeholderTextColor="#4b5563"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                editable={!loading}
                            />

                            <Text className="text-gray-300 font-bold mb-2 text-sm ml-1">Contraseña</Text>
                            <TextInput
                                className="w-full bg-gray-950 text-white border border-gray-800 rounded-xl p-4 mb-8 shadow-inner transition-colors duration-200 focus:border-emerald-500/50"
                                placeholder="••••••••"
                                placeholderTextColor="#4b5563"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                editable={!loading}
                            />

                            {loading ? (
                                <ActivityIndicator size="large" color="#34d399" className="my-6" />
                            ) : (
                                <View className="gap-y-3">
                                    <TouchableOpacity
                                        onPress={handleLogin}
                                        className="w-full bg-emerald-600 py-3.5 rounded-xl items-center shadow-lg hover:bg-emerald-500 transition-colors"
                                    >
                                        <Text className="text-white font-bold text-base">Iniciar Sesión</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={handleRegister}
                                        className="w-full bg-gray-800 py-3.5 rounded-xl items-center border border-gray-700 hover:bg-gray-700 transition-colors"
                                    >
                                        <Text className="text-gray-300 font-bold text-base">Crear Cuenta</Text>
                                    </TouchableOpacity>

                                    <View className="flex-row items-center my-3">
                                        <View className="flex-1 h-px bg-gray-800"></View>
                                        <Text className="text-gray-500 text-[10px] md:text-xs px-3 uppercase tracking-wider">O también</Text>
                                        <View className="flex-1 h-px bg-gray-800"></View>
                                    </View>

                                    <TouchableOpacity
                                        onPress={enterGuestMode}
                                        className="w-full bg-transparent py-3.5 rounded-xl items-center border border-dashed border-gray-600 hover:bg-gray-800 hover:border-gray-500 transition-colors"
                                    >
                                        <Text className="text-gray-400 font-bold text-base">Modo Invitado</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={handleForgotPassword} className="mt-5 items-center">
                                        <Text className="text-blue-400 text-sm font-medium hover:text-blue-300 transition-colors">¿Olvidaste tu contraseña?</Text>
                                    </TouchableOpacity>

                                    {/* Connectivity Indicator */}
                                    <View className="mt-4 flex-row items-center justify-center border-t border-gray-800 pt-4">
                                        <View className={`w-2 h-2 rounded-full mr-2 ${connectionStatus === 'ok' ? 'bg-emerald-500' : connectionStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                                        <Text className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                                            {connectionStatus === 'ok' ? 'SISTEMA ONLINE' : connectionStatus === 'error' ? 'ERROR DE CONEXIÓN' : 'VERIFICANDO SISTEMA...'}
                                        </Text>
                                        {connectionStatus === 'error' && (
                                            <TouchableOpacity onPress={() => showModal('Detalle de Conexión', connectionError || 'No se pudo conectar con el servidor de base de datos.')}>
                                                <Text className="ml-2 text-[10px] text-emerald-400 underline font-bold">VER INFO</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>

                </View>

                {/* Ad Content */}
                <AdContainer className="max-w-md mx-auto mt-4" />

                {/* Mobile Footer */}
                <View className="mt-8 mb-4 items-center md:hidden">
                    <Text className="text-[10px] uppercase font-bold tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-gray-500 to-gray-700">SPLITPAY V2.0</Text>
                    <TouchableOpacity onPress={() => router.push('/faq')} className="mt-2">
                        <Text className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors uppercase tracking-widest">Preguntas Frecuentes (FAQ)</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Desktop Footer */}
            <View className="absolute bottom-6 left-12 hidden md:block z-50">
                <Text className="text-[10px] uppercase font-bold tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-gray-500 to-gray-700">SPLITPAY V2.0</Text>
                <TouchableOpacity onPress={() => router.push('/faq')} className="mt-1">
                    <Text className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors uppercase tracking-widest">Preguntas Frecuentes (FAQ)</Text>
                </TouchableOpacity>
            </View>

            {/* Custom Modal */}
            <Modal
                transparent={true}
                visible={modalVisible}
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/80 backdrop-blur-sm px-6">
                    <View className="bg-gray-900 border border-gray-700 p-8 rounded-3xl w-full max-w-sm items-center shadow-2xl relative overflow-hidden">
                        {/* Red glow effect indicator inside modal */}
                        <View className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 to-orange-400 opacity-50"></View>

                        <Text className="text-xl font-bold text-white mb-4 text-center">{modalTitle}</Text>
                        <Text className="text-gray-300 text-center mb-6 leading-5">{modalMessage}</Text>

                        <TouchableOpacity
                            onPress={() => setModalVisible(false)}
                            className="w-full bg-gray-800 py-3.5 rounded-xl items-center border border-gray-700 hover:bg-gray-700 transition-colors shadow-lg"
                        >
                            <Text className="text-white font-bold text-base">Entendido</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView >
    );
}
