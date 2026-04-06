import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { supabase } from '../src/lib/supabase';
import { useRouter } from 'expo-router';

export default function ResetPasswordScreen() {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // Custom Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);

    const router = useRouter();

    const showModal = (title, message, success = false) => {
        setModalTitle(title);
        setModalMessage(message);
        setIsSuccess(success);
        setModalVisible(true);
    };

    const handleUpdatePassword = async () => {
        if (!password || password.length < 6) {
            showModal('Contraseña Débil', 'Por favor, ingresa una contraseña de al menos 6 caracteres.');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password });
        setLoading(false);

        if (error) {
            showModal('Error', error.message);
        } else {
            showModal('Éxito', '¡Tu contraseña ha sido actualizada correctamente!', true);
        }
    };

    const closeModal = () => {
        setModalVisible(false);
        if (isSuccess) {
            router.replace('/(app)'); // After updating, auth session is active. Go to dashboard.
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-950">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-center px-6">
                <View className="flex-1 justify-center items-center">
                    {/* Header */}
                    <View className="items-center mb-8">
                        <Text className="text-4xl font-extrabold text-blue-400 mb-3 tracking-tight">Recuperación</Text>
                        <Text className="text-gray-400 text-center text-sm md:text-base max-w-sm">
                            Ingresa tu nueva contraseña para acceder a tu cuenta.
                        </Text>
                    </View>

                    {/* Main Form */}
                    <View className="bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-800 shadow-2xl w-full max-w-sm md:max-w-md mx-auto relative overflow-hidden">
                        <View className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-400 opacity-50"></View>

                        <Text className="text-gray-300 font-bold mb-2 text-sm ml-1">Nueva Contraseña</Text>
                        <TextInput
                            className="w-full bg-gray-950 text-white border border-gray-800 rounded-xl p-4 mb-8 shadow-inner"
                            placeholder="••••••••"
                            placeholderTextColor="#4b5563"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            editable={!loading}
                        />

                        <TouchableOpacity
                            onPress={handleUpdatePassword}
                            disabled={loading}
                            className={`w-full py-3.5 rounded-xl items-center shadow-lg transition-colors ${loading ? 'bg-gray-700' : 'bg-blue-600 hover:bg-blue-500'}`}
                        >
                            <Text className="text-white font-bold text-base">{loading ? 'Actualizando...' : 'Actualizar Contraseña'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>

            {/* Custom Modal */}
            <Modal
                transparent={true}
                visible={modalVisible}
                animationType="fade"
                onRequestClose={closeModal}
            >
                <View className="flex-1 justify-center items-center bg-black/80 backdrop-blur-sm px-6">
                    <View className="bg-gray-900 border border-gray-700 p-8 rounded-3xl w-full max-w-sm items-center shadow-2xl relative overflow-hidden">
                        <View className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r opacity-50 ${isSuccess ? 'from-emerald-500 to-teal-400' : 'from-red-500 to-orange-400'}`}></View>
                        <Text className="text-xl font-bold text-white mb-4 text-center">{modalTitle}</Text>
                        <Text className="text-gray-300 text-center mb-6 leading-5">{modalMessage}</Text>
                        <TouchableOpacity
                            onPress={closeModal}
                            className="w-full bg-gray-800 py-3.5 rounded-xl items-center border border-gray-700 hover:bg-gray-700 transition-colors shadow-lg"
                        >
                            <Text className="text-white font-bold text-base">Entendido</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
