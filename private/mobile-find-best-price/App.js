// Version: 1.0193
// Find Best Price per Country — мобилно приложение (Expo). Табове: Търсене / Въвеждане.
import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { loadLang, t, SUPPORTED, lang as curLang } from './src/i18n';
import SearchScreen from './src/screens/SearchScreen';
import AddScreen from './src/screens/AddScreen';

export default function App() {
  const [tab, setTab] = useState('search');
  const [lang, setLang] = useState('en');
  const [ready, setReady] = useState(false);
  const [showLangs, setShowLangs] = useState(false);

  useEffect(() => {
    let alive = true;
    setReady(false);
    loadLang(lang).then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [lang]);

  return (
    <SafeAreaView style={st.root}>
      <StatusBar barStyle="light-content" />
      <View style={st.header}>
        <Text style={st.title} numberOfLines={1}>{t('app.title')}</Text>
        <TouchableOpacity onPress={() => setShowLangs(!showLangs)} style={st.langBtn}>
          <Text style={st.langBtnTxt}>🌐 {lang}</Text>
        </TouchableOpacity>
      </View>

      {showLangs && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.langBar} contentContainerStyle={{ paddingHorizontal: 8 }}>
          {SUPPORTED.map((l) => (
            <TouchableOpacity key={l.code} style={[st.langChip, l.code === lang && st.langChipOn]} onPress={() => { setShowLangs(false); setLang(l.code); }}>
              <Text style={st.langChipTxt}>{l.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={{ flex: 1 }}>
        {!ready ? (
          <View style={st.center}><ActivityIndicator size="large" color="#2bb673" /><Text style={st.loading}>{t('common.loading')}</Text></View>
        ) : tab === 'search' ? <SearchScreen langKey={lang} /> : <AddScreen langKey={lang} />}
      </View>

      <View style={st.tabs}>
        <TouchableOpacity style={[st.tab, tab === 'search' && st.tabOn]} onPress={() => setTab('search')}>
          <Text style={[st.tabTxt, tab === 'search' && st.tabTxtOn]}>🔎 {t('search.title')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[st.tab, tab === 'add' && st.tabOn]} onPress={() => setTab('add')}>
          <Text style={[st.tabTxt, tab === 'add' && st.tabTxtOn]}>➕ {t('nav.add')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f1720' },
  header: { backgroundColor: '#11806a', paddingTop: 14, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 },
  langBtn: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  langBtnTxt: { color: '#fff', fontWeight: '600' },
  langBar: { backgroundColor: '#0d2a3a', paddingVertical: 8, maxHeight: 50, flexGrow: 0 },
  langChip: { backgroundColor: '#16303f', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, marginHorizontal: 4 },
  langChipOn: { backgroundColor: '#2bb673' },
  langChipTxt: { color: '#e6edf3', fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { color: '#94a6b6', marginTop: 10 },
  tabs: { flexDirection: 'row', backgroundColor: '#16212c', borderTopWidth: 1, borderTopColor: '#26323d' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabOn: { borderTopWidth: 2, borderTopColor: '#2bb673' },
  tabTxt: { color: '#94a6b6', fontWeight: '600' },
  tabTxtOn: { color: '#2bb673' },
});
