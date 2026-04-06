import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, SafeAreaView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../../src/lib/supabase';

export default function HistoryScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [deletedExpenses, setDeletedExpenses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDeletedExpenses();
    }, [id]);

    const fetchDeletedExpenses = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('expenses')
                .select('*, pagado_por(*), borrado_por(*)')
                .eq('id_evento', id)
                .eq('estado', 'borrado')
                .order('fecha_borrado', { ascending: false });

            if (error) throw error;
            setDeletedExpenses(data || []);
        } catch (error) {
            console.log('Error fetching history:', error.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 bg-gray-900 items-center justify-center">
                <ActivityIndicator color="#34d399" />
            </View>
        );
    }

    const renderItem = ({ item }) => {
        const deletedDate = item.fecha_borrado ? new Date(item.fecha_borrado).toLocaleString() : 'Fecha desconocida';
        const deletedBy = item.borrado_por?.nombre || item.borrado_por?.email || 'Usuario Desconocido';

        return (
            <View className="bg-gray-800 p-4 mb-3 rounded-lg border border-red-900/50 flex-col">
                <View className="flex-row justify-between items-start mb-2">
                    <Text className="text-gray-400 font-medium line-through">{item.descripcion}</Text>
                    <Text className="text-gray-500 font-mono line-through text-sm">{Number(item.monto).toFixed(2)}</Text>
                </View>
                <View className="bg-red-900/20 p-2 rounded mt-2 border border-red-900/30">
                    <Text className="text-red-400/80 text-xs text-center font-bold">
                        🗑️ Borrado por {deletedBy} el {deletedDate}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-900">
            <View className="flex-1 p-4">
                {deletedExpenses.length === 0 ? (
                    <View className="flex-1 justify-center items-center">
                        <Text className="text-gray-500 text-lg">No hay gastos eliminados.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={deletedExpenses}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={{ paddingBottom: 40 }}
                    />
                )}
            </View>
            <View className="p-4 items-center">
                <TouchableOpacity onPress={() => router.back()} className="bg-gray-800 px-6 py-3 rounded-lg border border-gray-700 w-full">
                    <Text className="text-white text-center font-bold">Volver al Evento</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
