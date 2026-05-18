// Version: 1.0056
import { WS_URL } from '../config';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.token = null;
    this.listeners = {
      message: [],
      sent: [],
      error: [],
      connected: [],
      disconnected: [],
    };
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
  }

  connect(token) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    this.token = token;
    const wsUrl = `${WS_URL}?token=${token}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'message') {
            this.emit('message', data);
          } else if (data.type === 'sent') {
            this.emit('sent', data);
          } else if (data.type === 'error') {
            this.emit('error', data.message);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', 'Connection error');
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.emit('disconnected');
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.emit('error', 'Failed to connect');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.token = null;
    this.reconnectAttempts = 0;
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }

    if (!this.token) {
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnect attempt ${this.reconnectAttempts}...`);

    setTimeout(() => {
      this.connect(this.token);
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  sendMessage(to, text) {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      this.emit('error', 'Not connected');
      return false;
    }

    try {
      this.ws.send(JSON.stringify({
        type: 'message',
        to,
        text,
      }));
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      this.emit('error', 'Failed to send message');
      return false;
    }
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export default new WebSocketService();
