import { useSignUp, useOAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator, Alert, Image, StatusBar
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function SignupScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleSignup = async () => {
    if (!isLoaded) return;
    if (!agreedToTerms) {
      Alert.alert('Please agree to Terms', 'You must agree to the Terms & Privacy Policy to continue.');
      return;
    }
    if (!email || !password) { Alert.alert('Error', 'Please fill all fields'); return; }
    setLoading(true);
    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      Alert.alert('Signup Failed', err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/onboarding');
      }
    } catch (err: any) {
      Alert.alert('Verification Failed', err.errors?.[0]?.message || 'Invalid code');
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
        router.replace('/onboarding');
      }
    } catch (err: any) {
      Alert.alert('Google Sign In Failed', err.message || 'Something went wrong');
    } finally {
      setGoogleLoading(false);
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.logoIcon}>
          <Ionicons name="document-text" size={16} color="#fff" />
        </View>
        <Text style={styles.logoText}>Udyog</Text>
      </View>

      {!pendingVerification ? (
        <>
          {/* Heading section */}
          <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
            <Text style={styles.heading}>Create account</Text>
            <Text style={styles.subheading}>Join thousands of Indian businesses.</Text>
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
            <Text style={styles.dividerText} textBreakStrategy="simple">or sign up with email</Text>
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
              <Text style={styles.label}>PASSWORD</Text>
            </View>
            <View style={styles.inputBox}>
              <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" />
              <TextInput
                style={styles.input}
                placeholder="Min 8 characters"
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

          {/* Terms checkbox */}
          <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreedToTerms(!agreedToTerms)}>
            <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
              {agreedToTerms && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.legalText}>
              I agree to the{' '}
              <Text style={styles.legalLink} onPress={() => router.push('/legal/terms')}>Terms & Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          {/* Primary CTA */}
          <TouchableOpacity style={styles.ctaBtn} onPress={handleSignup} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaBtnText}>Create Account</Text>}
          </TouchableOpacity>

          {/* Footer link */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 20, paddingHorizontal: 8 }}>
            <Text style={[styles.footerText, { flexShrink: 1 }]} textBreakStrategy="simple">Already have an account? </Text>
            <Text style={[styles.footerLink, { flexShrink: 1 }]} textBreakStrategy="simple" onPress={() => router.push('/(auth)/login')}>Sign in</Text>
          </View>

          {/* Trust Row */}
          <View style={styles.trustRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 280, justifyContent: 'center' }}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#94A3B8" />
              <Text style={styles.trustText} textBreakStrategy="simple" numberOfLines={2}>Bank-level security · 500+ businesses</Text>
            </View>
          </View>
        </>
      ) : (
        /* OTP verification screen */
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
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          <TouchableOpacity style={[styles.ctaBtn, { marginHorizontal: 0, marginTop: 24, alignSelf: 'stretch' }]} onPress={handleVerify} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaBtnText}>Verify & Continue</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setPendingVerification(false)} style={{ marginTop: 16 }}>
            <Text style={styles.footerLink}>← Go back</Text>
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
  subheading: { fontSize: 14, color: '#64748B', marginTop: 6 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 16, marginHorizontal: 24, marginTop: 28, borderWidth: 1.5, borderColor: '#E2E8F0' },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginTop: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { fontSize: 12, color: '#94A3B8', paddingHorizontal: 12, flexShrink: 0 },
  label: { fontSize: 11, fontWeight: '700', color: '#64748B', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  inputBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: '#E2E8F0' },
  input: { flex: 1, fontSize: 14, color: '#0F172A' },
  ctaBtn: { backgroundColor: '#F97316', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginHorizontal: 24, marginTop: 24, elevation: 3, shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footerText: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  footerLink: { fontSize: 13, color: '#F97316', fontWeight: '700', lineHeight: 18 },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16, paddingHorizontal: 24 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', marginTop: 1, backgroundColor: '#fff' },
  checkboxChecked: { backgroundColor: '#F97316', borderColor: '#F97316' },
  legalText: { fontSize: 12, color: '#64748B', flex: 1, lineHeight: 18 },
  legalLink: { color: '#F97316', fontWeight: '700' },
  otpIconBox: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  trustRow: { alignItems: 'center', marginTop: 32, paddingHorizontal: 24 },
  trustText: { fontSize: 11, color: '#94A3B8', flexShrink: 1, flexWrap: 'wrap' },
});
