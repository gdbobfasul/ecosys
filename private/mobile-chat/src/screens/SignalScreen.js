// Version: 1.0093
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Modal
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Picker } from '@react-native-picker/picker';
import api from '../services/api';

const SIGNAL_TYPES = [
  { label: '-- Избери тип --', value: '' },
  { label: 'Аптека', value: 'Pharmacy' },
  { label: 'Оптика/Изработване на очила', value: 'Optician/Eyewear' },
  { label: 'Компютърен сервиз', value: 'Computer Repair' },
  { label: 'Компютърен магазин', value: 'Computer Store' },
  { label: 'Търговски център/Пазар', value: 'Shopping Center/Market' },
  { label: 'Строителен магазин', value: 'Building Materials Store' },
  { label: 'Строителна борса', value: 'Construction Exchange' },
  { label: 'Козметичен/Фризьорски салон', value: 'Beauty/Hair Salon' },
  { label: 'Масаж', value: 'Massage' },
  { label: 'Сауна', value: 'Sauna' },
  { label: 'Плувен басейн', value: 'Swimming Pool' },
  { label: 'Спортна зала', value: 'Gym' },
  { label: 'Магазин за дрехи', value: 'Clothing Store' },
  { label: 'Магазин за подаръци', value: 'Gift Shop' },
  { label: 'Цветарски магазин', value: 'Flower Shop' },
  { label: 'GSM сервиз', value: 'GSM Repair' },
  { label: 'Сервиз бяла техника', value: 'Appliance Repair' },
  { label: 'Магазин бяла техника', value: 'Appliance Store' },
  { label: 'Бар', value: 'Bar' },
  { label: 'Кафе/Сладкарница', value: 'Coffee/Sweets' },
  { label: 'Бързо хранене', value: 'Fast Food' },
  { label: 'Ресторант', value: 'Hi Class Food' },
  { label: 'Авария', value: 'Accident' },
  { label: 'Човек нуждаещ се от помощ', value: 'Person Needing Help' }
];

