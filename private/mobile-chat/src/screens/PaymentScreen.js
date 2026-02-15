// Version: 1.0056
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Linking, Alert } from 'react-native';
import { CardField, useStripe } from '@stripe/stripe-react-native';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';
import ApiService from '../services/api';
import { CRYPTO_CONFIG, getCurrentNetwork, PAYMENT_OPTIONS, FEATURES } from '../config';

export default function PaymentScreen({ navigation }) {
  // Stripe state
  const [isLoading, setIsLoading] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const { confirmPayment } = useStripe();
  
  // Crypto state
  const [paymentMethod, setPaymentMethod] = useState(null); // 'card' or 'crypto'
  const [cryptoLoading, setCryptoLoading] = useState(false);
  
  // Auth
  const { phone, userId, login, updatePaymentStatus } = useAuth();

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

  const handleCryptoPayment = async () => {
    setCryptoLoading(true);
    
    try {
      const network = getCurrentNetwork();
      
      // Deep link to MetaMask Mobile
      const metamaskDeepLink = buildMetaMaskDeepLink();
      
      Alert.alert(
        '🦊 MetaMask Payment',
        `Send ${CRYPTO_CONFIG.PAYMENT_AMOUNT} KCY to treasury wallet`,
        [
          {
            text: 'Open MetaMask',
            onPress: async () => {
              const supported = await Linking.canOpenURL(metamaskDeepLink);
              
              if (supported) {
                await Linking.openURL(metamaskDeepLink);
                
                // Show instructions
                Alert.alert(
                  'Payment Instructions',
                  `1. Confirm the transaction in MetaMask\n2. Wait for confirmation\n3. Return to this app\n4. Click "Verify Payment"`,
                  [{ text: 'OK' }]
                );
              } else {
                Alert.alert(
                  'MetaMask Not Installed',
                  'Please install MetaMask mobile app to pay with crypto',
                  [
                    {
                      text: 'Install',
                      onPress: () => Linking.openURL('https://metamask.app.link/'),
                    },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }
            },
          },
          {
            text: 'Copy Address',
            onPress: () => {
              // TODO: Implement copy to clipboard
              Alert.alert(
                'Treasury Address',
                CRYPTO_CONFIG.TREASURY_WALLET,
                [{ text: 'OK' }]
              );
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    } finally {
      setCryptoLoading(false);
    }
  };

  const buildMetaMaskDeepLink = () => {
    const network = getCurrentNetwork();
    const treasuryWallet = CRYPTO_CONFIG.TREASURY_WALLET;
    const tokenAddress = CRYPTO_CONFIG.TOKEN_ADDRESS;
    const amount = CRYPTO_CONFIG.PAYMENT_AMOUNT;
    
    // MetaMask deep link format for token transfer
    // metamask://send?token={tokenAddress}&to={treasuryWallet}&amount={amount}
    
    return `metamask://send?token=${tokenAddress}&to=${treasuryWallet}&amount=${amount}`;
  };

  const verifyPayment = async () => {
    setCryptoLoading(true);
    
    try {
      // Check if payment was received
      const response = await ApiService.checkCryptoPaymentStatus(userId);
      
      if (response.isPaid) {
        await login(phone, response.token, true);
        ApiService.setAuthToken(response.token);
        updatePaymentStatus(true);
        
        Toast.show({ type: 'success', text1: 'Payment Confirmed!', text2: 'Welcome to AMS Chat' });
        setTimeout(() => navigation.replace('Home'), 1500);
      } else {
        Alert.alert(
          'Payment Not Detected',
          'We haven\'t received your payment yet. Please wait a moment and try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    } finally {
      setCryptoLoading(false);
    }
  };

  const renderPaymentOptions = () => (
    <View style={styles.paymentOptions}>
      {FEATURES.CRYPTO_PAYMENTS && (
        <TouchableOpacity
          style={[
            styles.paymentOption,
            paymentMethod === 'crypto' && styles.paymentOptionSelected,
          ]}
          onPress={() => setPaymentMethod('crypto')}
        >
          <View style={styles.paymentOptionHeader}>
            <Text style={styles.paymentOptionIcon}>{PAYMENT_OPTIONS.CRYPTO.ICON}</Text>
            <View style={styles.paymentOptionInfo}>
              <Text style={styles.paymentOptionTitle}>{PAYMENT_OPTIONS.CRYPTO.DISPLAY_NAME}</Text>
              <Text style={styles.paymentOptionSubtitle}>KCY Token</Text>
            </View>
          </View>
          <View style={styles.paymentOptionPrice}>
            <Text style={styles.paymentOptionAmount}>{PAYMENT_OPTIONS.CRYPTO.AMOUNT} KCY</Text>
            <Text style={styles.paymentOptionEquiv}>≈ $0.026*</Text>
          </View>
        </TouchableOpacity>
      )}
      
      {FEATURES.STRIPE_PAYMENTS && (
        <TouchableOpacity
          style={[
            styles.paymentOption,
            paymentMethod === 'card' && styles.paymentOptionSelected,
          ]}
          onPress={() => setPaymentMethod('card')}
        >
          <View style={styles.paymentOptionHeader}>
            <Text style={styles.paymentOptionIcon}>{PAYMENT_OPTIONS.CARD.ICON}</Text>
            <View style={styles.paymentOptionInfo}>
              <Text style={styles.paymentOptionTitle}>{PAYMENT_OPTIONS.CARD.DISPLAY_NAME}</Text>
              <Text style={styles.paymentOptionSubtitle}>Visa/Mastercard</Text>
            </View>
          </View>
          <View style={styles.paymentOptionPrice}>
            <Text style={styles.paymentOptionAmount}>€5 / $5</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderCryptoPayment = () => (
    <View style={styles.cryptoContainer}>
      <Text style={styles.cryptoTitle}>🪙 Crypto Payment</Text>
      
      <View style={styles.cryptoInfo}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Amount:</Text>
          <Text style={styles.infoValue}>{CRYPTO_CONFIG.PAYMENT_AMOUNT} KCY</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Network:</Text>
          <Text style={styles.infoValue}>{getCurrentNetwork().CHAIN_NAME}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Treasury:</Text>
          <Text style={styles.infoValueSmall} numberOfLines={1}>
            {CRYPTO_CONFIG.TREASURY_WALLET}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, styles.cryptoButton]}
        onPress={handleCryptoPayment}
        disabled={cryptoLoading}
      >
        {cryptoLoading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>Pay with MetaMask</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.verifyButton]}
        onPress={verifyPayment}
        disabled={cryptoLoading}
      >
        <Text style={styles.verifyButtonText}>I've Already Paid - Verify</Text>
      </TouchableOpacity>

      <Text style={styles.cryptoNote}>
        * At 30x price ($0.000088). Actual price may vary based on market.
      </Text>
    </View>
  );

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
        <Text style={styles.subtitle}>Choose your payment method</Text>
      </View>

      {renderPaymentOptions()}

      {paymentMethod === 'crypto' && renderCryptoPayment()}
      {paymentMethod === 'card' && renderCardPayment()}

      {!paymentMethod && (
        <View style={styles.selectPrompt}>
          <Text style={styles.selectPromptText}>Please select a payment method above</Text>
        </View>
      )}

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
  
  // Payment Options
  paymentOptions: {
    marginBottom: 24,
  },
  paymentOption: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paymentOptionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e3a8a',
  },
  paymentOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentOptionIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  paymentOptionInfo: {
    flex: 1,
  },
  paymentOptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  paymentOptionSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
  },
  paymentOptionPrice: {
    alignItems: 'flex-end',
  },
  paymentOptionAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  paymentOptionEquiv: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  
  // Crypto Payment
  cryptoContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  cryptoTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  cryptoInfo: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  infoValueSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
    flex: 1,
    textAlign: 'right',
  },
  cryptoButton: {
    backgroundColor: '#9333ea',
    marginBottom: 12,
  },
  verifyButton: {
    backgroundColor: '#374151',
    marginBottom: 12,
  },
  verifyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  cryptoNote: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
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
  
  // Select Prompt
  selectPrompt: {
    padding: 40,
    alignItems: 'center',
  },
  selectPromptText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
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
