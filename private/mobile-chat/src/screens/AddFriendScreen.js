// Version: 1.0056
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import ApiService from '../services/api';

export default function AddFriendScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAdd = async () => {
    if (phone.length < 10) {
      Toast.show({ type: 'error', text1: 'Invalid', text2: 'Enter valid phone number' });
      return;
    }

    setIsLoading(true);
    try {
      await ApiService.addFriend(phone);
      Toast.show({ type: 'success', text1: 'Success!', text2: 'Friend added' });
      setTimeout(() => navigation.goBack(), 1000);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.error || 'Failed to add friend' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>←</Text></TouchableOpacity>
        <Text style={styles.title}>Add Friend</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Friend's Phone Number</Text>
        <TextInput style={styles.input} placeholder="+359 888 999 000" keyboardType="phone-pad" value={phone} onChangeText={setPhone} editable={!isLoading} />
        
        <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleAdd} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Add Friend</Text>}
        </TouchableOpacity>

        <View style={styles.info}>
          <Text style={styles.infoText}>Note: You can only add users with active subscriptions.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', padding: 16 },
  back: { fontSize: 24, color: '#FFF', marginRight: 12 },
  title: { fontSize: 20, fontWeight: '600', color: '#FFF' },
  form: { padding: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#FFF', borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16 },
  button: { backgroundColor: '#3B82F6', height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  info: { marginTop: 16, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 16 },
  infoText: { fontSize: 14, color: '#1F2937' },
});
