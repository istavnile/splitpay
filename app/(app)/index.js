import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, Share } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/providers/AuthProvider';
import { useRouter } from 'expo-router';
import { calculateBalance } from '../../src/utils/balanceEngine';
import { Ionicons } from '@expo/vector-icons';
import AdContainer from '../components/AdContainer';

export default function DashboardScreen() {
    const { user, isGuest, guestState, logout } = useAuth();
    const router = useRouter();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    const [modalVisible, setModalVisible] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [newEventName, setNewEventName] = useState('');
    const [creating, setCreating] = useState(false);

    // Delete Modal State
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [eventToDelete, setEventToDelete] = useState(null);

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            if (isGuest) {
                setEvents(guestState.events || []);
                return;
            }

            const { data, error } = await supabase
                .from('events')
                .select('*')
                .order('fecha_creacion', { ascending: false });

            if (error) throw error;
            setEvents(data || []);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron cargar los eventos: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateEvent = async () => {
        if (!newEventName.trim()) {
            Alert.alert('Error', 'Ingresa un nombre para el evento.');
            return;
        }

        setCreating(true);
        try {
            if (isGuest) {
                const newEventId = "invitado-" + Date.now();
                const newEvent = {
                    id: newEventId,
                    nombre_evento: newEventName.trim(),
                    creado_por: "offline",
                    fecha_creacion: new Date().toISOString()
                };
                const newParticipant = {
                    id: "p-" + Date.now(),
                    id_evento: newEventId,
                    nombre: "Invitado",
                    creado_por: "offline"
                };

                guestState.setGuestEvents([newEvent, ...guestState.events]);
                guestState.setGuestParticipants([...guestState.participants, newParticipant]);

                setEvents([newEvent, ...guestState.events]);
                setModalVisible(false);
                setNewEventName('');
                router.push(`/event/${newEventId}`);
                return;
            }

            const { data, error } = await supabase
                .from('events')
                .insert([{ nombre_evento: newEventName.trim(), creado_por: user?.id }])
                .select()
                .single();

            if (error) throw error;

            const userName = user?.user_metadata?.nombre || user?.email?.split('@')[0] || 'Yo';
            await supabase
                .from('participants')
                .insert([{ id_evento: data.id, nombre: userName, creado_por: user?.id }]);

            setEvents([data, ...events]);
            setModalVisible(false);
            setNewEventName('');
            router.push(`/event/${data.id}`);
        } catch (error) {
            Alert.alert('Error al crear evento', error.message);
        } finally {
            setCreating(false);
        }
    };

    const confirmDeleteEvent = (eventId) => {
        setEventToDelete(eventId);
        setDeleteModalVisible(true);
    };

    const handleConfirmDelete = () => {
        if (eventToDelete) {
            deleteEvent(eventToDelete);
        }
        setDeleteModalVisible(false);
        setEventToDelete(null);
    };

    const deleteEvent = async (eventId) => {
        try {
            setLoading(true);
            if (isGuest) {
                const updatedEvents = guestState.events.filter(e => e.id !== eventId);
                guestState.setGuestEvents(updatedEvents);
                setEvents(updatedEvents);
                return;
            }

            const { error: expError } = await supabase.from('expenses').delete().eq('id_evento', eventId);
            if (expError) throw expError;

            const { error: partError } = await supabase.from('participants').delete().eq('id_evento', eventId);
            if (partError) throw partError;

            const { error: evtError } = await supabase.from('events').delete().eq('id', eventId);
            if (evtError) throw evtError;

            setEvents(events.filter(e => e.id !== eventId));
        } catch (error) {
            Alert.alert("Error", "No se pudo eliminar el evento. " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleShareEvent = async (eventId) => {
        try {
            let participantsData = [];
            let expensesData = [];

            if (isGuest) {
                participantsData = guestState.participants.filter(p => p.id_evento === eventId);
                expensesData = guestState.expenses.filter(e => e.id_evento === eventId && e.estado === 'activo');
            } else {
                const { data: pData, error: partError } = await supabase
                    .from('participants')
                    .select('*')
                    .eq('id_evento', eventId);
                if (partError) throw partError;
                participantsData = pData;

                const { data: eData, error: expError } = await supabase
                    .from('expenses')
                    .select('*, pagado_por(*)')
                    .eq('id_evento', eventId)
                    .eq('estado', 'activo');
                if (expError) throw expError;
                expensesData = eData;
            }

            if (!expensesData || expensesData.length === 0) {
                Alert.alert("Sin Gastos", "Este evento aún no tiene gastos para compartir.");
                return;
            }

            const uniqueIds = new Set();
            const profiles = {};
            participantsData.forEach(p => { profiles[p.id] = p.nombre; });
            expensesData.forEach(g => { uniqueIds.add(g.pagado_por.id); });

            const flatGastos = expensesData.map(g => ({
                monto: g.monto,
                pagado_por: g.pagado_por.id
            }));

            const result = calculateBalance(flatGastos, Array.from(uniqueIds), profiles);
            if (result.textoExportar) {
                await Share.share({ message: result.textoExportar.replace(/S\/|\$/g, 'S/') });
            }

        } catch (error) {
            Alert.alert("Error", "No se pudo generar el balance. " + error.message);
        }
    };

    const renderItem = (item) => (
        <TouchableOpacity
            key={item.id}
            onPress={() => router.push(`/event/${item.id}`)}
            className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-emerald-500/20 w-full md:w-[48%] lg:w-[32%] xl:w-[24%] mb-2 md:mb-0"
        >
            <View className="flex-col h-full justify-between">
                <View className="mb-4">
                    <Text className="text-white text-lg font-bold" numberOfLines={1}>{item.nombre_evento}</Text>
                    <Text className="text-emerald-400 text-xs mt-1 font-mono">
                        {new Date(item.fecha_creacion).toLocaleDateString()}
                    </Text>
                </View>

                <View className="flex-row items-center justify-between border-t border-gray-700 pt-3 mt-auto">
                    <View className="flex-row gap-2">
                        <TouchableOpacity onPress={() => handleShareEvent(item.id)} className="p-2 bg-blue-600/10 hover:bg-blue-600/20 rounded-lg transition-colors">
                            <Ionicons name="share-outline" size={18} color="#60a5fa" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => confirmDeleteEvent(item.id)} className="p-2 bg-red-900/20 hover:bg-red-900/40 rounded-lg transition-colors">
                            <Ionicons name="trash-outline" size={18} color="#f87171" />
                        </TouchableOpacity>
                    </View>
                    <View className="bg-gray-700 w-8 h-8 rounded-full items-center justify-center">
                        <Text className="text-gray-300 text-xl font-bold -mt-0.5">›</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView className="flex-1 bg-gray-900">
            {/* Header / Menu Button */}
            <View className="flex-row justify-between items-center px-4 pt-12 pb-2 z-10">
                <Text className="text-white text-3xl font-bold">Me debes \ Te debo</Text>
                <TouchableOpacity onPress={() => setMenuVisible(true)} className="bg-gray-800 px-3 py-2 rounded-xl flex-row items-center border border-gray-700 shadow-sm">
                    <Ionicons name="person-circle-outline" size={20} color="#d1d5db" className="mr-2" />
                    <Text className="text-gray-300 font-bold text-sm ml-1">Menú</Text>
                </TouchableOpacity>
            </View>

            <View className="flex-1 p-4">
                {loading ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#34d399" />
                    </View>
                ) : events.length === 0 ? (
                    <View className="flex-1 justify-center items-center space-y-4">
                        <Text className="text-gray-400 text-lg">No tienes eventos activos.</Text>
                        <Text className="text-gray-500 text-sm">Crea uno usando el botón verde.</Text>
                    </View>
                ) : (
                    <>
                        <AdContainer className="mb-4 hidden md:flex" />
                        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                            <View className="flex-row flex-wrap justify-between gap-y-4">
                                {events.map(item => renderItem(item))}
                                {/* Dummy spacers to fix flex-between alignment on incomplete rows */}
                                {events.length > 0 && Array.from({ length: 4 }).map((_, i) => (
                                    <View key={`spacer-${i}`} className="w-full md:w-[48%] lg:w-[32%] xl:w-[24%] h-0" />
                                ))}
                            </View>
                        </ScrollView>

                        <View className="mt-4 mb-10 items-center opacity-70">
                            <Text className="text-center text-[10px] sm:text-[11px] font-mono text-transparent bg-clip-text bg-gradient-to-r from-gray-400 to-gray-600">Crafteado por Istav Nile en 12 Development.</Text>
                            <Text className="text-center text-[9px] sm:text-[10px] font-mono tracking-widest text-gray-600 mt-1">Los bugs son solo funciones no documentadas.</Text>
                            <Text className="text-center text-[9px] sm:text-[10px] font-mono tracking-widest text-gray-600">Úsalo bajo tu propio riesgo.</Text>
                        </View>
                    </>
                )}
            </View>
            {/* User Menu & Info Modal */}
            <Modal visible={menuVisible} animationType="slide" presentationStyle="pageSheet" transparent={Platform.OS === 'web'}>
                <View className="flex-1 bg-black/80 backdrop-blur-sm justify-center items-center md:p-4">
                    <SafeAreaView className="flex-1 w-full md:max-w-md bg-gray-900 md:rounded-2xl border-t md:border border-gray-800 shadow-2xl overflow-hidden mt-12 md:mt-0">
                        <View className="p-4 border-b border-gray-800 flex-row justify-between items-center bg-gray-900">
                            <Text className="text-white text-xl font-bold">Mi Perfil</Text>
                            <TouchableOpacity onPress={() => setMenuVisible(false)} className="p-2">
                                <Text className="text-gray-400 font-bold text-lg">✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 40 }}>
                            {/* User Card */}
                            <View className="bg-gray-800 rounded-xl p-4 border border-gray-700 mb-6 flex-row items-center justify-between">
                                <View>
                                    <Text className="text-gray-400 text-xs mb-1">Conectado como:</Text>
                                    <Text className="text-emerald-400 text-sm font-bold">{user?.email || 'Invitado'}</Text>
                                </View>
                                <TouchableOpacity onPress={() => logout()} className="bg-red-900/30 border border-red-900/50 px-4 py-2 rounded">
                                    <Text className="text-red-400 font-bold text-xs">{user ? 'Cerrar Sesión' : 'Salir'}</Text>
                                </TouchableOpacity>
                            </View>

                            {/* FAQs & Info */}
                            <Text className="text-xl font-bold text-white mb-2 mt-4">¿Cómo funciona SplitPay?</Text>
                            <Text className="text-gray-300 text-sm mb-6 leading-5">
                                Nuestra calculadora de gastos compartidos utiliza un sistema de balanceo inteligente. Al ingresar los gastos, el algoritmo calcula el promedio por persona y determina las transferencias óptimas para que todos queden a mano con el menor número de movimientos.
                            </Text>

                            <Text className="text-xl font-bold text-white mb-2">Preguntas frecuentes</Text>

                            <Text className="text-emerald-400 text-sm font-bold mt-2">¿Debo crear una cuenta?</Text>
                            <Text className="text-gray-300 text-sm mb-4 leading-5">Sí, para proteger tus cuentas, todo se sincroniza en la nube de forma segura bajo tu sesión.</Text>

                            <Text className="text-emerald-400 text-sm font-bold mt-2">¿Cómo comparto los resultados?</Text>
                            <Text className="text-gray-300 text-sm mb-6 leading-5">Dentro del detalle de cada evento, un botón verde te permitirá copiar o enviar por WhatsApp y correo móvil todo el resumen de deudas generado.</Text>

                            <View className="bg-gray-800 rounded-xl p-4 border border-gray-700 mt-4">
                                <Text className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Ideal para:</Text>
                                <Text className="text-gray-300 text-sm mb-1 leading-5">• Viajes grupales y vacaciones.</Text>
                                <Text className="text-gray-300 text-sm mb-1 leading-5">• Cenas y salidas con amigos.</Text>
                                <Text className="text-gray-300 text-sm mb-1 leading-5">• Gastos fijos de departamentos compartidos (roommates).</Text>
                                <Text className="text-gray-300 text-sm leading-5">• Eventos corporativos y celebraciones.</Text>
                            </View>
                        </ScrollView>
                    </SafeAreaView>
                </View>
            </Modal>

            {/* Floating Action Button */}
            <TouchableOpacity
                onPress={() => setModalVisible(true)}
                className="bg-emerald-600 items-center justify-center shadow-lg border border-emerald-500 absolute bottom-10 right-6 md:right-8 z-20 w-14 h-14 rounded-full hover:bg-emerald-500 transition-colors"
            >
                <Ionicons name="add" size={32} color="white" />
            </TouchableOpacity>

            {/* Create Event Modal */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-center items-center bg-black/80 backdrop-blur-sm px-4">
                    <View className="w-full max-w-md bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-2xl">
                        <Text className="text-white text-xl font-bold mb-4 text-center">Nuevo Evento</Text>

                        <TextInput
                            onChangeText={setNewEventName}
                            value={newEventName}
                            placeholder="Ej. Viaje a Cusco"
                            placeholderTextColor="#6b7280"
                            className="bg-gray-900 text-white text-base border border-gray-600 rounded-xl p-4 mb-6"
                            autoFocus
                        />

                        <View className="flex-row justify-end mt-4">
                            <TouchableOpacity
                                onPress={() => setModalVisible(false)}
                                className="py-2.5 px-3 mr-4 rounded-xl bg-gray-700 justify-center items-center shadow-sm"
                            >
                                <Text className="text-gray-300 font-bold text-base mx-2">Cancelar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleCreateEvent}
                                disabled={creating}
                                className={`py-2.5 px-3 rounded-xl justify-center items-center shadow-lg ${creating ? 'bg-emerald-800' : 'bg-emerald-600'}`}
                            >
                                {creating ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <View className="flex-row items-center">
                                        <Text className="text-white font-bold text-base">Crear Evento</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal visible={deleteModalVisible} transparent animationType="fade">
                <View className="flex-1 justify-center items-center bg-black/80 backdrop-blur-sm px-4">
                    <View className="w-full max-w-sm bg-gray-900 p-6 rounded-3xl border border-gray-800 shadow-2xl relative overflow-hidden">
                        <View className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-600 to-rose-400 opacity-50"></View>
                        <Text className="text-white text-xl font-bold mb-4 text-center">Eliminar Evento</Text>
                        <Text className="text-gray-300 text-sm mb-6 text-center leading-5">
                            ¿Estás seguro de que quieres eliminar este evento y todo su historial de gastos y personas? Esta acción no se puede deshacer.
                        </Text>

                        <View className="flex-row justify-between mt-2 gap-3">
                            <TouchableOpacity
                                onPress={() => setDeleteModalVisible(false)}
                                className="flex-1 py-3.5 rounded-xl bg-gray-800 border border-gray-700 justify-center items-center shadow-sm hover:bg-gray-700 hover:opacity-80 transition-opacity"
                            >
                                <Text className="text-gray-300 font-bold text-base">Cancelar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleConfirmDelete}
                                className="flex-1 py-3.5 rounded-xl bg-red-900/80 border border-red-800 justify-center items-center shadow-lg hover:bg-red-800 hover:opacity-80 transition-opacity"
                            >
                                <Text className="text-white font-bold text-base">Eliminar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
