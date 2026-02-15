// Version: 1.0056
import axios from 'axios';
import { API_URL, ENDPOINTS } from '../config';

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired - handle logout
          console.error('Unauthorized - token expired');
        }
        return Promise.reject(error);
      }
    );
  }

  setAuthToken(token) {
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common['Authorization'];
    }
  }

  // Auth endpoints
  async login(phone, password) {
    const response = await this.client.post(ENDPOINTS.AUTH.LOGIN, { phone, password });
    return response.data;
  }

  async register(userData) {
    const response = await this.client.post(ENDPOINTS.AUTH.REGISTER, userData);
    return response.data;
  }

  async logout() {
    const response = await this.client.post(ENDPOINTS.AUTH.LOGOUT);
    return response.data;
  }

  // Payment endpoints - Stripe
  async getStripeKey() {
    const response = await this.client.get(ENDPOINTS.PAYMENT.STRIPE_KEY);
    return response.data;
  }

  async getPricing() {
    const response = await this.client.get(ENDPOINTS.PAYMENT.PRICING);
    return response.data;
  }

  async createPaymentIntent(phone, paymentType = 'new') {
    const response = await this.client.post(ENDPOINTS.PAYMENT.CREATE_INTENT, { 
      phone,
      paymentType 
    });
    return response.data;
  }

  async confirmPayment(phone, paymentIntentId, paymentType = 'renewal') {
    const response = await this.client.post(ENDPOINTS.PAYMENT.CONFIRM, {
      phone,
      paymentIntentId,
      paymentType,
    });
    return response.data;
  }

  // NEW: Payment endpoints - Crypto
  async confirmCryptoPayment(userId, phone, txHash, walletAddress, amount, tokenAddress) {
    const response = await this.client.post(ENDPOINTS.PAYMENT.CRYPTO_CONFIRM, {
      userId,
      phone,
      txHash,
      walletAddress,
      amount,
      tokenAddress,
    });
    return response.data;
  }

  async checkCryptoPaymentStatus(userId) {
    const response = await this.client.get(`${ENDPOINTS.PAYMENT.CRYPTO_STATUS}/${userId}`);
    return response.data;
  }

  async verifyCryptoPayment(txHash, expectedAmount) {
    const response = await this.client.post(ENDPOINTS.PAYMENT.VERIFY_CRYPTO, {
      txHash,
      expectedAmount,
    });
    return response.data;
  }

  // Friends endpoints
  async getFriends() {
    const response = await this.client.get(ENDPOINTS.FRIENDS.LIST);
    return response.data;
  }

  async addFriend(friendPhone) {
    const response = await this.client.post(ENDPOINTS.FRIENDS.ADD, { friendPhone });
    return response.data;
  }

  async removeFriend(friendId) {
    const response = await this.client.delete(ENDPOINTS.FRIENDS.REMOVE(friendId));
    return response.data;
  }

  // Messages endpoints
  async getMessages(friendPhone) {
    const response = await this.client.get(ENDPOINTS.MESSAGES.GET(friendPhone));
    return response.data;
  }

  async sendMessage(toPhone, message) {
    const response = await this.client.post(ENDPOINTS.MESSAGES.SEND, {
      toPhone,
      message,
    });
    return response.data;
  }

  async markMessagesAsRead(friendPhone) {
    const response = await this.client.post(ENDPOINTS.MESSAGES.MARK_READ, {
      friendPhone,
    });
    return response.data;
  }
}

export default new ApiService();
