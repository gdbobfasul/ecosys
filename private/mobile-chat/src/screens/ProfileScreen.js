// Version: 1.0093
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import api from '../services/api';

export default function ProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [serviceCategories, setServiceCategories] = useState({});
  const [helpAvailability, setHelpAvailability] = useState(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [codeWord, setCodeWord] = useState('');
  const [hidePhone, setHidePhone] = useState(false);
  const [hideNames, setHideNames] = useState(false);

  // Need state
  const [needCategory, setNeedCategory] = useState('');
  const [needSubcategory, setNeedSubcategory] = useState('');

  // Offerings state
  const [offering1Category, setOffering1Category] = useState('');
  const [offering1, setOffering1] = useState('');
  const [offering2Category, setOffering2Category] = useState('');
  const [offering2, setOffering2] = useState('');
  const [offering3Category, setOffering3Category] = useState('');
  const [offering3, setOffering3] = useState('');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load profile
      const profileRes = await api.get('/profile');
      setProfile(profileRes.data);
      
      // Fill form
      setFullName(profileRes.data.full_name || '');
      setPhone(profileRes.data.phone || '');
      setBirthDate(profileRes.data.birth_date || '');
      setCity(profileRes.data.city || '');
      setEmail(profileRes.data.email || '');
      setCodeWord(profileRes.data.code_word || '');
      setHidePhone(profileRes.data.hide_phone === 1);
      setHideNames(profileRes.data.hide_names === 1);

      // Load service categories
      const categoriesRes = await api.get('/profile/service-categories');
      setServiceCategories(categoriesRes.data.all);

      // Load help button availability
      const helpRes = await api.get('/help/availability');
      setHelpAvailability(helpRes.data);

      setLoading(false);
    } catch (error) {
      console.error('Load profile error:', error);
      Alert.alert('Грешка', 'Не може да се зареди профила');
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    try {
      await api.put('/profile', {
        full_name: fullName,
        phone,
        birth_date: birthDate,
        city
      });
      Alert.alert('Успех', 'Профилът е обновен');
      loadData();
    } catch (error) {
      Alert.alert('Грешка', error.response?.data?.error || 'Не може да се обнови профила');
    }
  };

  const updatePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Грешка', 'Попълнете и двете полета');
      return;
    }

    try {
      await api.put('/profile/password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      Alert.alert('Успех', 'Паролата е сменена');
      setCurrentPassword('');
      setNewPassword('');
    } catch (error) {
      Alert.alert('Грешка', error.response?.data?.error || 'Грешка при смяна на парола');
    }
  };

  const updateCodeWord = async () => {
    if (!codeWord || codeWord.length < 3) {
      Alert.alert('Грешка', 'Кодовата дума трябва да е поне 3 символа');
      return;
    }

    try {
      await api.put('/profile/code-word', { code_word: codeWord });
      Alert.alert('Успех', 'Кодовата дума е обновена');
    } catch (error) {
      Alert.alert('Грешка', 'Не може да се обнови кодовата дума');
    }
  };

  const updateEmail = async () => {
    try {
      await api.put('/profile/email', { email });
      Alert.alert('Успех', 'Email-ът е обновен');
    } catch (error) {
      Alert.alert('Грешка', 'Не може да се обнови email');
    }
  };

  const toggleHidePhone = async (value) => {
    setHidePhone(value);
    try {
      await api.put('/profile/hide-phone', { hide_phone: value });
    } catch (error) {
      setHidePhone(!value);
      Alert.alert('Грешка', 'Не може да се обнови настройката');
    }
  };

  const toggleHideNames = async (value) => {
    setHideNames(value);
    try {
      await api.put('/profile/hide-names', { hide_names: value });
    } catch (error) {
      setHideNames(!value);
      Alert.alert('Грешка', 'Не може да се обнови настройката');
    }
  };

  const updateNeed = async () => {
    try {
      await api.put('/profile/need', { current_need: needSubcategory });
      Alert.alert('Успех', 'Нуждата е обновена');
    } catch (error) {
      Alert.alert('Грешка', 'Не може да се обнови нуждата');
    }
  };

  const updateOfferings = async () => {
    if (profile?.is_verified === 1) {
      Alert.alert('Заключено', 'Вашият профил е верифициран. Полето е заключено.\n\nЗа промени: admin@amschat.com');
      return;
    }

    const offerings = [offering1, offering2, offering3]
      .filter(Boolean)
      .join(',');

    try {
      await api.put('/profile/offerings', { offerings });
      Alert.alert('Успех', 'Предлаганията са обновени');
    } catch (error) {
      Alert.alert('Грешка', error.response?.data?.error || 'Не може да се обновят предлаганията');
    }
  };

  const sendEmergencyHelp = async () => {
    Alert.alert(
      '⚠️ ВНИМАНИЕ',
      `Това ще изпрати вашата точна локация до администратора и ще ви струва ${helpAvailability?.charge?.currency} ${helpAvailability?.charge?.amount} (15 дни от абонамента).\n\nПродължавате?`,
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Изпрати',
          style: 'destructive',
          onPress: async () => {
            try {
              // Get GPS location
              const { coords } = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  enableHighAccuracy: true,
                  timeout: 10000
                });
              });

              const res = await api.post('/help/emergency', {
                latitude: coords.latitude,
                longitude: coords.longitude
              });

              Alert.alert(
                'Успех',
                `Спешна помощ изпратена!\n\nАдминистраторът е уведомен.\n\nID: ${res.data.request_id}`
              );

              loadData();
            } catch (error) {
              Alert.alert('Грешка', error.response?.data?.error || 'Не може да се изпрати помощ');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Зареждане...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>⚙️ Настройки</Text>
      </View>

      {/* Basic Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👤 Основна информация</Text>
        <Text style={styles.limitInfo}>
          Редакции: {profile?.profile_edits_this_month || 0}/1 този месец
        </Text>

        <Text style={styles.label}>Пълно име</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Иван Петров"
          placeholderTextColor="#6B7280"
        />

        <Text style={styles.label}>Телефон (международен формат)</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+359888123456"
          placeholderTextColor="#6B7280}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Дата на раждане</Text>
        <TextInput
          style={styles.input}
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder="1990-05-15"
          placeholderTextColor="#6B7280"
        />

        <Text style={styles.label}>Град</Text>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder="София"
          placeholderTextColor="#6B7280"
        />

        <TouchableOpacity style={styles.button} onPress={updateProfile}>
          <Text style={styles.buttonText}>Запази промени (1 път/месец)</Text>
        </TouchableOpacity>
      </View>

      {/* Privacy */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔒 Поверителност</Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Скрий телефонен номер</Text>
          <Switch
            value={hidePhone}
            onValueChange={toggleHidePhone}
            trackColor={{ false: '#374151', true: '#3B82F6' }}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Скрий имена</Text>
          <Switch
            value={hideNames}
            onValueChange={toggleHideNames}
            trackColor={{ false: '#374151', true: '#3B82F6' }}
          />
        </View>
      </View>

      {/* Security */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔐 Сигурност</Text>

        <Text style={styles.label}>Кодова дума</Text>
        <Text style={styles.hint}>
          Други потребители трябва да знаят тази дума за да те намерят точно
        </Text>
        <TextInput
          style={styles.input}
          value={codeWord}
          onChangeText={setCodeWord}
          placeholder="secret123"
          placeholderTextColor="#6B7280"
        />
        <TouchableOpacity style={styles.buttonSecondary} onPress={updateCodeWord}>
          <Text style={styles.buttonText}>Обнови кодова дума</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.label}>Email адрес</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="ivan@example.com"
          placeholderTextColor="#6B7280"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.buttonSecondary} onPress={updateEmail}>
          <Text style={styles.buttonText}>Обнови email</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.label}>Текуща парола</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="••••••••"
          placeholderTextColor="#6B7280"
          secureTextEntry
        />

        <Text style={styles.label}>Нова парола</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="••••••••"
          placeholderTextColor="#6B7280"
          secureTextEntry
        />

        <TouchableOpacity style={styles.buttonSecondary} onPress={updatePassword}>
          <Text style={styles.buttonText}>Смени парола</Text>
        </TouchableOpacity>
      </View>

      {/* Current Need */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔍 Текуща нужда</Text>

        <Text style={styles.label}>Категория</Text>
        <Picker
          selectedValue={needCategory}
          onValueChange={(value) => {
            setNeedCategory(value);
            setNeedSubcategory('');
          }}
          style={styles.picker}
        >
          <Picker.Item label="-- Избери категория --" value="" />
          {Object.keys(serviceCategories).map((key) => (
            <Picker.Item
              key={key}
              label={serviceCategories[key].label}
              value={key}
            />
          ))}
        </Picker>

        {needCategory && (
          <>
            <Text style={styles.label}>Точна нужда</Text>
            <Picker
              selectedValue={needSubcategory}
              onValueChange={setNeedSubcategory}
              style={styles.picker}
            >
              <Picker.Item label="-- Избери --" value="" />
              {serviceCategories[needCategory]?.subcategories.map((sub) => (
                <Picker.Item key={sub} label={sub} value={sub} />
              ))}
            </Picker>
          </>
        )}

        <TouchableOpacity style={styles.button} onPress={updateNeed}>
          <Text style={styles.buttonText}>Обнови нужда</Text>
        </TouchableOpacity>
      </View>

      {/* Offerings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💼 Какво предлагам (макс 3)</Text>

        {profile?.is_verified === 1 ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              🔒 Вашият профил е верифициран. Полето е заключено.
            </Text>
            <Text style={styles.warningSubtext}>
              За промени: admin@amschat.com
            </Text>
          </View>
        ) : (
          <>
            {/* Offering 1 */}
            <Text style={styles.label}>Услуга 1</Text>
            <Picker
              selectedValue={offering1Category}
              onValueChange={(value) => {
                setOffering1Category(value);
                setOffering1('');
              }}
              style={styles.picker}
            >
              <Picker.Item label="-- Избери категория --" value="" />
              {Object.keys(serviceCategories)
                .filter((key) => key !== 'EMERGENCY')
                .map((key) => (
                  <Picker.Item
                    key={key}
                    label={serviceCategories[key].label}
                    value={key}
                  />
                ))}
            </Picker>

            {offering1Category && (
              <Picker
                selectedValue={offering1}
                onValueChange={setOffering1}
                style={styles.picker}
              >
                <Picker.Item label="-- Избери услуга --" value="" />
                {serviceCategories[offering1Category]?.subcategories.map((sub) => (
                  <Picker.Item key={sub} label={sub} value={sub} />
                ))}
              </Picker>
            )}

            {/* Offering 2 */}
            <Text style={styles.label}>Услуга 2 (опционално)</Text>
            <Picker
              selectedValue={offering2Category}
              onValueChange={(value) => {
                setOffering2Category(value);
                setOffering2('');
              }}
              style={styles.picker}
            >
              <Picker.Item label="-- Избери категория --" value="" />
              {Object.keys(serviceCategories)
                .filter((key) => key !== 'EMERGENCY')
                .map((key) => (
                  <Picker.Item
                    key={key}
                    label={serviceCategories[key].label}
                    value={key}
                  />
                ))}
            </Picker>

            {offering2Category && (
              <Picker
                selectedValue={offering2}
                onValueChange={setOffering2}
                style={styles.picker}
              >
                <Picker.Item label="-- Избери услуга --" value="" />
                {serviceCategories[offering2Category]?.subcategories.map((sub) => (
                  <Picker.Item key={sub} label={sub} value={sub} />
                ))}
              </Picker>
            )}

            {/* Offering 3 */}
            <Text style={styles.label}>Услуга 3 (опционално)</Text>
            <Picker
              selectedValue={offering3Category}
              onValueChange={(value) => {
                setOffering3Category(value);
                setOffering3('');
              }}
              style={styles.picker}
            >
              <Picker.Item label="-- Избери категория --" value="" />
              {Object.keys(serviceCategories)
                .filter((key) => key !== 'EMERGENCY')
                .map((key) => (
                  <Picker.Item
                    key={key}
                    label={serviceCategories[key].label}
                    value={key}
                  />
                ))}
            </Picker>

            {offering3Category && (
              <Picker
                selectedValue={offering3}
                onValueChange={setOffering3}
                style={styles.picker}
              >
                <Picker.Item label="-- Избери услуга --" value="" />
                {serviceCategories[offering3Category]?.subcategories.map((sub) => (
                  <Picker.Item key={sub} label={sub} value={sub} />
                ))}
              </Picker>
            )}

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                ℹ️ За спешни услуги (Доктор, Болница, Бърза помощ, Полиция) изпрати
                документи на: admin@amschat.com
              </Text>
            </View>

            <TouchableOpacity style={styles.button} onPress={updateOfferings}>
              <Text style={styles.buttonText}>Запази предлагания</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Subscription */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💳 Абонамент</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Статус:</Text>
          <Text
            style={[
              styles.infoValue,
              profile?.paid_until > new Date().toISOString()
                ? styles.textGreen
                : styles.textRed
            ]}
          >
            {profile?.paid_until > new Date().toISOString() ? '✅ Активен' : '❌ Изтекъл'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Валиден до:</Text>
          <Text style={styles.infoValue}>
            {new Date(profile?.paid_until).toLocaleDateString('bg-BG')}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.buttonSuccess}
          onPress={() => navigation.navigate('Payment')}
        >
          <Text style={styles.buttonText}>💰 Плати абонамент</Text>
        </TouchableOpacity>
      </View>

      {/* Emergency Help */}
      <View style={[styles.section, styles.dangerSection]}>
        <Text style={styles.sectionTitle}>🆘 Спешна помощ</Text>

        <Text style={styles.helpInfo}>
          Бутонът изпраща вашата точна локация до администратора.
        </Text>
        <Text style={styles.helpInfo}>
          <Text style={styles.helpBold}>Цена:</Text>{' '}
          {helpAvailability?.charge?.currency} {helpAvailability?.charge?.amount}
        </Text>
        <Text style={styles.helpInfo}>
          <Text style={styles.helpBold}>Ефект:</Text> Отнема 15 дни от абонамента
        </Text>
        <Text style={styles.helpInfo}>
          <Text style={styles.helpBold}>Лимит:</Text> 1 използване на месец
        </Text>

        <TouchableOpacity
          style={[
            styles.buttonDanger,
            !helpAvailability?.available && styles.buttonDisabled
          ]}
          onPress={sendEmergencyHelp}
          disabled={!helpAvailability?.available}
        >
          <Text style={styles.buttonTextLarge}>🚨 ИЗПРАТИ СПЕШНА ПОМОЩ</Text>
        </TouchableOpacity>

        <Text style={styles.helpUsage}>
          {!helpAvailability?.has_subscription
            ? 'Нямате активен абонамент'
            : helpAvailability?.uses_this_month >= 1
            ? `Използван ${helpAvailability?.uses_this_month}×/1 този месец`
            : `Остават: ${helpAvailability?.remaining_uses} използвания`}
        </Text>
      </View>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827'
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 16,
    fontSize: 16
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151'
  },
  backButton: {
    color: '#3B82F6',
    fontSize: 16,
    marginRight: 16
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold'
  },
  section: {
    backgroundColor: '#1F2937',
    margin: 16,
    padding: 16,
    borderRadius: 8
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12
  },
  limitInfo: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 12
  },
  label: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 4
  },
  hint: {
    color: '#6B7280',
    fontSize: 12,
    marginBottom: 8
  },
  input: {
    backgroundColor: '#374151',
    color: '#FFFFFF',
    borderRadius: 6,
    padding: 12,
    fontSize: 16
  },
  picker: {
    backgroundColor: '#374151',
    color: '#FFFFFF',
    marginVertical: 8
  },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 6,
    padding: 14,
    alignItems: 'center',
    marginTop: 16
  },
  buttonSecondary: {
    backgroundColor: '#10B981',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    marginTop: 8
  },
  buttonSuccess: {
    backgroundColor: '#10B981',
    borderRadius: 6,
    padding: 14,
    alignItems: 'center',
    marginTop: 16
  },
  buttonDanger: {
    backgroundColor: '#DC2626',
    borderRadius: 6,
    padding: 16,
    alignItems: 'center',
    marginTop: 16
  },
  buttonDisabled: {
    backgroundColor: '#4B5563',
    opacity: 0.5
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  },
  buttonTextLarge: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold'
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12
  },
  switchLabel: {
    color: '#FFFFFF',
    fontSize: 16
  },
  divider: {
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 16
  },
  warningBox: {
    backgroundColor: '#92400E',
    borderWidth: 1,
    borderColor: '#D97706',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16
  },
  warningText: {
    color: '#FCD34D',
    fontSize: 14,
    fontWeight: '600'
  },
  warningSubtext: {
    color: '#FDE68A',
    fontSize: 12,
    marginTop: 4
  },
  infoBox: {
    backgroundColor: '#1E3A8A',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 6,
    padding: 12,
    marginTop: 16
  },
  infoText: {
    color: '#BFDBFE',
    fontSize: 12
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8
  },
  infoLabel: {
    color: '#9CA3AF',
    fontSize: 14
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600'
  },
  textGreen: {
    color: '#10B981'
  },
  textRed: {
    color: '#EF4444'
  },
  dangerSection: {
    backgroundColor: '#7F1D1D',
    borderWidth: 1,
    borderColor: '#DC2626'
  },
  helpInfo: {
    color: '#FECACA',
    fontSize: 13,
    marginBottom: 6
  },
  helpBold: {
    fontWeight: 'bold'
  },
  helpUsage: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8
  }
});
