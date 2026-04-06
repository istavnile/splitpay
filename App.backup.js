import './global.css';
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Alert, Share, SafeAreaView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

let InterstitialAd = null;
let AdEventType = null;

if (Platform.OS !== 'web') {
  const mobileAds = require('react-native-google-mobile-ads');
  InterstitialAd = mobileAds.InterstitialAd;
  AdEventType = mobileAds.AdEventType;
}
// AdMob Configuration (Test IDs are used in DEV and optionally kept here until production keys are ready)
const adUnitIdBanner = __DEV__ ? TestIds.BANNER : (Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544~1458002511' : 'ca-app-pub-3940256099942544~3347511713');
const adUnitIdInterstitial = __DEV__ ? TestIds.INTERSTITIAL : (Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544~1458002511' : 'ca-app-pub-3940256099942544~3347511713');

const interstitial = InterstitialAd.createForAdRequest(adUnitIdInterstitial, {
  requestNonPersonalizedAdsOnly: true
});

export default function App() {
  const [moneda, setMoneda] = useState('S/');
  const [personas, setPersonas] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [gastos, setGastos] = useState([]);

  // Inputs
  const [nuevaPersona, setNuevaPersona] = useState('');
  const [nuevoEvento, setNuevoEvento] = useState('');

  // Gasto Inputs
  const [gastoEvento, setGastoEvento] = useState(null);
  const [gastoPersona, setGastoPersona] = useState(null);
  const [gastoItem, setGastoItem] = useState('');
  const [gastoMonto, setGastoMonto] = useState('');

  // UI States
  const [balanceHtml, setBalanceHtml] = useState(null);
  const [resumenHtml, setResumenHtml] = useState([]);
  const [textoExportar, setTextoExportar] = useState('');

  const [showPrivacy, setShowPrivacy] = useState(false);
  const [actionsCount, setActionsCount] = useState(0);

  // Load Data
  useEffect(() => {
    loadData();
    interstitial.load();
    const unsubscribe = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      interstitial.load();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    calcularBalance();
    saveData();
  }, [personas, gastos]);

  const showInterstitialIfReady = () => {
    setActionsCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 4) { // Show ad every 4 major actions
        if (interstitial.loaded) interstitial.show();
        return 0;
      }
      return newCount;
    });
  };

  const loadData = async () => {
    try {
      const dataStr = await AsyncStorage.getItem('@splitpay_data');
      if (dataStr) {
        const data = JSON.parse(dataStr);
        if (data.personas) setPersonas(data.personas);
        if (data.eventos) setEventos(data.eventos);
        if (data.gastos) setGastos(data.gastos);
        if (data.moneda) setMoneda(data.moneda);
      }
    } catch (e) {
      console.log('Error loading data', e);
    }
  };

  const saveData = async () => {
    try {
      await AsyncStorage.setItem('@splitpay_data', JSON.stringify({ personas, eventos, gastos, moneda }));
    } catch (e) {
      console.log('Error saving data', e);
    }
  };

  const agregarPersona = () => {
    const n = nuevaPersona.trim();
    if (n && !personas.includes(n)) {
      setPersonas([...personas, n]);
      setNuevaPersona('');
    }
  };

  const eliminarPersona = (n) => {
    if (gastos.some(g => g.persona === n)) {
      Alert.alert("Error", "No puedes eliminar una persona con gastos registrados.");
      return;
    }
    setPersonas(personas.filter(p => p !== n));
  };

  const agregarEvento = () => {
    const n = nuevoEvento.trim();
    if (n && !eventos.includes(n)) {
      setEventos([...eventos, n]);
      setNuevoEvento('');
    }
  };

  const eliminarEvento = (n) => {
    if (gastos.some(g => g.evento === n)) {
      Alert.alert("Error", "No puedes eliminar un evento con gastos registrados.");
      return;
    }
    setEventos(eventos.filter(e => e !== n));
  };

  const agregarGasto = () => {
    const mon = parseFloat(gastoMonto);
    if (!gastoEvento || !gastoPersona || !gastoItem.trim() || isNaN(mon) || mon <= 0) {
      Alert.alert("Error", "Completa todos los campos correctamente.");
      return;
    }
    setGastos([...gastos, { id: Date.now().toString(), evento: gastoEvento, persona: gastoPersona, item: gastoItem.trim(), monto: mon }]);
    setGastoItem('');
    setGastoMonto('');
    showInterstitialIfReady();
  };

  const eliminarGasto = (id) => {
    setGastos(gastos.filter(g => g.id !== id));
  };

  const calcularBalance = () => {
    if (!personas.length) {
      setBalanceHtml(null);
      setResumenHtml([]);
      setTextoExportar('');
      return;
    }
    let tot = {};
    let tGen = 0;
    personas.forEach(p => tot[p] = 0);
    gastos.forEach(g => {
      if (tot[g.persona] !== undefined) {
        tot[g.persona] += g.monto;
        tGen += g.monto;
      }
    });

    const cuota = tGen / personas.length;

    let resume = personas.map(p => ({
      nombre: p, total: tot[p]
    }));
    setResumenHtml(resume);

    let saldos = personas.map(p => ({ n: p, s: tot[p] - cuota }));
    let d = saldos.filter(s => s.s < -0.01);
    let a = saldos.filter(s => s.s > 0.01);

    let txt = `📊 BALANCE SPLITPAY\nTotal: ${moneda}${tGen.toFixed(2)}\n\n`;
    let transfers = [];

    let i = 0, j = 0;
    while (i < d.length && j < a.length) {
      let m = Math.min(Math.abs(d[i].s), a[j].s);
      transfers.push({ de: d[i].n, para: a[j].n, monto: m });
      txt += `• ${d[i].n} -> ${a[j].n}: ${moneda}${m.toFixed(2)}\n`;

      d[i].s += m;
      a[j].s -= m;
      if (Math.abs(d[i].s) < 0.01) i++;
      if (a[j].s < 0.01) j++;
    }
    setBalanceHtml(transfers);
    setTextoExportar(txt);
  };

  const compartirWhatsApp = async () => {
    if (!textoExportar) return;
    try {
      await Share.share({
        message: textoExportar,
      });
      showInterstitialIfReady();
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Header */}
        <View className="items-center mb-6 mt-2">
          <Text className="text-4xl font-extrabold text-emerald-400 mb-1">SplitPay</Text>
          <Text className="text-gray-400 text-sm">Calculadora de gastos grupales</Text>
          <View className="flex-row items-center mt-3 bg-gray-800 p-2 rounded-lg border border-gray-700">
            <Text className="text-xs text-gray-400 mr-2 font-medium uppercase tracking-wider">Moneda:</Text>
            <TouchableOpacity onPress={() => setMoneda(moneda === 'S/' ? '$' : 'S/')}>
              <Text className="text-emerald-400 font-bold text-sm">{moneda === 'S/' ? 'Soles (S/)' : 'USD ($)'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 1. Participantes y Eventos */}
        <View className="bg-gray-800 rounded-xl p-5 border border-gray-700 shadow-lg mb-6">
          <Text className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-700 pb-2">1. Configuración</Text>

          <Text className="text-xs text-gray-400 mb-1 font-medium">Participantes</Text>
          <View className="flex-row gap-2 mb-2">
            <TextInput
              className="flex-1 bg-gray-700 text-white border border-gray-600 rounded p-2 text-sm"
              placeholder="Ej: Carlos"
              placeholderTextColor="#6b7280"
              value={nuevaPersona}
              onChangeText={setNuevaPersona}
            />
            <TouchableOpacity onPress={agregarPersona} className="bg-blue-600 px-4 py-2 rounded justify-center items-center">
              <Text className="text-white font-bold text-lg">+</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {personas.map(p => (
              <View key={p} className="bg-blue-900/40 border border-blue-800 rounded px-2 py-1 flex-row items-center">
                <Text className="text-blue-300 text-xs font-medium">{p}</Text>
                <TouchableOpacity onPress={() => eliminarPersona(p)} className="ml-2">
                  <Text className="text-red-400 text-xs">✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <Text className="text-xs text-gray-400 mb-1 font-medium">Evento/Categoría</Text>
          <View className="flex-row gap-2 mb-2">
            <TextInput
              className="flex-1 bg-gray-700 text-white border border-gray-600 rounded p-2 text-sm"
              placeholder="Ej: Cena"
              placeholderTextColor="#6b7280"
              value={nuevoEvento}
              onChangeText={setNuevoEvento}
            />
            <TouchableOpacity onPress={agregarEvento} className="bg-emerald-600 px-4 py-2 rounded justify-center items-center">
              <Text className="text-white font-bold text-lg">+</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {eventos.map(e => (
              <View key={e} className="bg-emerald-900/40 border border-emerald-800 rounded px-2 py-1 flex-row items-center">
                <Text className="text-emerald-300 text-xs font-medium">{e}</Text>
                <TouchableOpacity onPress={() => eliminarEvento(e)} className="ml-2">
                  <Text className="text-red-400 text-xs">✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* 2. Registrar Gasto */}
        <View className="bg-gray-800 rounded-xl p-5 border border-gray-700 shadow-lg mb-6">
          <Text className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-700 pb-2">2. Registrar Gasto</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            {eventos.map(e => (
              <TouchableOpacity key={e} onPress={() => setGastoEvento(e)} className={`mr-2 px-3 py-2 rounded border ${gastoEvento === e ? 'bg-emerald-600 border-emerald-500' : 'bg-gray-700 border-gray-600'}`}>
                <Text className="text-white text-xs">{e}</Text>
              </TouchableOpacity>
            ))}
            {eventos.length === 0 && <Text className="text-gray-500 text-xs mt-1">Primero agrega un evento</Text>}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            {personas.map(p => (
              <TouchableOpacity key={p} onPress={() => setGastoPersona(p)} className={`mr-2 px-3 py-2 rounded border ${gastoPersona === p ? 'bg-blue-600 border-blue-500' : 'bg-gray-700 border-gray-600'}`}>
                <Text className="text-white text-xs whitespace-nowrap">{p} pagó</Text>
              </TouchableOpacity>
            ))}
            {personas.length === 0 && <Text className="text-gray-500 text-xs mt-1">Primero agrega un participante</Text>}
          </ScrollView>

          <TextInput
            className="w-full bg-gray-700 text-white border border-gray-600 rounded p-2 text-sm mb-3"
            placeholder="Detalle (ej: Pizza)"
            placeholderTextColor="#6b7280"
            value={gastoItem}
            onChangeText={setGastoItem}
          />
          <View className="flex-row items-center bg-gray-700 border border-gray-600 rounded px-3 mb-4">
            <Text className="text-gray-400 text-sm font-bold mr-2">{moneda}</Text>
            <TextInput
              className="flex-1 text-white py-2 text-sm"
              placeholder="0.00"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
              value={gastoMonto}
              onChangeText={setGastoMonto}
            />
          </View>
          <TouchableOpacity onPress={agregarGasto} className="w-full bg-blue-600 py-3 rounded items-center">
            <Text className="text-white text-sm font-bold">Añadir Gasto</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Historial */}
        <View className="bg-gray-800 rounded-xl p-5 border border-gray-700 shadow-lg mb-6">
          <Text className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-700 pb-2">3. Historial</Text>
          {gastos.length === 0 ? (
            <Text className="text-center text-gray-500 italic py-4 text-xs">No hay registros</Text>
          ) : (
            gastos.map(g => (
              <View key={g.id} className="flex-row justify-between items-center py-2 border-b border-gray-700">
                <View className="flex-1">
                  <Text className="text-gray-300 text-xs">{g.evento}: {g.item}</Text>
                  <Text className="text-blue-400 font-bold text-xs">{g.persona} pagó</Text>
                </View>
                <Text className="text-gray-300 font-mono text-sm mr-4">{moneda}{g.monto.toFixed(2)}</Text>
                <TouchableOpacity onPress={() => eliminarGasto(g.id)}>
                  <Text className="text-red-400 text-lg">✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* 4. Balance Final */}
        <View className="bg-gray-800 rounded-xl p-5 border-l-4 border-emerald-500 shadow-lg mb-6">
          <Text className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-700 pb-2">4. Balance Final</Text>

          <View className="flex-row flex-wrap gap-2 mb-4 justify-between">
            {resumenHtml.map(r => (
              <View key={r.nombre} className="bg-gray-900/60 p-2 rounded border border-gray-700 w-[48%] items-center mb-1">
                <Text className="text-xs font-bold text-gray-400">{r.nombre}</Text>
                <Text className="text-xs text-emerald-400">{moneda}{r.total.toFixed(2)}</Text>
              </View>
            ))}
          </View>

          <View className="p-4 bg-gray-900 rounded-lg border border-gray-700 mb-6">
            {!balanceHtml ? (
              <Text className="text-gray-300 text-xs">Configura participantes y gastos para ver el balance.</Text>
            ) : balanceHtml.length === 0 ? (
              <Text className="text-emerald-400 text-xs text-center font-bold">Cuentas al día. 🎉</Text>
            ) : (
              balanceHtml.map((t, i) => (
                <Text key={i} className="text-xs text-gray-300 mb-2">
                  🔴 <Text className="font-bold text-white">{t.de}</Text> paga a 🟢 <Text className="font-bold text-white">{t.para}</Text>: <Text className="font-mono text-white">{moneda}{t.monto.toFixed(2)}</Text>
                </Text>
              ))
            )}
          </View>

          <TouchableOpacity onPress={compartirWhatsApp} className="w-full bg-[#25D366] py-3 rounded items-center">
            <Text className="text-white text-sm font-bold">Compartir Reporte</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View className="items-center mt-2 mb-10">
          <TouchableOpacity onPress={() => setShowPrivacy(true)} className="p-2">
            <Text className="text-gray-500 text-xs underline">Política de Privacidad</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* FIXED BANNER AD */}
      <View className="absolute bottom-0 w-full items-center bg-gray-900 justify-center h-[60px] border-t border-gray-800">
        <BannerAd
          unitId={adUnitIdBanner}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
        />
      </View>

      {/* PRIVACY POLICY MODAL */}
      <Modal visible={showPrivacy} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-gray-900 p-6">
          <ScrollView>
            <Text className="text-3xl font-bold text-white mb-2 mt-4">Política de Privacidad</Text>
            <Text className="text-emerald-400 mb-6 text-sm">Última actualización: Marzo 2026</Text>

            <Text className="text-xl font-semibold text-emerald-400 mb-2">1. Recopilación de Datos</Text>
            <Text className="text-gray-300 text-sm mb-6 leading-5">SplitPay es una herramienta de cálculo local. Guardamos su configuración de gastos e historial internamente en su dispositivo móvil para preservar la sesión. No solicitamos, recolectamos ni almacenamos datos personales o información bancaria en nuestros servidores.</Text>

            <Text className="text-xl font-semibold text-emerald-400 mb-2">2. Identificadores Móviles</Text>
            <Text className="text-gray-300 text-sm mb-6 leading-5">Al ser una aplicación gratuita, utilizamos Identificadores de Dispositivo Móvil (como AAID en Android o IDFA en iOS) estrictamente para mostrar publicidad a través de Google AdMob. Estos identificadores anónimos ayudan a adaptar los anuncios a sus intereses.</Text>

            <Text className="text-xl font-semibold text-emerald-400 mb-2">3. Proveedores y Analíticas</Text>
            <Text className="text-gray-300 text-sm mb-8 leading-5">La librería de anuncios Google AdMob puede usar la información recabada en su dispositivo de manera automática y anónima con fines de métricas de publicidad.</Text>

            <TouchableOpacity onPress={() => setShowPrivacy(false)} className="bg-gray-800 py-3 rounded-lg items-center border border-gray-700">
              <Text className="text-white font-bold">Cerrar</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}
