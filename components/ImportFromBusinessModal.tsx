import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, ScrollView, ActivityIndicator, Alert
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '../constants/theme';
import { api } from '../services/api';
import { showApiError } from '../utils/apiError';

interface ImportableBusiness {
  id: string;
  name: string;
  business_type?: string;
  gst_enabled?: boolean;
}

interface ImportFromBusinessModalProps {
  visible: boolean;
  onClose: () => void;
  entityType: 'parties' | 'items';
  currentBusinessId: string;
  onSuccess: () => void;
}

export default function ImportFromBusinessModal({
  visible,
  onClose,
  entityType,
  currentBusinessId,
  onSuccess,
}: ImportFromBusinessModalProps) {
  const [businesses, setBusinesses] = useState<ImportableBusiness[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const entityTitle = entityType === 'parties' ? 'Parties' : 'Products';

  useEffect(() => {
    if (!visible) return;
    setSelectedBusinessId(null);
    loadImportableBusinesses();
  }, [visible]);

  const loadImportableBusinesses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/businesses/importable');
      const list: ImportableBusiness[] = res.data || [];
      const filtered = list.filter((b) => b.id !== currentBusinessId);
      setBusinesses(filtered);
      if (filtered.length === 1) {
        setSelectedBusinessId(filtered[0].id);
      }
    } catch (err) {
      console.log('Error fetching importable businesses:', err);
      showApiError(err, 'Failed to load other businesses');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedBusinessId) {
      Alert.alert('Select Business', 'Please select a source business to import from.');
      return;
    }

    try {
      setImporting(true);
      const endpoint = entityType === 'parties'
        ? `/parties/import?business_id=${currentBusinessId}`
        : `/items/import?business_id=${currentBusinessId}`;

      const res = await api.post(endpoint, {
        source_business_id: selectedBusinessId,
      });

      const { imported, skipped, total_source, total } = res.data;
      const totalCount = total_source ?? total ?? (imported + skipped);
      onClose();
      Alert.alert(
        'Import Successful',
        `Imported ${imported} of ${totalCount} ${entityTitle.toLowerCase()}.\n(${skipped} existing ${entityTitle.toLowerCase()} safely skipped as duplicates)`
      );
      onSuccess();
    } catch (err: any) {
      console.log(`Import ${entityTitle} error:`, err);
      showApiError(err, `Failed to import ${entityTitle.toLowerCase()}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Import {entityTitle}</Text>
              <Text style={styles.modalSub}>
                Copy {entityTitle.toLowerCase()} from another business into this business
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={importing} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={18} color="#2563EB" style={{ marginRight: 8, marginTop: 1 }} />
            <Text style={styles.infoText}>
              {entityType === 'parties'
                ? 'Matches existing parties by GSTIN or Name + Phone. Duplicates are safely skipped.'
                : 'Matches existing products by name. Duplicates are safely skipped. Non-GST destination businesses will have rates set to 0%.'}
            </Text>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Finding other businesses...</Text>
            </View>
          ) : businesses.length === 0 ? (
            <View style={styles.centerBox}>
              <Ionicons name="business-outline" size={36} color={Colors.textMuted} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyTitle}>No Other Businesses</Text>
              <Text style={styles.emptySub}>
                You don't have any other businesses under your account to import from.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Select Source Business</Text>
              <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
                {businesses.map((b) => {
                  const isSelected = selectedBusinessId === b.id;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.bizItem, isSelected && styles.bizItemSelected]}
                      onPress={() => setSelectedBusinessId(b.id)}
                      disabled={importing}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.bizName, isSelected && styles.bizNameSelected]}>
                          {b.name}
                        </Text>
                        {b.business_type ? (
                          <Text style={styles.bizType}>{b.business_type}</Text>
                        ) : null}
                      </View>
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={isSelected ? Colors.primary : Colors.textMuted}
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Actions */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.cancelBtn]}
                  onPress={onClose}
                  disabled={importing}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.btn,
                    styles.importBtn,
                    (!selectedBusinessId || importing) && styles.disabledBtn
                  ]}
                  onPress={handleImport}
                  disabled={!selectedBusinessId || importing}
                >
                  {importing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.importBtnText}>Import {entityTitle}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderWidth: 0.5,
    borderColor: '#BFDBFE',
    borderRadius: Radius.md,
    padding: 10,
    marginBottom: 14,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  bizItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  bizItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF7ED',
  },
  bizName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  bizNameSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  bizType: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelBtn: {
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  importBtn: {
    backgroundColor: Colors.primary,
  },
  importBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabledBtn: {
    opacity: 0.5,
  },
});
