import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Radius } from '../constants/theme';
import { unitService } from '../services/unitService';
import { getApiErrorMessage } from '../utils/apiError';

export interface UnitPickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedUnit?: string;
  onSelectUnit: (unit: string) => void;
  businessId?: string;
  currentValue?: string;
}

export const UnitPickerModal: React.FC<UnitPickerModalProps> = ({
  visible,
  onClose,
  selectedUnit,
  onSelectUnit,
  businessId,
  currentValue,
}) => {
  const insets = useSafeAreaInsets();
  const [units, setUnits] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [saving, setSaving] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Fetch units whenever modal opens
  useEffect(() => {
    if (visible) {
      setSearch('');
      setIsCreating(false);
      setNewUnitName('');
      setInlineError('');
      loadUnits();
    }
  }, [visible, businessId]);

  const loadUnits = async () => {
    setLoading(true);
    try {
      if (businessId) {
        const fetched = await unitService.getUnits(businessId);
        setUnits(fetched);
      } else {
        const fetched = await unitService.getUnits('');
        setUnits(fetched);
      }
    } catch {
      // unitService already handles fallback
    } finally {
      setLoading(false);
    }
  };

  // Combine fetched units with currentValue and selectedUnit, sorted alphabetically (case-insensitive)
  const combinedUnits = useMemo(() => {
    const map = new Map<string, string>(); // upperCaseKey -> originalCasing

    // 1. Existing / fetched units
    for (const u of units) {
      const trimmed = (u || '').trim();
      if (trimmed && !map.has(trimmed.toUpperCase())) {
        map.set(trimmed.toUpperCase(), trimmed);
      }
    }

    // 2. currentValue (if line item has an existing unit not in server list)
    if (currentValue && currentValue.trim()) {
      const trimmed = currentValue.trim();
      if (!map.has(trimmed.toUpperCase())) {
        map.set(trimmed.toUpperCase(), trimmed);
      }
    }

    // 3. selectedUnit (if selected unit not in server list)
    if (selectedUnit && selectedUnit.trim()) {
      const trimmed = selectedUnit.trim();
      if (!map.has(trimmed.toUpperCase())) {
        map.set(trimmed.toUpperCase(), trimmed);
      }
    }

    // 4. Sort alphabetically (case-insensitive), mixing standard and custom units naturally
    const list = Array.from(map.values());
    list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    return list;
  }, [units, currentValue, selectedUnit]);

  // Filtered by search query
  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return combinedUnits;
    return combinedUnits.filter(u => u.toLowerCase().includes(q));
  }, [combinedUnits, search]);

  const handleClose = () => {
    setIsCreating(false);
    setNewUnitName('');
    setInlineError('');
    setSearch('');
    Keyboard.dismiss();
    onClose();
  };

  const handleCancel = () => {
    setIsCreating(false);
    setNewUnitName('');
    setInlineError('');
    Keyboard.dismiss();
  };

  const handleSave = async () => {
    const trimmed = newUnitName.trim();
    if (!trimmed) {
      setInlineError('Please enter a unit name.');
      return;
    }

    // Canonical check: if unit already exists in combined list (case-insensitive)
    const existing = combinedUnits.find(
      u => u.toUpperCase().trim() === trimmed.toUpperCase()
    );
    if (existing) {
      onSelectUnit(existing);
      handleClose();
      return;
    }

    setSaving(true);
    setInlineError('');
    try {
      if (businessId) {
        await unitService.createUnit(businessId, trimmed);
      }
      setUnits(prev => [trimmed, ...prev]);
      onSelectUnit(trimmed);
      handleClose();
    } catch (err) {
      setInlineError(getApiErrorMessage(err, 'Failed to save unit. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Select Unit</Text>
              <Text style={styles.subtitle}>Choose standard or custom unit</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search or enter unit (e.g. PCS, BOX)..."
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="characters"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Middle: Alphabetical Unit List (Always in the tree) */}
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : (
            <FlatList
              style={styles.flatList}
              data={filteredUnits}
              keyExtractor={(item, idx) => `${item}_${idx}`}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isSelected =
                  (selectedUnit || '').toUpperCase().trim() === item.toUpperCase().trim();
                return (
                  <TouchableOpacity
                    style={[styles.unitRow, isSelected && styles.unitRowSelected]}
                    onPress={() => {
                      onSelectUnit(item);
                      handleClose();
                    }}
                  >
                    <Text style={[styles.unitText, isSelected && styles.unitTextSelected]}>
                      {item}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No matching units found.</Text>
                </View>
              }
            />
          )}

          {/* Bottom Footer */}
          <View
            style={[
              styles.footer,
              { paddingBottom: isKeyboardVisible ? 12 : Math.max(insets.bottom, 16) },
            ]}
          >
            {!isCreating ? (
              <TouchableOpacity
                style={styles.createBtn}
                onPress={() => {
                  if (!newUnitName && search.trim()) {
                    setNewUnitName(search.trim());
                  }
                  setInlineError('');
                  setIsCreating(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={18} color={Colors.primary} />
                <Text style={styles.createBtnText}>+ Create custom unit</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.createForm}>
                <Text style={styles.formLabel}>Custom unit name</Text>
                <TextInput
                  style={[styles.formInput, inlineError ? styles.formInputError : null]}
                  placeholder="Unit name (e.g. BUNDLE, SHIFT)"
                  placeholderTextColor={Colors.textMuted}
                  value={newUnitName}
                  onChangeText={(val) => {
                    setNewUnitName(val);
                    if (inlineError) setInlineError('');
                  }}
                  autoCapitalize="characters"
                  autoFocus
                  editable={!saving}
                />
                {inlineError ? (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle" size={14} color="#DC2626" />
                    <Text style={styles.errorText}>{inlineError}</Text>
                  </View>
                ) : null}
                <View style={styles.formActionRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={handleCancel}
                    disabled={saving}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                    activeOpacity={0.7}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveBtnText}>Save Unit</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    width: '100%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    marginLeft: 8,
  },
  flatList: {
    flex: 1,
    flexShrink: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.sm,
    marginVertical: 2,
  },
  unitRowSelected: {
    backgroundColor: '#FFF7ED',
  },
  unitText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  unitTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyBox: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    backgroundColor: '#F8FAFC',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
  },
  createBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EA580C',
  },
  createForm: {
    gap: 8,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  formInput: {
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.text,
    width: '100%',
  },
  formInputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
  },
  formActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
