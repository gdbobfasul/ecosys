// Version: 1.0056
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import * as Location from 'expo-location';
import { API_URL } from '../config';

export default function ChatScreen({ route, navigation }) {
  const { contactId, contactName, token, userId } = route.params;
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      const res = await fetch(`${API_URL}/api/messages/${contactId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Load messages error:', err);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim()) return;

    try {
      const res = await fetch(`${API_URL}/api/messages/${contactId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: messageText })
      });

      if (res.ok) {
        setMessages([...messages, { text: messageText, sent: true }]);
        setMessageText('');
      }
    } catch (err) {
      console.error('Send message error:', err);
    }
  };

  const sendLocation = async () => {
    setLoading(true);

    try {
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to send your location');
        setLoading(false);
        return;
      }

      // Get location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      const { latitude, longitude } = location.coords;

      // Get IP address
      let ip = '';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        ip = ipData.ip;
      } catch (e) {
        console.error('IP fetch error:', e);
      }

      // Reverse geocode (GPS → Address)
      let country = '', city = '', village = '', street = '', number = '';
      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude,
          longitude
        });

        if (addresses && addresses.length > 0) {
          const addr = addresses[0];
          country = addr.country || '';
          city = addr.city || '';
          village = addr.district || '';
          street = addr.street || '';
          number = addr.streetNumber || '';
        }
      } catch (e) {
        console.error('Reverse geocode error:', e);
      }

      // Send location to friend
      const res = await fetch(`${API_URL}/api/messages/send-location/${contactId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          latitude,
          longitude,
          country,
          city,
          village,
          street,
          number,
          ip
        })
      });

      if (res.ok) {
        const locationText = `📍 Местоположение:\n` +
          (country ? `Държава: ${country}\n` : '') +
          (city ? `Град: ${city}\n` : '') +
          (village ? `Село: ${village}\n` : '') +
          (street ? `Улица: ${street}\n` : '') +
          (number ? `Номер: ${number}\n` : '') +
          `\nGPS: ${latitude}, ${longitude}\n` +
          (ip ? `IP: ${ip}\n` : '');

        setMessages([...messages, { text: locationText, sent: true }]);
        Alert.alert('Success', 'Location sent!');
      } else {
        Alert.alert('Error', 'Failed to send location');
      }
    } catch (err) {
      console.error('Send location error:', err);
      Alert.alert('Error', 'Failed to get location: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }) => (
    <View style={[
      styles.messageBubble,
      item.sent ? styles.sentMessage : styles.receivedMessage
    ]}>
      <Text style={styles.messageText}>{item.text}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{contactName}</Text>
      </View>

      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item, index) => index.toString()}
        style={styles.messagesList}
        inverted={false}
      />

      <View style={styles.inputContainer}>
        <TouchableOpacity 
          onPress={sendLocation} 
          style={[styles.iconButton, loading && styles.disabledButton]}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.iconButtonText}>📍</Text>
          )}
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type a message..."
          placeholderTextColor="#999"
        />

        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  backButton: {
    color: '#3b82f6',
    fontSize: 16,
    marginRight: 15,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  messagesList: {
    flex: 1,
    padding: 10,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 10,
    marginVertical: 5,
  },
  sentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#3b82f6',
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#374151',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#1f2937',
    borderTopWidth: 1,
    borderTopColor: '#374151',
    alignItems: 'center',
  },
  iconButton: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  disabledButton: {
    backgroundColor: '#6b7280',
  },
  iconButtonText: {
    fontSize: 20,
  },
  input: {
    flex: 1,
    backgroundColor: '#374151',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
