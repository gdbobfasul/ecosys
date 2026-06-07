// Version: 1.0193
// Find Best Price (мобилно) — Въвеждане: вход/регистрация → дефинирай обект → добави продукти.
// Сесията се пази от нативния cookie store на устройството (fetch).
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { BTYPES, CATS, QUALITIES, api } from '../config';
import { t } from '../i18n';

function Chips({ list, value, onPick, label }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
      {list.map((x) => (
        <TouchableOpacity key={x} style={[s.chip, value === x && s.chipOn]} onPress={() => onPick(x)}>
          <Text style={s.chipTxt}>{label(x)}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

export default function AddScreen() {
  const [logged, setLogged] = useState(false);
  const [mode, setMode] = useState('login');
  const [auth, setAuth] = useState({ email: '', password: '', name: '' });
  const [authMsg, setAuthMsg] = useState('');
  const [biz, setBiz] = useState({ btype: 'shop', name: '', country: '', city: '', village: '', district: '', location_exact: '' });
  const [bizMsg, setBizMsg] = useState('');
  const [bizList, setBizList] = useState([]);
  const [prod, setProd] = useState({ business_id: '', category: 'food', name: '', price: '', currency: 'USD', quality: '', materials: '', manufacturer: '', brand: '' });
  const [prodMsg, setProdMsg] = useState('');

  useEffect(() => { api('/me').then((r) => { setLogged(r.ok && !!r.body.user); }); }, []);
  useEffect(() => { if (logged) loadBiz(); }, [logged]);

  async function loadBiz() {
    const r = await api('/business/mine');
    if (r.ok) { setBizList(r.body.businesses || []); if (!prod.business_id && r.body.businesses && r.body.businesses[0]) setProd((p) => ({ ...p, business_id: String(r.body.businesses[0].id) })); }
  }
  async function doAuth() {
    const path = mode === 'login' ? '/login' : '/register';
    const data = mode === 'login' ? { email: auth.email, password: auth.password } : { email: auth.email, password: auth.password, display_name: auth.name };
    const r = await api(path, { method: 'POST', body: JSON.stringify(data) });
    if (r.ok) { setLogged(true); setAuthMsg(''); } else setAuthMsg(r.body.message || 'Error');
  }
  async function saveBiz() {
    const r = await api('/business', { method: 'POST', body: JSON.stringify(biz) });
    if (r.ok) { setBizMsg(t('biz.saved')); setBiz((b) => ({ ...b, name: '', location_exact: '' })); loadBiz(); } else setBizMsg(r.body.message || 'Error');
  }
  async function saveProd() {
    if (!prod.business_id) { setProdMsg(t('biz.define_first')); return; }
    const r = await api('/products', { method: 'POST', body: JSON.stringify(prod) });
    if (r.ok) { setProdMsg(t('prod.saved')); setProd((p) => ({ ...p, name: '', price: '' })); } else setProdMsg(r.body.message || 'Error');
  }

  const In = (obj, setObj, key, ph, kb) => (
    <TextInput style={s.input} placeholder={ph} placeholderTextColor="#6b7d8c" keyboardType={kb || 'default'}
      secureTextEntry={key === 'password'} value={obj[key]} onChangeText={(v) => setObj((o) => ({ ...o, [key]: v }))} />
  );

  if (!logged) {
    return (
      <ScrollView style={s.root} contentContainerStyle={{ padding: 14 }}>
        <View style={s.tabs}>
          <TouchableOpacity style={[s.t, mode === 'login' && s.tOn]} onPress={() => setMode('login')}><Text style={s.tTxt}>{t('common.login')}</Text></TouchableOpacity>
          <TouchableOpacity style={[s.t, mode === 'register' && s.tOn]} onPress={() => setMode('register')}><Text style={s.tTxt}>{t('common.register')}</Text></TouchableOpacity>
        </View>
        {In(auth, setAuth, 'email', 'Email', 'email-address')}
        {In(auth, setAuth, 'password', 'Password')}
        {mode === 'register' && In(auth, setAuth, 'name', t('biz.name'))}
        <TouchableOpacity style={s.go} onPress={doAuth}><Text style={s.goTxt}>{mode === 'login' ? t('common.login') : t('common.register')}</Text></TouchableOpacity>
        {!!authMsg && <Text style={s.err}>{authMsg}</Text>}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 14 }}>
      <Text style={s.h2}>{t('biz.add_prices')}</Text>
      <Text style={s.hint}>{t('biz.define_first')}</Text>
      <Text style={s.lbl}>{t('biz.type')}</Text>
      <Chips list={BTYPES} value={biz.btype} onPick={(x) => setBiz((b) => ({ ...b, btype: x }))} label={(x) => t('biztype.' + x)} />
      {In(biz, setBiz, 'name', t('biz.name'))}
      <View style={s.row}>{In(biz, setBiz, 'country', t('biz.country'))}{In(biz, setBiz, 'city', t('biz.city'))}</View>
      <View style={s.row}>{In(biz, setBiz, 'village', t('biz.village'))}{In(biz, setBiz, 'district', t('biz.district'))}</View>
      {In(biz, setBiz, 'location_exact', t('biz.location_exact'))}
      <TouchableOpacity style={s.go} onPress={saveBiz}><Text style={s.goTxt}>{t('biz.save')}</Text></TouchableOpacity>
      {!!bizMsg && <Text style={s.ok}>{bizMsg}</Text>}
      {bizList.map((b) => <Text key={b.id} style={s.item}>🏢 {b.name} ({t('biztype.' + b.btype)}) — {[b.country, b.city, b.village, b.district].filter(Boolean).join(', ')}</Text>)}

      <Text style={s.h2}>{t('prod.add')}</Text>
      <Text style={s.lbl}>{t('nav.my')}</Text>
      <Chips list={bizList.map((b) => String(b.id))} value={prod.business_id} onPick={(x) => setProd((p) => ({ ...p, business_id: x }))} label={(id) => { const b = bizList.find((x) => String(x.id) === id); return b ? b.name : id; }} />
      <Text style={s.lbl}>{t('prod.category')}</Text>
      <Chips list={CATS.map((c) => c.id)} value={prod.category} onPick={(x) => setProd((p) => ({ ...p, category: x }))} label={(x) => t('cat.' + x)} />
      {In(prod, setProd, 'name', t('prod.name'))}
      <View style={s.row}>{In(prod, setProd, 'price', t('prod.price'), 'numeric')}{In(prod, setProd, 'currency', t('prod.currency'))}</View>
      <Text style={s.lbl}>{t('prod.quality')}</Text>
      <Chips list={QUALITIES} value={prod.quality} onPick={(x) => setProd((p) => ({ ...p, quality: x }))} label={(x) => t('quality.' + x)} />
      <View style={s.row}>{In(prod, setProd, 'materials', t('prod.materials'))}{In(prod, setProd, 'manufacturer', t('prod.manufacturer'))}</View>
      {In(prod, setProd, 'brand', t('prod.brand'))}
      <TouchableOpacity style={s.go} onPress={saveProd}><Text style={s.goTxt}>{t('prod.save')}</Text></TouchableOpacity>
      {!!prodMsg && <Text style={s.ok}>{prodMsg}</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f1720' },
  h2: { color: '#e6edf3', fontSize: 15, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  hint: { color: '#94a6b6', fontSize: 13, marginBottom: 10 },
  lbl: { color: '#94a6b6', fontSize: 12, marginTop: 6, marginBottom: 4 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  t: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#2bb673' },
  tOn: { backgroundColor: '#2bb673' }, tTxt: { color: '#e6edf3', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: '#0e1822', borderWidth: 1, borderColor: '#26323d', borderRadius: 8, color: '#e6edf3', padding: 10, fontSize: 14, marginBottom: 8 },
  chip: { backgroundColor: '#16212c', borderWidth: 1, borderColor: '#26323d', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, marginRight: 6 },
  chipOn: { backgroundColor: '#2bb673', borderColor: '#2bb673' }, chipTxt: { color: '#e6edf3', fontSize: 13 },
  go: { backgroundColor: '#2bb673', borderRadius: 9, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  goTxt: { color: '#04210f', fontWeight: '800', fontSize: 15 },
  ok: { color: '#5fd39a', marginTop: 8 }, err: { color: '#f0883e', marginTop: 8 },
  item: { color: '#cdd', fontSize: 13, paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#26323d' },
});
