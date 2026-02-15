// Version: 1.0056
import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { API_URL } from './src/config';

export default function App() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert('Грешка', 'Въведи телефон и парола');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });

      const data = await response.json();

      if (data.needsRegistration) {
        // User doesn't exist → Show register
        Alert.alert('Регистрация', 'Потребителят не съществува. Моля, регистрирай се.', [
          { text: 'OK', onPress: () => {
            // TODO: Navigate to register screen
          }}
        ]);
      } else if (data.isBlocked) {
        // Blocked
        Alert.alert('Блокиран', 'Акаунтът е блокиран');
      } else if (data.needsPayment) {
        // Not paid
        Alert.alert('Плащане', 'Необходимо е плащане', [
          { text: 'OK', onPress: () => {
            // TODO: Navigate to payment screen
          }}
        ]);
      } else if (data.success) {
        // Success → Login
        setIsLoggedIn(true);
        Alert.alert('Успех', 'Влезе успешно!');
        // TODO: Navigate to chat screen
      } else {
        Alert.alert('Грешка', data.error || 'Грешка при вход');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Грешка', 'Грешка при свързване');
    }
  };

  return (
    <AuthProvider>
      <ScrollView style={styles.container}>
        {/* Marketing Section */}
        <View style={styles.marketing}>
          <Text style={styles.logo}>📱 Анонимен Чат</Text>
          <Text style={styles.price}>€5 / $5 на месец</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✅ Можеш:</Text>
            <Text style={styles.bullet}>📞 Познати: Телефон → чат</Text>
            <Text style={styles.bullet}>💕 Запознанства: Търси по пол/ръст/тегло/държава</Text>
            <Text style={styles.bullet}>📁 Файлове до 100MB (трият се след сваляне)</Text>
            <Text style={styles.bullet}>🔄 История: 5KB (старото се трие)</Text>
          </View>

          <View style={styles.sectionDanger}>
            <Text style={styles.sectionTitleDanger}>❌ НЕ можеш:</Text>
            <Text style={styles.bullet}>🕵️ Търсене по име/град/улица/работа</Text>
            <Text style={styles.bullet}>🔍 "Намери Юлия от О'шипка" - детективско бюро</Text>
            <Text style={styles.bullet}>📝 Дългосрочна история</Text>
          </View>

          <View style={styles.privacy}>
            <Text style={styles.privacyText}>🔒 Без SMS • 📧 Без Email • 🗑️ Файлове се трият</Text>
          </View>
        </View>

        {/* Login Form */}
        <View style={styles.loginContainer}>
          <TextInput
            style={styles.input}
            placeholder="Телефон"
            placeholderTextColor="#999"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Парола"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.btnPrimary} onPress={handleLogin}>
            <Text style={styles.btnText}>Влез</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Плащане с карта чрез Stripe</Text>
          <Text style={styles.footerSmall}>🇪🇺 ЕС: €5/месец | 🌍 Извън ЕС: $5/месец</Text>
        </View>
      </ScrollView>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  marketing: {
    padding: 20,
    paddingTop: 60,
  },
  logo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  price: {
    fontSize: 24,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30,
  },
  section: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
  },
  sectionDanger: {
    backgroundColor: '#7f1d1d',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 10,
  },
  sectionTitleDanger: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ef4444',
    marginBottom: 10,
  },
  bullet: {
    fontSize: 14,
    color: '#d1d5db',
    marginBottom: 8,
    lineHeight: 20,
  },
  privacy: {
    backgroundColor: '#1e3a8a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  privacyText: {
    fontSize: 12,
    color: '#d1d5db',
    textAlign: 'center',
  },
  loginContainer: {
    padding: 20,
  },
  input: {
    backgroundColor: '#374151',
    color: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
  },
  btnPrimary: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    paddingBottom: 40,
  },
  footerText: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 5,
  },
  footerSmall: {
    color: '#6b7280',
    fontSize: 12,
  },
});
