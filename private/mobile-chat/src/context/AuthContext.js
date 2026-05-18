// Version: 1.0056
import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '../config';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [phone, setPhone] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaid, setIsPaid] = useState(false);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedPhone = await SecureStore.getItemAsync(STORAGE_KEYS.PHONE);
      const storedToken = await SecureStore.getItemAsync(STORAGE_KEYS.TOKEN);

      if (storedPhone && storedToken) {
        setPhone(storedPhone);
        setToken(storedToken);
        setIsPaid(true);
      }
    } catch (error) {
      console.error('Failed to load auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (phoneNumber, authToken, paid = false) => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.PHONE, phoneNumber);
      if (authToken) {
        await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, authToken);
      }
      setPhone(phoneNumber);
      setToken(authToken);
      setIsPaid(paid);
    } catch (error) {
      console.error('Failed to save auth:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.PHONE);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN);
      setPhone(null);
      setToken(null);
      setIsPaid(false);
    } catch (error) {
      console.error('Failed to logout:', error);
      throw error;
    }
  };

  const updatePaymentStatus = (paid) => {
    setIsPaid(paid);
  };

  return (
    <AuthContext.Provider
      value={{
        phone,
        token,
        isPaid,
        isLoading,
        login,
        logout,
        updatePaymentStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
