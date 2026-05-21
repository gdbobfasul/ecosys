// Version: 1.0093
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
import Slider from '@react-native-community/slider';
import api from '../services/api';

export default function SearchByDistanceScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [location, setLocation] = useState(null);

  // Search filters
  const [minDistance, setMinDistance] = useState(0);
  const [maxDistance, setMaxDistance] = useState(50);
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [gender, setGender] = useState('');
  const [minHeight, setMinHeight] = useState('');
  const [maxHeight, setMaxHeight] = useState('');

  useEffect(() => {
    getCurrentLocation();
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

  const search = async () => {
    if (!location) {
      Alert.alert('Грешка', 'Моля, разрешете достъп до локация');
      return;
    }

    try {
      setLoading(true);

      const response = await api.post('/search/by-distance', {
        latitude: location.latitude,
        longitude: location.longitude,
        min_distance: minDistance,
        max_distance: maxDistance,
        min_age: minAge ? parseInt(minAge) : undefined,
        max_age: maxAge ? parseInt(maxAge) : undefined,
        gender: gender || undefined,
        min_height: minHeight ? parseInt(minHeight) : undefined,
        max_height: maxHeight ? parseInt(maxHeight) : undefined
      });

      setResults(response.data.results);
      setLoading(false);

      if (response.data.results.length === 0) {
        Alert.alert('Резултати', 'Не са намерени потребители с тези критерии');
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
        <Text style={styles.resultText}>
          👤 {item.gender === 'male' ? 'М' : 'Ж'}, {item.age}г, {item.height_cm}см
        </Text>
        <Text style={styles.resultText}>📍 {item.city}, {item.country}</Text>
        {item.current_need && (
          <Text style={styles.resultNeed}>🔍 Нужда: {item.current_need}</Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.chatButton}
        onPress={() => {
          // Navigate to chat or add friend
          Alert.alert(
            'Действие',
            `Искате ли да добавите ${item.full_name} като контакт?`,
            [
              { text: 'Отказ', style: 'cancel' },
              {
                text: 'Добави',
                onPress: () => {
                  // TODO: Add friend logic
                  Alert.alert('Информация', 'Функцията "Добави контакт" предстои');
                }
              }
            ]
          );
        }}
      >
        <Text style={styles.chatButtonText}>💬 Чат</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🌍 Търсене по разстояние</Text>
      </View>

      <ScrollView style={styles.scrollView}>
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

          {/* Distance Range */}
          <Text style={styles.label}>
            Разстояние: {minDistance} - {maxDistance} км
          </Text>
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>Мин: {minDistance} км</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={40000}
              step={1}
              value={minDistance}
              onValueChange={setMinDistance}
              minimumTrackTintColor="#3B82F6"
              maximumTrackTintColor="#374151"
              thumbTintColor="#3B82F6"
            />
          </View>

          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>Макс: {maxDistance} км</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={40000}
              step={1}
              value={maxDistance}
              onValueChange={setMaxDistance}
              minimumTrackTintColor="#3B82F6"
              maximumTrackTintColor="#374151"
              thumbTintColor="#3B82F6"
            />
          </View>

          {/* Age */}
          <Text style={styles.label}>Възраст</Text>
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
          <Text style={styles.label}>Пол</Text>
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
          <Text style={styles.label}>Ръст (см)</Text>
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

          {/* Search Button */}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={search}
            disabled={loading}
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
              Резултати: {results.length}
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
  filtersContainer: {
    backgroundColor: '#1F2937',
    margin: 16,
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
  sliderContainer: {
    marginBottom: 12
  },
  sliderLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 4
  },
  slider: {
    width: '100%',
    height: 40
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
  picker: {
    backgroundColor: '#374151',
    color: '#FFFFFF'
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
  resultNeed: {
    color: '#FBBF24',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600'
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
