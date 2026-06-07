// Version: 1.0193
// Find Best Price (мобилно) — Търсене: категории + филтри + резултати (публично).
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { CATS, QUALITIES, api } from '../config';
import { t } from '../i18n';

export default function SearchScreen() {
  const [cat, setCat] = useState('');
  const [quality, setQuality] = useState('');
  const [f, setF] = useState({ country: '', city: '', village: '', district: '', materials: '', manufacturer: '', brand: '', price_min: '', price_max: '' });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function doSearch() {
    setLoading(true);
    const params = new URLSearchParams();
    if (cat) params.set('category', cat);
    if (quality) params.set('quality', quality);
    Object.keys(f).forEach((k) => { if (f[k]) params.set(k, f[k]); });
    const r = await api('/search?' + params.toString());
    setResults(r.ok && r.body.results ? r.body.results : []);
    setLoading(false);
  }
  useEffect(() => { doSearch(); }, []);

  const Field = (key, ph) => (
    <TextInput style={s.input} placeholder={ph} placeholderTextColor="#6b7d8c" value={f[key]} onChangeText={(v) => set(key, v)} />
  );

  return (
    <FlatList
      style={s.root}
      data={results}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <View>
          <Text style={s.h2}>{t('cat.title')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catBar} contentContainerStyle={{ paddingHorizontal: 4 }}>
            {CATS.map((c) => (
              <TouchableOpacity key={c.id} style={[s.cat, cat === c.id && s.catOn]} onPress={() => { setCat(cat === c.id ? '' : c.id); }}>
                <Text style={s.catIc}>{c.ic}</Text>
                <Text style={s.catNm}>{t('cat.' + c.id)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.h2}>{t('search.title')}</Text>
          <View style={s.row}>{Field('country', t('search.country'))}{Field('city', t('search.city'))}</View>
          <View style={s.row}>{Field('village', t('search.village'))}{Field('district', t('search.district'))}</View>
          <View style={s.row}>
            <TextInput style={s.input} placeholder={t('search.price_min')} placeholderTextColor="#6b7d8c" keyboardType="numeric" value={f.price_min} onChangeText={(v) => set('price_min', v)} />
            <TextInput style={s.input} placeholder={t('search.price_max')} placeholderTextColor="#6b7d8c" keyboardType="numeric" value={f.price_max} onChangeText={(v) => set('price_max', v)} />
          </View>
          <View style={s.row}>{Field('materials', t('search.materials'))}{Field('manufacturer', t('search.manufacturer'))}</View>
          <View style={s.row}>{Field('brand', t('search.brand'))}<View style={{ flex: 1 }} /></View>

          <Text style={s.lbl}>{t('search.quality')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <TouchableOpacity style={[s.qChip, !quality && s.qChipOn]} onPress={() => setQuality('')}><Text style={s.qTxt}>{t('common.all')}</Text></TouchableOpacity>
            {QUALITIES.map((q) => (
              <TouchableOpacity key={q} style={[s.qChip, quality === q && s.qChipOn]} onPress={() => setQuality(q)}><Text style={s.qTxt}>{t('quality.' + q)}</Text></TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={s.go} onPress={doSearch}><Text style={s.goTxt}>{t('search.btn')}</Text></TouchableOpacity>
          <Text style={s.h2}>{t('search.results')}{loading ? '' : ' (' + results.length + ')'}</Text>
          {loading && <ActivityIndicator color="#2bb673" style={{ margin: 16 }} />}
        </View>
      }
      ListEmptyComponent={!loading ? <Text style={s.empty}>{t('search.none')}</Text> : null}
      renderItem={({ item }) => {
        const loc = [item.country, item.city, item.village, item.district].filter(Boolean).join(', ');
        const meta = [item.brand, item.manufacturer, item.materials, item.quality ? t('quality.' + item.quality) : ''].filter(Boolean).join(' · ');
        return (
          <View style={s.res}>
            <Text style={s.price}>{item.price} {item.currency}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.pname}>{item.name}</Text>
              {!!meta && <Text style={s.meta}>{meta}</Text>}
              <Text style={s.loc}>📍 {loc} — {item.business_name} ({t('biztype.' + item.btype)})</Text>
            </View>
          </View>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f1720', padding: 12 },
  h2: { color: '#e6edf3', fontSize: 15, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  lbl: { color: '#94a6b6', fontSize: 12, marginBottom: 4 },
  catBar: { flexGrow: 0 },
  cat: { backgroundColor: '#16212c', borderWidth: 1, borderColor: '#26323d', borderRadius: 12, padding: 10, marginHorizontal: 4, alignItems: 'center', width: 92 },
  catOn: { borderColor: '#2bb673' },
  catIc: { fontSize: 26 }, catNm: { color: '#e6edf3', fontSize: 11, marginTop: 4, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { flex: 1, backgroundColor: '#0e1822', borderWidth: 1, borderColor: '#26323d', borderRadius: 8, color: '#e6edf3', padding: 10, fontSize: 14 },
  qChip: { backgroundColor: '#16212c', borderWidth: 1, borderColor: '#26323d', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, marginRight: 6 },
  qChipOn: { backgroundColor: '#2bb673', borderColor: '#2bb673' },
  qTxt: { color: '#e6edf3', fontSize: 13 },
  go: { backgroundColor: '#2bb673', borderRadius: 9, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  goTxt: { color: '#04210f', fontWeight: '800', fontSize: 15 },
  res: { backgroundColor: '#16212c', borderWidth: 1, borderColor: '#26323d', borderRadius: 10, padding: 12, marginBottom: 8, flexDirection: 'row', gap: 12, alignItems: 'center' },
  price: { color: '#2bb673', fontSize: 18, fontWeight: '800' },
  pname: { color: '#e6edf3', fontWeight: '600' },
  meta: { color: '#94a6b6', fontSize: 12, marginTop: 2 },
  loc: { color: '#bcd', fontSize: 12, marginTop: 2 },
  empty: { color: '#94a6b6', textAlign: 'center', padding: 18 },
});
