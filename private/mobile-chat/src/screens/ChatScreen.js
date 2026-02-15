// Version: 1.0056
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import ApiService from '../services/api';
import WebSocketService from '../services/websocket';

export default function ChatScreen({ route, navigation }) {
  const { friendPhone } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const flatListRef = useRef();

  useEffect(() => {
    loadMessages();
    WebSocketService.on('message', handleMessage);
    WebSocketService.on('sent', handleSent);
    return () => { WebSocketService.off('message', handleMessage); WebSocketService.off('sent', handleSent); };
  }, []);

  const loadMessages = async () => {
    try {
      const data = await ApiService.getMessages(friendPhone);
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Load messages error:', error);
    }
  };

  const handleMessage = (data) => {
    if (data.from === friendPhone) {
      setMessages(prev => [...prev, { id: data.id, text: data.text, sent: false, timestamp: data.timestamp }]);
    }
  };

  const handleSent = (data) => {
    if (data.to === friendPhone) {
      setMessages(prev => [...prev, { id: data.id, text: data.text, sent: true, timestamp: data.timestamp }]);
    }
  };

  const sendMessage = () => {
    if (!text.trim()) return;
    WebSocketService.sendMessage(friendPhone, text);
    setText('');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>←</Text></TouchableOpacity>
        <Text style={styles.title}>{friendPhone}</Text>
      </View>
      <FlatList ref={flatListRef} data={messages} keyExtractor={item => item.id.toString()} onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        renderItem={({ item }) => (
          <View style={[styles.message, item.sent ? styles.sent : styles.received]}>
            <Text style={item.sent ? styles.sentText : styles.receivedText}>{item.text}</Text>
          </View>
        )} />
      <View style={styles.input}>
        <TextInput style={styles.textInput} placeholder="Message..." value={text} onChangeText={setText} multiline />
        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}><Text style={styles.sendText}>→</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', padding: 16 },
  back: { fontSize: 24, color: '#FFF', marginRight: 12 },
  title: { fontSize: 18, fontWeight: '600', color: '#FFF' },
  message: { maxWidth: '75%', padding: 12, borderRadius: 16, marginHorizontal: 16, marginVertical: 4 },
  sent: { alignSelf: 'flex-end', backgroundColor: '#3B82F6' },
  received: { alignSelf: 'flex-start', backgroundColor: '#FFF' },
  sentText: { color: '#FFF' },
  receivedText: { color: '#111827' },
  input: { flexDirection: 'row', padding: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  textInput: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8 },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  sendText: { fontSize: 20, color: '#FFF', fontWeight: 'bold' },
});
