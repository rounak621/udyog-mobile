import { useSignIn, useOAuth } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView, Image, StatusBar
} from 'react-native';
import { Colors, Radius } from '../../constants/theme';
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
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Orange header */}
      <View style={styles.header}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.logoBox}>
          <Image source={require('../../assets/udyog-logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.logoSub}>India's Simplest GST Billing</Text>
        </View>
      </View>

      {/* White card */}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue to Udyog</Text>

        <TouchableOpacity style={styles.googleBtn} onPress={handleGoogle} disabled={googleLoading}>
          {googleLoading ? <ActivityIndicator color="#444" size="small" /> : (
            <>
              <View style={styles.gIcon}><Text style={styles.gLetter}>G</Text></View>
              <Text style={styles.googleText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.divRow}>
          <View style={styles.divLine} />
          <Text style={styles.divText}>or sign in with email</Text>
          <View style={styles.divLine} />
        </View>

        <Text style={styles.label}>Email</Text>
        <View style={styles.inputBox}>
          <Ionicons name="mail-outline" size={17} color={Colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={Colors.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        </View>

        <Text style={styles.label}>Password</Text>
        <View style={styles.inputBox}>
          <Ionicons name="lock-closed-outline" size={17} color={Colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Enter password" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry={!showPass} />
          <TouchableOpacity onPress={() => setShowPass(s => !s)}>
            <Ionicons name={showPass ? 'eye-outline' : 'eye-off-outline'} size={17} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Sign In</Text>}
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/signup"><Text style={styles.footerLink}>Sign up</Text></Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: Colors.primary, paddingTop: 52, paddingBottom: 40, paddingHorizontal: 24, position: 'relative', overflow: 'hidden' },
  circle1: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.08)', top: -50, right: -30 },
  circle2: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.06)', bottom: 10, left: 20 },
  backBtn: { marginBottom: 16 },
  logoBox: { alignItems: 'center' },
  logo: { width: 140, height: 44, tintColor: '#fff' },
  logoSub: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  content: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 24 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, padding: 13, gap: 10, marginBottom: 18 },
  gIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  gLetter: { fontSize: 13, fontWeight: '700', color: '#4285F4' },
  googleText: { fontSize: 14, fontWeight: '500', color: Colors.text },
  divRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  divLine: { flex: 1, height: 0.5, backgroundColor: '#e2e8f0' },
  divText: { fontSize: 11, color: Colors.textMuted },
  label: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14 },
  input: { flex: 1, fontSize: 14, color: Colors.text },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 6, marginBottom: 18 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { fontSize: 13, color: Colors.textSecondary },
  footerLink: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
});
