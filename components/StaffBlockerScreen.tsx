import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  BackHandler,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../constants/theme';
import { Business } from '../context/BusinessContext';

interface StaffBlockerScreenProps {
  businessName: string;
  isPaused?: boolean;
  isInvite?: boolean;
  businesses: Business[];
  activeBusinessId?: string;
  onSwitchBusiness: (businessId: string) => Promise<void>;
  onLogout: () => Promise<void> | void;
}

export default function StaffBlockerScreen({
  businessName,
  isPaused = false,
  isInvite = false,
  businesses,
  activeBusinessId,
  onSwitchBusiness,
  onLogout,
}: StaffBlockerScreenProps) {
  const insets = useSafeAreaInsets();
  const [isSwitching, setIsSwitching] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Prevent hardware back navigation on Android
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const ownedBusinesses = (Array.isArray(businesses) ? businesses : []).filter(
    (b) => b.my_role === 'OWNER' && b.id !== activeBusinessId
  );

  const displayBizName = businessName?.trim() || 'this business';

  let bodyText = `You're staff at ${displayBizName}. Staff access on the mobile app is coming soon. For now, please use the Udyog web app.`;
  if (isPaused) {
    bodyText = 'Your access is paused. Ask the business owner to renew.';
  } else if (isInvite) {
    bodyText = `You've been invited to join ${displayBizName} as staff. Staff access on the mobile app is coming soon. Please open the invite link from your email on a computer or in your phone's browser, and use the Udyog web app.`;
  }

  const handleOpenWebApp = async () => {
    try {
      await Linking.openURL('https://app.udyogbook.in');
    } catch (err) {
      console.log('Error opening web app URL:', err);
      Alert.alert('Error', 'Could not open web browser.');
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await onLogout();
    } catch (err) {
      console.log('Error during logout:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleSwitchToMyBusiness = async () => {
    if (isSwitching || ownedBusinesses.length === 0) return;

    if (ownedBusinesses.length === 1) {
      setIsSwitching(true);
      try {
        await onSwitchBusiness(ownedBusinesses[0].id);
      } catch (err: any) {
        Alert.alert('Switch Failed', err?.message || 'Failed to switch business');
      } finally {
        setIsSwitching(false);
      }
    } else {
      Alert.alert(
        'Switch to my business',
        'Select a business to switch to:',
        [
          ...ownedBusinesses.map((b) => ({
            text: b.name,
            onPress: async () => {
              setIsSwitching(true);
              try {
                await onSwitchBusiness(b.id);
              } catch (err: any) {
                Alert.alert('Switch Failed', err?.message || 'Failed to switch business');
              } finally {
                setIsSwitching(false);
              }
            },
          })),
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Top Header */}
      <View style={styles.topbar}>
        <View style={styles.brandRow}>
          <View style={styles.brandBadge}>
            <Ionicons name="briefcase" size={16} color="#fff" />
          </View>
          <Text style={styles.brandText}>Udyog</Text>
        </View>
        <TouchableOpacity
          onPress={handleLogout}
          style={styles.headerLogoutBtn}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <ActivityIndicator size="small" color={Colors.textSecondary} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.headerLogoutText}>Log out</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {/* Icon Badge */}
          <View style={[styles.iconWrap, isPaused && styles.iconWrapPaused]}>
            <Ionicons
              name={isPaused ? 'pause-circle-outline' : 'people'}
              size={36}
              color={isPaused ? Colors.danger : Colors.primary}
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>You're signed in as Staff</Text>

          {/* Body */}
          <Text style={styles.body}>{bodyText}</Text>

          {/* Actions */}
          <View style={styles.buttonGroup}>
            {/* Open web app */}
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleOpenWebApp}
              activeOpacity={0.85}
            >
              <Ionicons name="open-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Open web app</Text>
            </TouchableOpacity>

            {/* Switch to my business (if owned business exists) */}
            {ownedBusinesses.length > 0 && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleSwitchToMyBusiness}
                disabled={isSwitching}
                activeOpacity={0.85}
              >
                {isSwitching ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons
                      name="swap-horizontal-outline"
                      size={18}
                      color={Colors.primary}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.secondaryBtnText}>Switch to my business</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Log out */}
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={handleLogout}
              disabled={isLoggingOut}
              activeOpacity={0.85}
            >
              {isLoggingOut ? (
                <ActivityIndicator size="small" color={Colors.textSecondary} />
              ) : (
                <>
                  <Ionicons
                    name="log-out-outline"
                    size={18}
                    color={Colors.textSecondary}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.outlineBtnText}>Log out</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    gap: 4,
  },
  headerLogoutText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  iconWrapPaused: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  outlineBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
