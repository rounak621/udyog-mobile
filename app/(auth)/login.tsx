import { useSignIn, useOAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator, Alert, Image, StatusBar
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function LoginScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [otp, setOtp] = useState('');

  const handleLogin = async () => {
    if (!isLoaded) { Alert.alert('Please wait', 'Auth loading...'); return; }
    if (!email || !password) { Alert.alert('Error', 'Please enter email and password'); return; }
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email.trim(), password });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      } else if (result.status === 'needs_second_factor') {
        setShowOTP(true);
      } else {
        Alert.alert('Login Failed', `Status: ${result.status}`);
      }
    } catch (err: any) {
      const msg = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Login failed';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const { createdSessionId, setActive: setActiveOAuth } = await startOAuthFlow();
      if (createdSessionId) {
        await setActiveOAuth!({ session: createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      Alert.alert('Google Sign In Failed', err.message || 'Something went wrong');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleOTP = async () => {
    if (!otp) { Alert.alert('Error', 'Enter the OTP sent to your email'); return; }
    setLoading(true);
    try {
      const result = await signIn.attemptSecondFactor({
        strategy: 'email_code',
        code: otp,
      });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Invalid OTP. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.errors?.[0]?.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (showOTP) {
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowOTP(false)} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.logoIcon}>
            <Ionicons name="document-text" size={16} color="#fff" />
          </View>
          <Text style={styles.logoText}>Udyog</Text>
        </View>

        {/* OTP verification screen */}
        <View style={{ paddingHorizontal: 24, marginTop: 24, alignItems: 'flex-start' }}>
          <View style={styles.otpIconBox}>
            <Ionicons name="mail-outline" size={28} color="#F97316" />
          </View>
          <Text style={styles.heading}>Verify your email</Text>
          <Text style={styles.subheading}>
            Enter the 6-digit code we sent to{'\n'}
            <Text style={{ fontWeight: '700', color: '#0F172A' }}>{email}</Text>
          </Text>
          
          <View style={[styles.inputBox, { marginTop: 24, alignSelf: 'stretch' }]}>
            <Ionicons name="keypad-outline" size={18} color="#94A3B8" />
            <TextInput
              style={[styles.input, { textAlign: 'center', fontSize: 20, letterSpacing: 8 }]}
              placeholder="000000"
              placeholderTextColor="#CBD5E1"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
          </View>

          <TouchableOpacity style={[styles.ctaBtn, { marginHorizontal: 0, marginTop: 24, alignSelf: 'stretch' }]} onPress={handleOTP} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaBtnText}>Verify</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowOTP(false)} style={{ marginTop: 16 }}>
            <Text style={styles.footerLink}>← Back to login</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    );
  }

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.logoIcon}>
          <Ionicons name="document-text" size={16} color="#fff" />
        </View>
        <Text style={styles.logoText}>Udyog</Text>
      </View>

      {/* Heading section */}
      <View style={{ paddingHorizontal: 24, marginTop: 32 }}>
        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.subheading}>Sign in to continue billing.</Text>
      </View>

      {/* Google button */}
      <TouchableOpacity style={styles.googleBtn} onPress={handleGoogle} disabled={googleLoading}>
        {googleLoading ? (
          <ActivityIndicator color="#0F172A" size="small" />
        ) : (
          <>
            <Image source={{ uri: 'https://www.google.com/favicon.ico' }} style={{ width: 18, height: 18 }} />
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or sign in with email</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Email/Password inputs */}
      <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
        <Text style={styles.label}>EMAIL</Text>
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Text style={[styles.label, { marginBottom: 0, marginTop: 16 }]}>PASSWORD</Text>
          <TouchableOpacity onPress={() => Alert.alert('Forgot Password', 'Reset password functionality is not configured. Please use Continue with Google or contact support.')}>
            <Text style={styles.forgotLink}>Forgot?</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.inputBox}>
          <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" />
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor="#94A3B8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
          />
          <TouchableOpacity onPress={() => setShowPass(!showPass)}>
            <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Primary CTA */}
      <TouchableOpacity style={styles.ctaBtn} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaBtnText}>Sign In</Text>}
      </TouchableOpacity>

      {/* Footer link */}
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <Text style={styles.footerText}>
          New to Udyog?{' '}
          <Text style={styles.footerLink} onPress={() => router.push('/(auth)/signup')}>Create account</Text>
        </Text>
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24, marginTop: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  logoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  heading: { fontSize: 30, fontWeight: '800', color: '#0F172A' },
  subheading: { fontSize: 14, color: '#64748B', marginTop: 6 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 16, marginHorizontal: 24, marginTop: 28, borderWidth: 1.5, borderColor: '#E2E8F0' },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginTop: 24, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { fontSize: 12, color: '#94A3B8' },
  label: { fontSize: 11, fontWeight: '700', color: '#64748B', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  inputBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: '#E2E8F0' },
  input: { flex: 1, fontSize: 14, color: '#0F172A' },
  ctaBtn: { backgroundColor: '#F97316', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginHorizontal: 24, marginTop: 24, elevation: 3, shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footerText: { fontSize: 13, color: '#64748B' },
  footerLink: { fontSize: 13, color: '#F97316', fontWeight: '700' },
  otpIconBox: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  forgotLink: { fontSize: 12, color: '#F97316', fontWeight: '600', marginTop: 16 },
});
