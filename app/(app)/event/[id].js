import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, ActivityIndicator, SafeAreaView, Platform, KeyboardAvoidingView, ScrollView, Linking, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/providers/AuthProvider';
import { calculateBalance } from '../../../src/utils/balanceEngine';
import AdContainer from '../../components/AdContainer';

export default function EventDetailScreen() {
    const { id } = useLocalSearchParams();
    const { user, isGuest, guestState } = useAuth();
    const router = useRouter();

    const [evento, setEvento] = useState(null);
    const [gastos, setGastos] = useState([]);
    const [participantes, setParticipantes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currency, setCurrency] = useState('S/');

    // Form State
    const [descripcion, setDescripcion] = useState('');
    const [monto, setMonto] = useState('');
    const [pagadoPorId, setPagadoPorId] = useState(null);
    const [adding, setAdding] = useState(false);

    // Participant Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [newParticipantName, setNewParticipantName] = useState('');
    const [addingParticipant, setAddingParticipant] = useState(false);

    // Balance Data
    const [balanceText, setBalanceText] = useState('');
    const [balanceHtml, setBalanceHtml] = useState([]);
    const [resumenArr, setResumenArr] = useState([]);
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        fetchEventData();
    }, [id]);

    useEffect(() => {
        if (participantes.length > 0 && gastos.length >= 0) {
            processBalance();
        }
    }, [gastos, currency]);

    const fetchEventData = async () => {
        try {
            setLoading(true);

            if (isGuest) {
                const eventData = guestState.events.find(e => e.id === id);
                if (!eventData) throw new Error("Evento no encontrado");
                setEvento(eventData);

                const participantsData = guestState.participants.filter(p => p.id_evento === id);
                setParticipantes(participantsData);

                if (participantsData?.length > 0) {
                    const me = participantsData.find(p => p.nombre === 'Invitado');
                    setPagadoPorId(me ? me.id : participantsData[0].id);
                }

                fetchExpenses();
                return;
            }

            // 1. Fetch Event Details
            const { data: eventData, error: eventError } = await supabase
                .from('events')
                .select('*')
                .eq('id', id)
                .single();
            if (eventError) throw eventError;
            setEvento(eventData);

            // 2. Fetch Event Participants
            const { data: participantsData, error: participantsError } = await supabase
                .from('participants')
                .select('*')
                .eq('id_evento', id)
                .order('fecha_creacion', { ascending: true });
            if (participantsError) throw participantsError;
            setParticipantes(participantsData || []);

            if (participantsData?.length > 0) {
                // Auto-select the current user if they are in the participants list, else select the first one
                const me = user ? participantsData.find(p => p.creado_por === user.id) : null;
                setPagadoPorId(me ? me.id : participantsData[0].id);
            }

            // 3. Fetch Active Expenses
            fetchExpenses();

        } catch (error) {
            Alert.alert('Error', error.message);
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const fetchExpenses = async () => {
        if (isGuest) {
            const expensesData = guestState.expenses.filter(e => e.id_evento === id && e.estado === 'activo');
            setGastos(expensesData);
            return;
        }

        const { data: expensesData, error: expError } = await supabase
            .from('expenses')
            .select('*, pagado_por(*)')
            .eq('id_evento', id)
            .eq('estado', 'activo')
            .order('fecha_creacion', { ascending: false });

        if (expError) {
            Alert.alert('Error gastos', expError.message);
        } else {
            setGastos(expensesData || []);
        }
    };

    const handleCreateExpense = async () => {
        const parsedMonto = parseFloat(monto);
        if (!descripcion.trim() || isNaN(parsedMonto) || parsedMonto <= 0 || !pagadoPorId) {
            Alert.alert('Error', 'Completa todos los campos correctamente.');
            return;
        }

        setAdding(true);
        try {
            if (isGuest) {
                const payer = participantes.find(p => p.id === pagadoPorId);
                const newExpense = {
                    id: "g-" + Date.now(),
                    id_evento: id,
                    descripcion: descripcion.trim(),
                    monto: parsedMonto,
                    pagado_por: payer,
                    creado_por: "offline",
                    estado: 'activo',
                    fecha_creacion: new Date().toISOString()
                };

                guestState.setGuestExpenses([newExpense, ...guestState.expenses]);
                setGastos([newExpense, ...gastos]);
                setDescripcion('');
                setMonto('');
                return;
            }

            const { data, error } = await supabase
                .from('expenses')
                .insert([{
                    id_evento: id,
                    descripcion: descripcion.trim(),
                    monto: parsedMonto,
                    pagado_por: pagadoPorId,
                    creado_por: user?.id
                }])
                .select('*, pagado_por(*)')
                .single();

            if (error) throw error;

            setGastos([data, ...gastos]);
            setDescripcion('');
            setMonto('');
        } catch (error) {
            Alert.alert('Error al guardar', error.message);
        } finally {
            setAdding(false);
        }
    };

    const handleAddParticipant = async () => {
        if (!newParticipantName.trim()) {
            Alert.alert('Error', 'Ingresa un nombre para la persona.');
            return;
        }

        setAddingParticipant(true);
        try {
            if (isGuest) {
                const newParticipant = {
                    id: "p-" + Date.now(),
                    id_evento: id,
                    nombre: newParticipantName.trim(),
                    creado_por: "offline",
                    fecha_creacion: new Date().toISOString()
                };
                guestState.setGuestParticipants([...guestState.participants, newParticipant]);
                setParticipantes([...participantes, newParticipant]);
                setModalVisible(false);
                setNewParticipantName('');
                setPagadoPorId(newParticipant.id);
                return;
            }

            const { data, error } = await supabase
                .from('participants')
                .insert([{ id_evento: id, nombre: newParticipantName.trim(), creado_por: user?.id }])
                .select()
                .single();

            if (error) throw error;

            setParticipantes([...participantes, data]);
            setModalVisible(false);
            setNewParticipantName('');
            setPagadoPorId(data.id); // Auto select new person
        } catch (error) {
            Alert.alert('Error al añadir', error.message);
        } finally {
            setAddingParticipant(false);
        }
    };

    const handleSoftDelete = async (gastoId) => {
        try {
            // Optimizacion UI primero
            setGastos(gastos.filter(g => g.id !== gastoId));

            if (isGuest) {
                const updatedExpenses = guestState.expenses.map(g =>
                    g.id === gastoId ? { ...g, estado: 'borrado' } : g
                );
                guestState.setGuestExpenses(updatedExpenses);
                return;
            }

            const { error } = await supabase
                .from('expenses')
                .update({
                    estado: 'borrado',
                    borrado_por: user?.id,
                    fecha_borrado: new Date().toISOString()
                })
                .eq('id', gastoId);

            if (error) throw error;
        } catch (error) {
            Alert.alert('Error', 'No se pudo eliminar el gasto: ' + error.message);
            fetchExpenses(); // Rollback if failed
        }
    };

    const getParticipantColor = (id) => {
        const themeColors = [
            { bg: 'bg-red-500', text: 'text-red-400' },
            { bg: 'bg-blue-500', text: 'text-blue-400' },
            { bg: 'bg-green-500', text: 'text-green-400' },
            { bg: 'bg-yellow-500', text: 'text-yellow-400' },
            { bg: 'bg-purple-500', text: 'text-purple-400' },
            { bg: 'bg-pink-500', text: 'text-pink-400' },
            { bg: 'bg-orange-500', text: 'text-orange-400' },
            { bg: 'bg-teal-500', text: 'text-teal-400' }
        ];

        const index = participantes.findIndex(p => p.id === id);
        if (index === -1) return themeColors[0];
        return themeColors[index % themeColors.length];
    };

    const processBalance = () => {
        // Collect unique participant IDs and lookup map
        const uniqueIds = new Set();
        const profiles = {};

        participantes.forEach(p => {
            profiles[p.id] = p.nombre;
            uniqueIds.add(p.id); // Add EVERY participant to the pool!
        });

        // Extract formatted data
        const flatGastos = gastos.map(g => ({
            monto: g.monto,
            pagado_por: g.pagado_por.id
        }));

        const result = calculateBalance(flatGastos, Array.from(uniqueIds), profiles);
        setResumenArr(result.resumen);
        setBalanceHtml(result.transferencias);
        setBalanceText(result.textoExportar);
    };

    const shareWhatsApp = async () => {
        if (!balanceText) return;
        const text = balanceText.replace(/S\/|\$/g, currency);
        try {
            await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`);
        } catch (error) {
            Alert.alert('Error', 'No se pudo abrir WhatsApp. Asegúrate de tenerlo instalado.');
        }
    };

    const copyToClipboard = async () => {
        if (!balanceText) return;
        const text = balanceText.replace(/S\/|\$/g, currency);
        await Clipboard.setStringAsync(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const shareEmail = async () => {
        if (!balanceText) return;
        const text = balanceText.replace(/S\/|\$/g, currency);
        try {
            await Linking.openURL(`mailto:?subject=Balance SplitPay&body=${encodeURIComponent(text)}`);
        } catch (error) {
            Alert.alert('Error', 'No se pudo abrir el cliente de correo.');
        }
    };

    if (loading) {
        return <View className="flex-1 bg-gray-900 items-center justify-center"><ActivityIndicator color="#34d399" /></View>;
    }

    const renderGasto = ({ item }) => {
        const pTheme = getParticipantColor(item.pagado_por?.id);

        return (
            <View key={item.id} className="flex-row justify-between items-center py-3 border-b border-gray-700">
                <View className="flex-1">
                    <Text className="text-gray-300 font-medium text-base">{item.descripcion}</Text>
                    <View className="flex-row items-center mt-1">
                        <View className={`w-2 h-2 rounded-full mr-1.5 ${pTheme.bg}`} />
                        <Text className={`${pTheme.text} text-xs`}>
                            {item.pagado_por?.nombre} pagó
                        </Text>
                    </View>
                </View>
                <Text className="text-gray-300 font-mono text-base mr-3">{currency}{Number(item.monto).toFixed(2)}</Text>
                <TouchableOpacity onPress={() => handleSoftDelete(item.id)} className="p-2">
                    <Text className="text-red-400 text-lg">✕</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-900 border-t border-gray-800">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">

                <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                    <AdContainer className="max-w-7xl mx-auto mb-2" />
                    <View className="flex-col md:flex-row gap-6 max-w-7xl mx-auto w-full transition-all duration-500">
                        {/* LEFT COLUMN: Header, Add Expense, Balance */}
                        <View className="w-full md:w-[45%] lg:w-[40%] xl:w-[35%] flex-col gap-6 transition-all duration-500">

                            {/* Header Options */}
                            <View className="flex-row justify-between items-center bg-gray-900 z-10">
                                <Text className="text-white text-xl font-bold flex-1" numberOfLines={1}>
                                    {evento?.nombre_evento}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setCurrency(currency === 'S/' ? '$' : 'S/')}
                                    className="bg-gray-800 px-3 py-1 rounded border border-gray-700 flex-row items-center ml-2"
                                >
                                    <Text className="text-gray-400 text-xs mr-2">Moneda:</Text>
                                    <Text className="text-emerald-400 font-bold">{currency}</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Add Expense Card */}
                            <View className="bg-gray-800 rounded-xl p-4 border border-gray-700 mb-6">
                                <View className="flex-row justify-between items-center mb-3 border-b border-gray-700 pb-2">
                                    <Text className="text-sm font-bold text-gray-400 uppercase tracking-widest">Registrar Gasto</Text>
                                    <TouchableOpacity
                                        onPress={() => setModalVisible(true)}
                                        className="w-8 h-8 bg-gray-700 rounded-full border border-gray-600 items-center justify-center transition-colors hover:bg-gray-600 active:bg-gray-500"
                                    >
                                        <Ionicons name="person-add" size={14} color="white" />
                                    </TouchableOpacity>
                                </View>

                                <Text className="text-xs text-gray-500 mb-2">¿Quién pagó?</Text>
                                <View className="flex-row items-center mb-4 w-full">
                                    <View className="flex-1 overflow-hidden" style={{ minWidth: 0 }}>
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={Platform.OS === 'web'}
                                            className="pt-1 pb-2"
                                            contentContainerStyle={{ paddingRight: 8 }}
                                        >
                                            {participantes.map(p => {
                                                const pTheme = getParticipantColor(p.id);
                                                const isSelected = pagadoPorId === p.id;
                                                return (
                                                    <TouchableOpacity
                                                        key={p.id}
                                                        onPress={() => setPagadoPorId(p.id)}
                                                        className={`mr-2 px-3 py-2 rounded-lg border flex-row items-center transition-colors hover:bg-gray-800 active:bg-gray-700 ${isSelected ? 'bg-gray-800 border-gray-500' : 'bg-gray-900 border-gray-700'}`}
                                                    >
                                                        <View className={`w-2.5 h-2.5 rounded-full mr-2 ${pTheme.bg} ${isSelected ? 'opacity-100' : 'opacity-40'}`} />
                                                        <Text className={`text-sm font-bold whitespace-nowrap ${isSelected ? 'text-white' : 'text-gray-400'}`}>{p.nombre}</Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>
                                </View>

                                <TextInput
                                    className="w-full bg-gray-900 text-white text-base border border-gray-600 rounded-xl p-4 mb-4"
                                    placeholder="Detalle (ej: Parrilla)"
                                    placeholderTextColor="#6b7280"
                                    value={descripcion}
                                    onChangeText={setDescripcion}
                                />

                                <View className="flex-row gap-3 mb-2">
                                    <View className="flex-1 flex-row items-center bg-gray-900 border border-gray-600 rounded-xl px-4">
                                        <Text className="text-white font-bold mr-2 text-base">{currency}</Text>
                                        <TextInput
                                            className="flex-1 text-white py-4 pr-2 text-base"
                                            placeholder="0.00"
                                            placeholderTextColor="#6b7280"
                                            keyboardType="numeric"
                                            value={monto}
                                            onChangeText={setMonto}
                                        />
                                    </View>
                                    <TouchableOpacity
                                        onPress={handleCreateExpense}
                                        disabled={adding}
                                        className="bg-emerald-600 py-3 px-4 rounded-xl flex-row justify-center items-center shadow-lg shrink-0 transition-colors hover:bg-emerald-500 active:bg-emerald-400"
                                    >
                                        {adding ? <ActivityIndicator color="#fff" /> : (
                                            <>
                                                <Ionicons name="add-circle-outline" size={20} color="white" className="mr-1" />
                                                <Text className="text-white font-bold text-sm ml-1">Registrar</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                            {/* Balance Engine Results (Moved to Left Column for Desktop) */}
                            <View className="bg-gray-800 rounded-xl p-4 border-l-4 border-emerald-500 shadow-sm transition-all duration-500">
                                <Text className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-700 pb-2">Deudas y Transferencias</Text>

                                <View className="bg-gray-900 rounded p-3 mb-4 border border-gray-700">
                                    {balanceHtml.length === 0 ? (
                                        <Text className="text-emerald-400 text-sm text-center font-bold">Sin deudas pendientes 🎉</Text>
                                    ) : (
                                        balanceHtml.map((t, i) => (
                                            <Text key={i} className="text-xs text-gray-300 mb-2 leading-5 px-2">
                                                <Text className="font-bold text-white">{t.de}</Text> transfiere a <Text className="font-bold text-white">{t.para}</Text>: <Text className="font-mono text-emerald-400 font-bold">{currency}{t.monto.toFixed(2)}</Text>
                                            </Text>
                                        ))
                                    )}
                                </View>

                                <Text className="text-xs text-center text-gray-400 mb-3 font-bold">Compartir Reporte Exácto:</Text>
                                <View className="flex-row justify-between gap-3">
                                    <TouchableOpacity onPress={shareWhatsApp} disabled={balanceHtml.length === 0} className={`flex-1 py-3 rounded-xl flex-row justify-center items-center shadow-sm ${balanceHtml.length === 0 ? 'bg-gray-700' : 'bg-[#25D366] hover:bg-green-500 transition-colors'}`}>
                                        <Ionicons name="logo-whatsapp" size={18} color={balanceHtml.length === 0 ? '#6b7280' : 'white'} className="mr-0 lg:mr-2" />
                                        <Text className={`${balanceHtml.length === 0 ? 'text-gray-500' : 'text-white'} text-sm font-bold hidden lg:flex`}>WhatsApp</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={copyToClipboard} disabled={balanceHtml.length === 0} className={`flex-1 py-3 rounded-xl flex-row justify-center items-center shadow-sm ${balanceHtml.length === 0 ? 'bg-gray-700' : isCopied ? 'bg-emerald-600' : 'bg-gray-600 hover:bg-gray-500 transition-colors'}`}>
                                        <Ionicons name={isCopied ? "checkmark-circle" : "copy-outline"} size={18} color={balanceHtml.length === 0 ? '#6b7280' : 'white'} className="mr-0 lg:mr-2" />
                                        <Text className={`${balanceHtml.length === 0 ? 'text-gray-500' : 'text-white'} text-sm font-bold hidden lg:flex`}>{isCopied ? '¡Copiado!' : 'Copiar'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={shareEmail} disabled={balanceHtml.length === 0} className={`flex-1 py-3 rounded-xl flex-row justify-center items-center shadow-sm ${balanceHtml.length === 0 ? 'bg-gray-700' : 'bg-blue-600 hover:bg-blue-500 transition-colors'}`}>
                                        <Ionicons name="mail-outline" size={18} color={balanceHtml.length === 0 ? '#6b7280' : 'white'} className="mr-0 lg:mr-2" />
                                        <Text className={`${balanceHtml.length === 0 ? 'text-gray-500' : 'text-white'} text-sm font-bold hidden lg:flex`}>Email</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        {/* RIGHT COLUMN: Expenses List */}
                        <View className="flex-1 flex-col transition-all duration-500">
                            <View className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-sm flex-1">
                                <View className="flex-row justify-between items-center border-b border-gray-700 pb-2 mb-2">
                                    <Text className="text-sm font-bold text-gray-400 uppercase tracking-widest">Gastos Activos</Text>
                                    <TouchableOpacity onPress={() => router.push(`/event/${id}/history`)} className="bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-600 hover:bg-gray-600 transition-colors">
                                        <Text className="text-blue-400 font-bold text-xs">Ver Historial</Text>
                                    </TouchableOpacity>
                                </View>

                                {gastos.length === 0 ? (
                                    <Text className="text-center text-gray-500 py-4 text-xs italic">Aún no hay gastos registrados.</Text>
                                ) : (
                                    gastos.map(g => renderGasto({ item: g }))
                                )}
                            </View>
                        </View>
                    </View>
                    <AdContainer className="max-w-7xl mx-auto mt-6" />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Create Participant Modal */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-center items-center bg-black/80 backdrop-blur-sm px-4">
                    <View className="w-full max-w-md bg-gray-800 p-6 rounded-3xl border border-gray-700 shadow-2xl">
                        <Text className="text-white text-xl font-bold mb-4 text-center">Añadir Persona</Text>

                        <TextInput
                            onChangeText={setNewParticipantName}
                            value={newParticipantName}
                            placeholder="Nombre (ej: Carlos)"
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
                                onPress={handleAddParticipant}
                                disabled={addingParticipant}
                                className={`py-2.5 px-3 rounded-xl shadow-lg justify-center items-center ${addingParticipant ? 'bg-emerald-800' : 'bg-emerald-600'}`}
                            >
                                {addingParticipant ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text className="text-white font-bold text-base">Guardar</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView >
    );
}
