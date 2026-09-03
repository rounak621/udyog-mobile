import { useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useBottomPadding } from '../../components/ui/SafeLayout';

export default function ProfileScreen() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Edit Name State
  const [isEditingName, setIsEditingName] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [savingName, setSavingName] = useState(false);

  // Add Email State
  const [isAddingEmail, setIsAddingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailStep, setEmailStep] = useState(1); // 1: Enter email, 2: Enter code
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingEmailObj, setPendingEmailObj] = useState<any>(null);
  const [addingEmailLoading, setAddingEmailLoading] = useState(false);

  // Change Password State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  if (!isLoaded || !user) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const getInitials = () => {
    if (user.firstName || user.lastName) {
      return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
    }
    const email = user.primaryEmailAddress?.emailAddress || '';
    return email.slice(0, 2).toUpperCase() || '?';
  };

  const handleSaveName = async () => {
    if (!firstName.trim()) {
      Alert.alert('Error', 'First name is required');
      return;
    }
    setSavingName(true);
    try {
      await user.update({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      setIsEditingName(false);
      Alert.alert('Success', 'Name updated successfully');
    } catch (err: any) {
      Alert.alert('Error', err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Failed to update name');
    } finally {
      setSavingName(false);
    }
  };

  const handleAddEmail = async () => {
    if (!newEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }
    setAddingEmailLoading(true);
    try {
      const emailObj = await user.createEmailAddress({ email: newEmail.trim() });
      setPendingEmailObj(emailObj);
      await emailObj.prepareVerification({ strategy: 'email_code' });
      setEmailStep(2);
    } catch (err: any) {
      Alert.alert('Error', err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Failed to create email address');
    } finally {
      setAddingEmailLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!verificationCode.trim()) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }
    setAddingEmailLoading(true);
    try {
      await pendingEmailObj.attemptVerification({ code: verificationCode.trim() });
      await user.reload();
      Alert.alert('Success', 'Email address verified and added successfully.');
      // Reset state
      setIsAddingEmail(false);
      setNewEmail('');
      setVerificationCode('');
      setEmailStep(1);
      setPendingEmailObj(null);
    } catch (err: any) {
      Alert.alert('Error', err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Verification failed');
    } finally {
      setAddingEmailLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New password and confirm password do not match');
      return;
    }
    setPasswordLoading(true);
    try {
      await user.updatePassword({ currentPassword, newPassword });
      Alert.alert('Success', 'Password updated successfully');
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      Alert.alert('Error', err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'No Name Set';
  const primaryEmail = user.primaryEmailAddress?.emailAddress || '';
  const initials = getInitials();

  // external provider capitalized
  const provider = user.externalAccounts?.[0]?.provider || '';
  const providerName = provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : '';

  const bottomPadding = useBottomPadding(60);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <View style={{ width: 34 }} />
      </View>

      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ ...styles.scrollContent, paddingBottom: bottomPadding }}
        enableOnAndroid
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar Card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.primaryEmail}>{primaryEmail}</Text>
        </View>

        {/* Edit Name Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Edit Name</Text>
          <View style={styles.card}>
            {!isEditingName ? (
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={() => {
                  setFirstName(user.firstName || '');
                  setLastName(user.lastName || '');
                  setIsEditingName(true);
                }}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name="person-outline" size={18} color={Colors.primary} />
                  <Text style={styles.rowLabel}>Edit Name</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : (
              <View style={styles.formContainer}>
                <Text style={styles.inputLabel}>FIRST NAME</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="First Name"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>LAST NAME</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Last Name"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={[styles.btnSecondary, { flex: 1 }]}
                    onPress={() => setIsEditingName(false)}
                    disabled={savingName}
                  >
                    <Text style={styles.btnSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnPrimary, { flex: 1 }]}
                    onPress={handleSaveName}
                    disabled={savingName}
                  >
                    {savingName ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.btnPrimaryText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Email Addresses Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Email Addresses</Text>
          <View style={styles.card}>
            {user.emailAddresses.map((emailObj) => {
              const isPrimary = emailObj.id === user.primaryEmailAddressId;
              return (
                <View key={emailObj.id} style={styles.emailRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.emailText}>{emailObj.emailAddress}</Text>
                    {emailObj.verification?.status !== 'verified' && (
                      <Text style={styles.unverifiedText}>Unverified</Text>
                    )}
                  </View>
                  {isPrimary && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>Primary</Text>
                    </View>
                  )}
                </View>
              );
            })}

            {!isAddingEmail ? (
              <TouchableOpacity
                style={styles.addEmailBtn}
                onPress={() => {
                  setIsAddingEmail(true);
                  setEmailStep(1);
                }}
              >
                <Ionicons name="add" size={18} color={Colors.primary} />
                <Text style={styles.addEmailText}>Add email address</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.formContainer}>
                {emailStep === 1 ? (
                  <>
                    <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                    <View style={styles.inputBox}>
                      <TextInput
                        style={styles.input}
                        value={newEmail}
                        onChangeText={setNewEmail}
                        placeholder="you@example.com"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>
                    <View style={styles.formActions}>
                      <TouchableOpacity
                        style={[styles.btnSecondary, { flex: 1 }]}
                        onPress={() => {
                          setIsAddingEmail(false);
                          setNewEmail('');
                        }}
                        disabled={addingEmailLoading}
                      >
                        <Text style={styles.btnSecondaryText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btnPrimary, { flex: 1 }]}
                        onPress={handleAddEmail}
                        disabled={addingEmailLoading}
                      >
                        {addingEmailLoading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.btnPrimaryText}>Send Code</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.inputLabel}>6-DIGIT VERIFICATION CODE</Text>
                    <View style={styles.inputBox}>
                      <TextInput
                        style={[styles.input, { textAlign: 'center', fontSize: 16, letterSpacing: 4 }]}
                        value={verificationCode}
                        onChangeText={setVerificationCode}
                        placeholder="000000"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>
                    <View style={styles.formActions}>
                      <TouchableOpacity
                        style={[styles.btnSecondary, { flex: 1 }]}
                        onPress={() => {
                          setEmailStep(1);
                          setVerificationCode('');
                        }}
                        disabled={addingEmailLoading}
                      >
                        <Text style={styles.btnSecondaryText}>Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btnPrimary, { flex: 1 }]}
                        onPress={handleVerifyEmail}
                        disabled={addingEmailLoading}
                      >
                        {addingEmailLoading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.btnPrimaryText}>Verify</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.card}>
            {user.passwordEnabled ? (
              !isChangingPassword ? (
                <TouchableOpacity
                  style={styles.rowBtn}
                  onPress={() => setIsChangingPassword(true)}
                >
                  <View style={styles.rowLeft}>
                    <Ionicons name="lock-closed-outline" size={18} color={Colors.primary} />
                    <Text style={styles.rowLabel}>Change Password</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ) : (
                <View style={styles.formContainer}>
                  <Text style={styles.inputLabel}>CURRENT PASSWORD</Text>
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder="Current Password"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry={!showCurrentPass}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={() => setShowCurrentPass(!showCurrentPass)}>
                      <Ionicons name={showCurrentPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>NEW PASSWORD</Text>
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Min 8 characters"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry={!showNewPass}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={() => setShowNewPass(!showNewPass)}>
                      <Ionicons name={showNewPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>CONFIRM NEW PASSWORD</Text>
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm New Password"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry={!showConfirmPass}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPass(!showConfirmPass)}>
                      <Ionicons name={showConfirmPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.formActions}>
                    <TouchableOpacity
                      style={[styles.btnSecondary, { flex: 1 }]}
                      onPress={() => {
                        setIsChangingPassword(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      disabled={passwordLoading}
                    >
                      <Text style={styles.btnSecondaryText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnPrimary, { flex: 1 }]}
                      onPress={handleChangePassword}
                      disabled={passwordLoading}
                    >
                      {passwordLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.btnPrimaryText}>Change</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )
            ) : (
              <View style={styles.infoRow}>
                <Ionicons name="key-outline" size={18} color={Colors.primary} />
                <Text style={styles.infoText}>
                  {providerName ? `Signed in with ${providerName}` : 'Signed in via SSO'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  topbar: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  avatarCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  displayName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  primaryEmail: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  section: {
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  rowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  formContainer: {
    padding: Spacing.md,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    padding: 0,
  },
  formActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  btnSecondary: {
    backgroundColor: '#F1F5F9',
    borderRadius: Radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  emailText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  unverifiedText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 2,
  },
  primaryBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#DCFCE7',
  },
  primaryBadgeText: {
    color: Colors.success,
    fontSize: 11,
    fontWeight: '600',
  },
  addEmailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: Spacing.md,
  },
  addEmailText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
