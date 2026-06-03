'use client';
import { useSignIn, useOAuth } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView, Dimensions, Image
} from 'react-native';
import { Colors, Radius, Spacing } from '../../constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async () => {
    if (!isLoaded) { Alert.alert('Please wait', 'Auth loading...'); return; }
    if (!email || !password) { Alert.alert('Error', 'Please enter email and password'); return; }
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email.trim(), password });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
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

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Wave Header */}
      <View style={styles.header}>
        <View style={styles.waveBg} />
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoLetter}>U</Text>
          </View>
          <Text style={styles.logoText}>Udyog</Text>
          <Text style={styles.logoSub}>GST Billing & Accounting</Text>
        </View>
        <View style={styles.waveBottom} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        {/* Google Button */}
        <TouchableOpacity style={styles.googleBtn} onPress={handleGoogle} disabled={googleLoading}>
          {googleLoading ? <ActivityIndicator color="#444" size="small" /> : (
            <>
              <View style={styles.googleIcon}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#4285F4' }}>G</Text>
              </View>
              <Text style={styles.googleText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.label}>Email</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.label}>Password</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Enter password"
            placeholderTextColor={Colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
          />
          <TouchableOpacity onPress={() => setShowPass(s => !s)} style={{ padding: 4 }}>
            <Ionicons name={showPass ? 'eye-outline' : 'eye-off-outline'} size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Sign In</Text>}
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/signup">
            <Text style={styles.link}>Sign up</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { height: 220, backgroundColor: Colors.primary, position: 'relative', overflow: 'hidden' },
  waveBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.primary },
  logoArea: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 40, alignItems: 'center', justifyContent: 'center' },
  logoCircle: { width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  logoLetter: { fontSize: 28, fontWeight: '800', color: '#fff' },
  logoText: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  logoSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  waveBottom: { position: 'absolute', bottom: -1, left: -20, right: -20, height: 60, backgroundColor: '#fff', borderTopLeftRadius: 40, borderTopRightRadius: 40 },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, marginBottom: 24 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: Radius.sm, padding: 13, gap: 10, marginBottom: 20 },
  googleIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  googleText: { fontSize: 14, fontWeight: '500', color: Colors.text },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: '#e2e8f0' },
  dividerText: { fontSize: 12, color: Colors.textMuted },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 0.5, borderColor: '#e2e8f0', borderRadius: Radius.sm, paddingHorizontal: 12, marginBottom: 16 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 12, fontSize: 14, color: Colors.text },
  loginBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, padding: 15, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  loginBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { fontSize: 13, color: Colors.textSecondary },
  link: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
});