export default function SignalScreen({ navigation }) {
  const [canSubmit, setCanSubmit] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [signalType, setSignalType] = useState('');
  const [title, setTitle] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [photo, setPhoto] = useState(null);
  const [location, setLocation] = useState(null);
  const [nearbySignals, setNearbySignals] = useState([]);
  const [showWarningModal, setShowWarningModal] = useState(false);

  useEffect(() => {
    checkEligibility();
    requestPermissions();
    autoGetLocation(); // AUTO-GET LOCATION ON MOUNT
  }, []);

  const autoGetLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude
      });
      
      // CHECK NEARBY SIGNALS
      await checkNearbySignals(loc.coords.latitude, loc.coords.longitude);
      
    } catch (error) {
      console.log('Auto-location error:', error);
    }
  };

  const checkNearbySignals = async (lat, lng) => {
    try {
      const response = await api.get(`/signals/nearby?latitude=${lat}&longitude=${lng}&radius=100&limit=5`);
      if (response.data.objects && response.data.objects.length > 0) {
        setNearbySignals(response.data.objects);
        setShowWarningModal(true); // SHOW MODAL FIRST
      }
    } catch (error) {
      console.log('Error checking nearby signals:', error);
    }
  };

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
    
    if (cameraStatus !== 'granted' || libraryStatus !== 'granted' || locationStatus !== 'granted') {
      Alert.alert('Разрешения', 'Моля, разреши достъп до камерата, галерията и местоположението');
    }
  };

  const checkEligibility = async () => {
    try {
      const response = await api.get('/signals/can-submit');
      setCanSubmit(response.data.canSubmit);
      
      if (!response.data.canSubmit) {
        Alert.alert(
          'Ограничение',
          'Вече си подал сигнал днес. Опитай отново утре!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.error('Error checking eligibility:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (useCamera = false) => {
    try {
      let result;
      
      if (useCamera) {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      }

      if (!result.canceled) {
        setPhoto(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Грешка', 'Не можах да взема снимката');
    }
  };

  const getLocation = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude
      });
      
      Alert.alert('Успех', 'Локацията е заснета!');
    } catch (error) {
      Alert.alert('Грешка', 'Не можах да получа локацията. Моля, провери настройките.');
    }
  };

  const submitSignal = async () => {
    // Validation
    if (!signalType) {
      Alert.alert('Грешка', 'Моля, избери тип на сигнала');
      return;
    }
    
    if (!title.trim()) {
      Alert.alert('Грешка', 'Моля, въведи заглавие');
      return;
    }
    
    if (title.length > 100) {
      Alert.alert('Грешка', 'Заглавието е твърде дълго (макс. 100 символа)');
      return;
    }
    
    if (!photo) {
      Alert.alert('Грешка', 'Моля, добави снимка');
      return;
    }
    
    if (!location) {
      Alert.alert('Грешка', 'Моля, засни локацията си');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('signal_type', signalType);
      formData.append('title', title);
      formData.append('working_hours', workingHours);
      formData.append('latitude', location.latitude.toString());
      formData.append('longitude', location.longitude.toString());
      
      // Add photo
      const filename = photo.uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('photo', {
        uri: Platform.OS === 'ios' ? photo.uri.replace('file://', '') : photo.uri,
        name: filename,
        type: type
      });

      await api.post('/signals/submit', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      Alert.alert(
        'Успех! 🎉',
        'Сигналът е подаден успешно! Ще бъде прегледан от администратор.',
        [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]
      );
    } catch (error) {
      console.error('Error submitting signal:', error);
      Alert.alert('Грешка', error.response?.data?.error || 'Грешка при подаване на сигнал');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  if (!canSubmit) {
    return null;
  }

  const isFormValid = signalType && title.trim() && photo && location;

  return (
    <>
      {/* WARNING MODAL */}
      <Modal
        visible={showWarningModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowWarningModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>⚠️ ВНИМАНИЕ!</Text>
              <Text style={styles.modalWarningTitle}>
                Ако виждате обекта, който искате да декларирате, или имате съмнения че вече е деклариран:
              </Text>
              <View style={styles.modalWarningList}>
                <Text style={styles.modalWarningItem}>• Убедете се, че обекта не е деклариран вече.</Text>
                <Text style={styles.modalWarningItem}>• Проверете декларацията на обекта дали е правилна - може да подадете сигнал и за грешно деклариран обект.</Text>
                <Text style={styles.modalWarningItem}>• ⛔ Повторно деклариране на обект води до загуба от ЕДИН ДЕН използване на услугите на чата!</Text>
                <Text style={styles.modalWarningItem}>• За целта можете да направите отделно търсене в района, в който се намирате, за да се убедите, че обекта, който искате да декларирате, го няма все още в нашата база данни.</Text>
              </View>
              
              <View style={styles.modalSearchLinks}>
                <Text style={styles.modalSearchTitle}>🔍 Провери дали обектът съществува:</Text>
                <TouchableOpacity 
                  style={styles.modalSearchButton}
                  onPress={() => {
                    setShowWarningModal(false);
                    navigation.navigate('SearchByDistance');
                  }}
                >
                  <Text style={styles.modalSearchButtonText}>📍 Търсене по разстояние</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalSearchButton}
                  onPress={() => {
                    setShowWarningModal(false);
                    navigation.navigate('SearchByNeed');
                  }}
                >
                  <Text style={styles.modalSearchButtonText}>🔎 Търсене по нужда</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowWarningModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Затвори</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🚨 Подай сигнал</Text>
        <Text style={styles.subtitle}>
          Помогни на общността! След одобрение получаваш 1 безплатен ден.
        </Text>
      </View>

      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          ⚠️ Можеш да подадеш само <Text style={styles.bold}>един сигнал на ден</Text>
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Тип на сигнала *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={signalType}
            onValueChange={setSignalType}
            style={styles.picker}
          >
            {SIGNAL_TYPES.map(type => (
              <Picker.Item key={type.value} label={type.label} value={type.value} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Заглавие/Име на обекта * (макс. 100)</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          placeholder="напр. Аптека 'Здраве'"
        />
        <Text style={styles.charCount}>{title.length}/100</Text>

        <Text style={styles.label}>Работно време (макс. 50)</Text>
        <TextInput
          style={styles.input}
          value={workingHours}
          onChangeText={setWorkingHours}
          maxLength={50}
          placeholder="напр. Денонощно, 09:00-18:00"
        />
        <Text style={styles.charCount}>{workingHours.length}/50</Text>

        <Text style={styles.label}>Снимка *</Text>
        <View style={styles.photoButtons}>
          <TouchableOpacity
            style={styles.photoButton}
            onPress={() => pickImage(true)}
          >
            <Text style={styles.photoButtonText}>📷 Камера</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.photoButton}
            onPress={() => pickImage(false)}
          >
            <Text style={styles.photoButtonText}>🖼️ Галерия</Text>
          </TouchableOpacity>
        </View>
        
        {photo && (
          <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
        )}

        <Text style={styles.label}>Местоположение *</Text>
        <TouchableOpacity
          style={[styles.button, location && styles.buttonSuccess]}
          onPress={getLocation}
        >
          <Text style={styles.buttonText}>
            {location ? '✅ Локацията е заснета' : '📍 Вземи текущата ми локация'}
          </Text>
        </TouchableOpacity>
        
        {location && (
          <Text style={styles.locationText}>
            Координати: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </Text>
        )}

        <TouchableOpacity
          style={[
            styles.submitButton,
            !isFormValid && styles.submitButtonDisabled,
            submitting && styles.submitButtonDisabled
          ]}
          onPress={submitSignal}
          disabled={!isFormValid || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitButtonText}>
              Подай сигнал
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>Отказ</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    padding: 20,
    backgroundColor: 'white'
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    padding: 15,
    margin: 20,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107'
  },
  warningText: {
    fontSize: 14,
    color: '#856404'
  },
  bold: {
    fontWeight: 'bold'
  },
  form: {
    padding: 20
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 15
  },
  pickerContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0'
  },
  picker: {
    height: 50
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    fontSize: 16
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#999',
    marginTop: 5
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 10
  },
  photoButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center'
  },
  photoButtonText: {
    fontSize: 16,
    fontWeight: '600'
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 15
  },
  button: {
    backgroundColor: '#2196f3',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center'
  },
  buttonSuccess: {
    backgroundColor: '#4caf50'
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    marginTop: 10,
    fontFamily: 'monospace'
  },
  submitButton: {
    backgroundColor: '#667eea',
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 30
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc'
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold'
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600'
  },
  nearbyContainer: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
    padding: 15,
    margin: 20,
    borderRadius: 10
  },
  nearbyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 15
  },
  nearbyItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ffc107',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10
  },
  nearbyPhoto: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 10
  },
  nearbyPhotoPlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  nearbyPhotoIcon: {
    fontSize: 40
  },
  nearbyInfo: {
    flex: 1
  },
  nearbyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333'
  },
  nearbyType: {
    fontSize: 14,
    color: '#666',
    marginTop: 2
  },
  nearbyHours: {
    fontSize: 13,
    color: '#666',
    marginTop: 3
  },
  nearbyCoords: {
    fontSize: 11,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 3
  },
  nearbyDistance: {
    fontSize: 14,
    color: '#ff6b6b',
    fontWeight: 'bold',
    marginTop: 5
  },
  warningRed: {
    backgroundColor: '#dc3545',
    padding: 15,
    borderRadius: 8,
    marginTop: 15
  },
  warningRedTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 10
  },
  warningRedText: {
    color: 'white',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    maxHeight: '80%'
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 20
  },
  modalWarningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15
  },
  modalWarningList: {
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20
  },
  modalWarningItem: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 22,
    marginBottom: 10
  },
  modalSearchLinks: {
    backgroundColor: '#e7f3ff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20
  },
  modalSearchTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15
  },
  modalSearchButton: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10
  },
  modalSearchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  modalCloseButton: {
    backgroundColor: '#dc3545',
    padding: 15,
    borderRadius: 10,
    marginTop: 10
  },
  modalCloseButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center'
  }
});
