// Version: 1.0139
// Плащане в приложението — САМО с карта (Stripe). Без крипто (стандарти за магазините).
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { CardField, useStripe } from '@stripe/stripe-react-native';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';
import ApiService from '../services/api';

export default function PaymentScreen({ navigation }) {
  const [isLoading, setIsLoading] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const { confirmPayment } = useStripe();

  // Auth
  const { phone, login, updatePaymentStatus } = useAuth();

  const handleCardPayment = async () => {
    if (!cardComplete) {
      Toast.show({ type: 'error', text1: 'Incomplete', text2: 'Please fill card details' });
      return;
    }

    setIsLoading(true);
    try {
      const { clientSecret, paymentIntentId } = await ApiService.createPaymentIntent(phone);
      const { error, paymentIntent } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
      });

      if (error) {
        Toast.show({ type: 'error', text1: 'Payment Failed', text2: error.message });
      } else if (paymentIntent.status === 'Succeeded') {
        const response = await ApiService.confirmPayment(phone, paymentIntentId);
        await login(phone, response.token, true);
        ApiService.setAuthToken(response.token);
        updatePaymentStatus(true);

        Toast.show({ type: 'success', text1: 'Success!', text2: 'Welcome to AMS Chat' });
        setTimeout(() => navigation.replace('Home'), 1500);
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const renderCardPayment = () => (
    <View style={styles.card}>
      <Text style={styles.label}>Card Details</Text>
      <CardField
        postalCodeEnabled={false}
        style={styles.cardField}
        onCardChange={(details) => setCardComplete(details.complete)}
      />

      <TouchableOpacity
        style={[styles.button, (!cardComplete || isLoading) && styles.buttonDisabled]}
        onPress={handleCardPayment}
        disabled={!cardComplete || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>Pay €5 / $5</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.info}>Protected by Stripe • Test: 4242 4242 4242 4242</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Monthly Subscription</Text>
        <Text style={styles.subtitle}>Pay by card</Text>
      </View>

      {renderCardPayment()}

      <View style={styles.features}>
        <Text style={styles.featuresTitle}>What you get:</Text>
        <Text style={styles.feature}>✓ Anonymous chat</Text>
        <Text style={styles.feature}>✓ 1 month access</Text>
        <Text style={styles.feature}>✓ File sharing (100MB)</Text>
        <Text style={styles.feature}>✓ No ads or tracking</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827'
  },
  content: {
    padding: 24,
    paddingBottom: 50,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af'
  },

  // Card Payment
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12
  },
  cardField: {
    height: 50,
    marginBottom: 16
  },
  button: {
    backgroundColor: '#10B981',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF'
  },
  info: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 12
  },

  // Features
  features: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  feature: {
    fontSize: 14,
    color: '#d1d5db',
    marginBottom: 8
  },
});
