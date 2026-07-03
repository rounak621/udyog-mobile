import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBusiness } from '../context/BusinessContext';

interface BusinessSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function BusinessSwitcherModal({ visible, onClose }: BusinessSwitcherModalProps) {
  const router = useRouter();
  const {
    business, businesses, switchBusiness,
    canAddBusiness, maxBusinesses
  } = useBusiness();

  const [isSwitchingLocal, setIsSwitchingLocal] = useState(false);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Switch Business</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
            {businesses.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={styles.modalItem}
                onPress={async () => {
                  if (b.id !== business?.id) {
                    onClose();
                    setIsSwitchingLocal(true);
                    try {
                      await switchBusiness(b.id);
                    } catch (err: any) {
                      Alert.alert('Switch Failed', err.message || 'Failed to switch business');
                    } finally {
                      setIsSwitchingLocal(false);
                    }
                  } else {
                    onClose();
                  }
                }}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.modalItemName}>{b.name}</Text>
                  <Text style={styles.modalItemSub}>
                    {b.subscription_plan ? `${b.subscription_plan.toUpperCase()} Plan` : 'Trial'}
                  </Text>
                </View>
                {b.id === business?.id && (
                  <Ionicons name="checkmark-circle" size={20} color="#F97316" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ borderTopWidth: 0.5, borderTopColor: '#E2E8F0', marginTop: 12, paddingTop: 12 }}>
            {canAddBusiness ? (
              <TouchableOpacity
                style={styles.addBusinessBtn}
                onPress={() => {
                  onClose();
                  router.push('/business-add');
                }}
              >
                <Ionicons name="add" size={18} color="#F97316" style={{ marginRight: 6 }} />
                <Text style={styles.addBusinessBtnText}>Add New Business</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.disabledAddBtn}>
                <Text style={styles.disabledAddText}>Max Limit Reached ({maxBusinesses} max)</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Switching Loader Overlay */}
      {isSwitchingLocal && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#F97316" />
          <Text style={{ marginTop: 12, fontSize: 14, color: '#475569', fontWeight: '500' }}>
            Switching business...
          </Text>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
  },
  modalItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  modalItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  addBusinessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#F97316',
    borderStyle: 'dashed',
  },
  addBusinessBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F97316',
  },
  disabledAddBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledAddText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});
