import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, StatusBar
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function ForgotPasswordScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [step, setStep] = useState(1); // 1: Send email, 2: Reset password
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    if (!isLoaded) return;
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim(),
      });
      setStep(2);
    } catch (err: any) {
      Alert.alert('Error', err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!isLoaded) return;
    if (!code || !newPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password: newPassword,
      });

      if (result.status === 'complete') {
        if (setActive) {
          await setActive({ session: result.createdSessionId });
          router.replace('/(tabs)');
        } else {
          Alert.alert('Success', 'Password reset successful. Please sign in.');
          router.replace('/(auth)/login');
        }
      } else {
        Alert.alert('Success', 'Password reset successful. Please sign in.');
        router.replace('/(auth)/login');
      }
    } catch (err: any) {
      Alert.alert('Error', err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Invalid code or password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: '#FDF8F3' }}
      contentContainerStyle={{ paddingBottom: 40 }}
      enableOnAndroid
      extraScrollHeight={20}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FDF8F3" />

      {/* Header */}
      <View style={[styles.header, { marginTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => step === 2 ? setStep(1) : router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.logoIcon}>
          <Ionicons name="document-text" size={16} color="#fff" />
        </View>
        <Text style={styles.logoText}>Udyog</Text>
      </View>

      {step === 1 ? (
        <View style={{ paddingHorizontal: 24, marginTop: 24, alignItems: 'flex-start' }}>
          <View style={styles.iconBox}>
            <Ionicons name="key-outline" size={28} color="#F97316" />
          </View>
          <Text style={styles.heading}>Forgot password?</Text>
          <Text style={styles.subheading}>
            No worries! Enter your email address below, and we'll send you a 6-digit code to reset your password.
          </Text>

          <View style={{ alignSelf: 'stretch', marginTop: 24 }}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <View style={styles.inputBox}>
              <Ionicons name="mail-outline" size={18} color="#94A3B8" />
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <TouchableOpacity style={[styles.ctaBtn, { marginHorizontal: 0, marginTop: 24, alignSelf: 'stretch' }]} onPress={handleSendCode} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaBtnText}>Send Reset Code</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={styles.footerLink}>← Back to login</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 24, marginTop: 24, alignItems: 'flex-start' }}>
          <View style={styles.iconBox}>
            <Ionicons name="mail-open-outline" size={28} color="#F97316" />
          </View>
          <Text style={styles.heading}>Reset password</Text>
          <Text style={styles.subheading}>
            Enter the 6-digit verification code sent to{'\n'}
            <Text style={{ fontWeight: '700', color: '#0F172A' }}>{email}</Text>
          </Text>

          <View style={{ alignSelf: 'stretch', marginTop: 24 }}>
            <Text style={styles.label}>RESET CODE</Text>
            <View style={styles.inputBox}>
              <Ionicons name="keypad-outline" size={18} color="#94A3B8" />
              <TextInput
                style={[styles.input, { textAlign: 'center', fontSize: 18, letterSpacing: 4 }]}
                placeholder="000000"
                placeholderTextColor="#CBD5E1"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>

            <Text style={[styles.label, { marginTop: 16 }]}>NEW PASSWORD</Text>
            <View style={styles.inputBox}>
              <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" />
              <TextInput
                style={styles.input}
                placeholder="Min 8 characters"
                placeholderTextColor="#94A3B8"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={[styles.ctaBtn, { marginHorizontal: 0, marginTop: 24, alignSelf: 'stretch' }]} onPress={handleResetPassword} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaBtnText}>Reset Password</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setStep(1)} style={{ marginTop: 16 }}>
            <Text style={styles.footerLink}>← Change email</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  logoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  heading: { fontSize: 30, fontWeight: '800', color: '#0F172A' },
  subheading: { fontSize: 14, color: '#64748B', marginTop: 6, lineHeight: 20 },
  iconBox: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '700', color: '#64748B', letterSpacing: 0.5, marginBottom: 8 },
  inputBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: '#E2E8F0' },
  input: { flex: 1, fontSize: 14, color: '#0F172A' },
  ctaBtn: { backgroundColor: '#F97316', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24, elevation: 3, shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footerLink: { fontSize: 13, color: '#F97316', fontWeight: '700', lineHeight: 18 },
});
