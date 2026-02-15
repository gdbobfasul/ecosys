// Version: 1.0056
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useAuth } from '../context/AuthContext';
import ApiService from '../services/api';
import WebSocketService from '../services/websocket';

export default function HomeScreen({ navigation }) {
  const [friends, setFriends] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const { phone, token, logout } = useAuth();

  useEffect(() => {
    loadFriends();
    WebSocketService.connect(token);
    WebSocketService.on('message', handleNewMessage);
    return () => WebSocketService.off('message', handleNewMessage);
  }, []);

  const loadFriends = async () => {
    try {
      const data = await ApiService.getFriends();
      setFriends(data.friends || []);
    } catch (error) {
      console.error('Load friends error:', error);
    }
  };

  const handleNewMessage = (data) => {
    setFriends(prev => prev.map(f => 
      f.phone === data.from ? { ...f, lastMessage: data.text, unread: f.unread + 1 } : f
    ));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFriends();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AMS Chat</Text>
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => navigation.navigate('SearchByDistance')} style={styles.iconButton}>
            <Text style={styles.iconSmall}>🌍</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('SearchByNeed')} style={styles.iconButton}>
            <Text style={styles.iconSmall}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.iconButton}>
            <Text style={styles.iconSmall}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('AddFriend')} style={styles.iconButton}>
            <Text style={styles.icon}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.iconButton}>
            <Text style={styles.icon}>⎋</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={friends}
        keyExtractor={item => item.phone}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.friend} onPress={() => navigation.navigate('Chat', { friendPhone: item.phone })}>
            <View style={styles.friendInfo}>
              <Text style={styles.friendPhone}>{item.phone}</Text>
              <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage || 'New chat'}</Text>
            </View>
            {item.unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{item.unread}</Text></View>}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<View style={styles.empty}><Text>No friends yet. Tap + to add one!</Text></View>}
      />

      <Text style={styles.footer}>🔒 Subscription active • {phone}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#3B82F6', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  actions: { flexDirection: 'row' },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  icon: { fontSize: 20, color: '#FFF', fontWeight: 'bold' },
  iconSmall: { fontSize: 18, color: '#FFF' },
  friend: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  friendInfo: { flex: 1 },
  friendPhone: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  lastMessage: { fontSize: 14, color: '#6B7280' },
  badge: { backgroundColor: '#3B82F6', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  badgeText: { fontSize: 12, fontWeight: 'bold', color: '#FFF' },
  empty: { padding: 48, alignItems: 'center' },
  footer: { padding: 12, textAlign: 'center', fontSize: 12, color: '#6B7280', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
});
