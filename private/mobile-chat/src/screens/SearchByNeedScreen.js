// Version: 1.0056
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import api from '../services/api';

export default function SearchByNeedScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [results, setResults] = useState([]);
  const [location, setLocation] = useState(null);
  const [serviceCategories, setServiceCategories] = useState({});

  // Search filters
  const [needCategory, setNeedCategory] = useState('');
  const [need, setNeed] = useState('');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [gender, setGender] = useState('');
  const [minHeight, setMinHeight] = useState('');
  const [maxHeight, setMaxHeight] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    getCurrentLocation();
    loadServiceCategories();
  }, []);

  const getCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        Alert.alert('Грешка', 'Не може да се получи локация: ' + error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000
      }
    );
  };

  const loadServiceCategories = async () => {
    try {
      const res = await api.get('/profile/service-categories');
      setServiceCategories(res.data.all);
      setLoadingCategories(false);
    } catch (error) {
      console.error('Load categories error:', error);
      setLoadingCategories(false);
    }
  };

  const search = async () => {
    if (!location) {
      Alert.alert('Грешка', 'Моля, разрешете достъп до локация');
      return;
    }

    if (!need) {
      Alert.alert('Грешка', 'Моля, изберете нужда');
      return;
    }

    try {
      setLoading(true);

      const response = await api.post('/search/by-need', {
        latitude: location.latitude,
        longitude: location.longitude,
        need: need,
        min_age: minAge ? parseInt(minAge) : undefined,
        max_age: maxAge ? parseInt(maxAge) : undefined,
        gender: gender || undefined,
        min_height: minHeight ? parseInt(minHeight) : undefined,
        max_height: maxHeight ? parseInt(maxHeight) : undefined,
        city: city || undefined
      });

      setResults(response.data.results);
      setLoading(false);

      if (response.data.results.length === 0) {
        Alert.alert(
          'Резултати',
          `Не са намерени потребители, които предлагат "${need}" в радиус от 50км`
        );
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Грешка', error.response?.data?.error || 'Грешка при търсене');
      setLoading(false);
    }
  };

  const renderResult = ({ item }) => (
    <View style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultName}>{item.full_name}</Text>
        <Text style={styles.resultDistance}>{item.distance_km} км</Text>
      </View>

      <View style={styles.resultDetails}>
        <Text style={styles.resultText}>📞 {item.phone}</Text>
        {item.email && (
          <Text style={styles.resultText}>📧 {item.email}</Text>
        )}
        <Text style={styles.resultText}>
          👤 {item.gender === 'male' ? 'М' : 'Ж'}, {item.age}г, {item.height_cm}см
        </Text>
        <Text style={styles.resultText}>📍 {item.city}, {item.country}</Text>
        
        <View style={styles.offeringsBox}>
          <Text style={styles.offeringsLabel}>💼 Предлага:</Text>
          <Text style={styles.offeringsText}>{item.offerings}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.chatButton}
        onPress={() => {
          Alert.alert(
            'Контакт',
            `Свържете се с ${item.full_name}:\n\nТелефон: ${item.phone}${
              item.email ? `\nEmail: ${item.email}` : ''
            }`,
            [
              { text: 'Затвори', style: 'cancel' },
              {
                text: 'Копирай телефон',
                onPress: () => {
                  // Clipboard copy logic
                  Alert.alert('Копирано', `Телефон: ${item.phone}`);
                }
              }
            ]
          );
        }}
      >
        <Text style={styles.chatButtonText}>📞 Свържи се</Text>
      </TouchableOpacity>
    </View>
  );

  if (loadingCategories) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Зареждане...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🔍 Търсене по нужда</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            ℹ️ Търси хора, които <Text style={styles.infoBold}>ПРЕДЛАГАТ</Text>{' '}
            това, от което <Text style={styles.infoBold}>ИМАШ НУЖДА</Text>
          </Text>
          <Text style={styles.infoText}>
            📍 Максимум 50км радиус
          </Text>
        </View>

        {/* Search Filters */}
        <View style={styles.filtersContainer}>
          <Text style={styles.sectionTitle}>Филтри</Text>

          {/* Location Status */}
          <View style={styles.locationStatus}>
            {location ? (
              <>
                <Text style={styles.locationText}>✅ Локация получена</Text>
                <Text style={styles.locationCoords}>
                  {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.locationTextError}>❌ Локация липсва</Text>
                <TouchableOpacity onPress={getCurrentLocation}>
                  <Text style={styles.retryButton}>Опитай отново</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Need Selection */}
          <Text style={styles.label}>От какво имам нужда?</Text>
          <Picker
            selectedValue={needCategory}
            onValueChange={(value) => {
              setNeedCategory(value);
              setNeed('');
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
                selectedValue={need}
                onValueChange={setNeed}
                style={styles.picker}
              >
                <Picker.Item label="-- Избери --" value="" />
                {serviceCategories[needCategory]?.subcategories.map((sub) => (
                  <Picker.Item key={sub} label={sub} value={sub} />
                ))}
              </Picker>
            </>
          )}

          {/* Age */}
          <Text style={styles.label}>Възраст (опционално)</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.inputHalf]}
              value={minAge}
              onChangeText={setMinAge}
              placeholder="Мин"
              placeholderTextColor="#6B7280"
              keyboardType="number-pad"
            />
            <TextInput
              style={[styles.input, styles.inputHalf]}
              value={maxAge}
              onChangeText={setMaxAge}
              placeholder="Макс"
              placeholderTextColor="#6B7280"
              keyboardType="number-pad"
            />
          </View>

          {/* Gender */}
          <Text style={styles.label}>Пол (опционално)</Text>
          <Picker
            selectedValue={gender}
            onValueChange={setGender}
            style={styles.picker}
          >
            <Picker.Item label="Всички" value="" />
            <Picker.Item label="Мъж" value="male" />
            <Picker.Item label="Жена" value="female" />
          </Picker>

          {/* Height */}
          <Text style={styles.label}>Ръст (опционално)</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.inputHalf]}
              value={minHeight}
              onChangeText={setMinHeight}
              placeholder="Мин"
              placeholderTextColor="#6B7280"
              keyboardType="number-pad"
            />
            <TextInput
              style={[styles.input, styles.inputHalf]}
              value={maxHeight}
              onChangeText={setMaxHeight}
              placeholder="Макс"
              placeholderTextColor="#6B7280"
              keyboardType="number-pad"
            />
          </View>

          {/* City */}
          <Text style={styles.label}>Град (опционално)</Text>
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={setCity}
            placeholder="София"
            placeholderTextColor="#6B7280"
          />

          {/* Search Button */}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={search}
            disabled={loading || !need}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.searchButtonText}>🔍 Търси</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Results */}
        {results.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>
              Резултати: {results.length} (макс 50км)
            </Text>

            <FlatList
              data={results}
              renderItem={renderResult}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>
    </View>
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
  scrollView: {
    flex: 1
  },
  infoBox: {
    backgroundColor: '#1E3A8A',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6'
  },
  infoText: {
    color: '#BFDBFE',
    fontSize: 13,
    marginBottom: 4
  },
  infoBold: {
    fontWeight: 'bold',
    color: '#FFFFFF'
  },
  filtersContainer: {
    backgroundColor: '#1F2937',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 8
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16
  },
  locationStatus: {
    backgroundColor: '#374151',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    alignItems: 'center'
  },
  locationText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600'
  },
  locationTextError: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600'
  },
  locationCoords: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4
  },
  retryButton: {
    color: '#3B82F6',
    fontSize: 14,
    marginTop: 8,
    textDecorationLine: 'underline'
  },
  label: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 8
  },
  picker: {
    backgroundColor: '#374151',
    color: '#FFFFFF'
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  input: {
    backgroundColor: '#374151',
    color: '#FFFFFF',
    borderRadius: 6,
    padding: 12,
    fontSize: 16
  },
  inputHalf: {
    flex: 1
  },
  searchButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 6,
    padding: 16,
    alignItems: 'center',
    marginTop: 24
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold'
  },
  resultsContainer: {
    margin: 16,
    marginTop: 0
  },
  resultsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12
  },
  resultCard: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151'
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  resultName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1
  },
  resultDistance: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600'
  },
  resultDetails: {
    marginBottom: 12
  },
  resultText: {
    color: '#D1D5DB',
    fontSize: 14,
    marginBottom: 4
  },
  offeringsBox: {
    backgroundColor: '#374151',
    padding: 10,
    borderRadius: 6,
    marginTop: 8
  },
  offeringsLabel: {
    color: '#FBBF24',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4
  },
  offeringsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500'
  },
  chatButton: {
    backgroundColor: '#10B981',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center'
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  }
});
