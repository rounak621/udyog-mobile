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
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Radius, Spacing } from '../constants/theme';
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
  const [units, setUnits] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');

  // Fetch units whenever modal opens
  useEffect(() => {
    if (visible) {
      setSearch('');
      setShowAddModal(false);
      setNewUnitName('');
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

  const exactMatchExists = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return false;
    return combinedUnits.some(u => u.toLowerCase() === q);
  }, [combinedUnits, search]);

  const handleCreateCustomUnit = async (nameToAdd?: string) => {
    const raw = (nameToAdd || newUnitName || search).trim();
    if (!raw) {
      Alert.alert('Invalid Unit', 'Please enter a valid unit name.');
      return;
    }

    // Canonical casing if already exists
    const match = combinedUnits.find(u => u.toLowerCase() === raw.toLowerCase());
    if (match) {
      onSelectUnit(match);
      onClose();
      return;
    }

    setCreating(true);
    try {
      if (businessId) {
        await unitService.createUnit(businessId, raw);
      }
      setUnits(prev => [raw, ...prev]);
      onSelectUnit(raw);
      setShowAddModal(false);
      setNewUnitName('');
      onClose();
    } catch (err) {
      // Even if network fails, allow selecting it locally so work isn't blocked
      Alert.alert(
        'Server Save Warning',
        getApiErrorMessage(err, 'Custom unit selected locally, but could not be saved to server.')
      );
      setUnits(prev => [raw, ...prev]);
      onSelectUnit(raw);
      setShowAddModal(false);
      setNewUnitName('');
      onClose();
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {showAddModal ? 'New Custom Unit' : 'Select Unit'}
              </Text>
              <Text style={styles.subtitle}>
                {showAddModal
                  ? 'Create and save unit for this business'
                  : 'Choose standard or custom unit'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (showAddModal) {
                  setShowAddModal(false);
                  setNewUnitName('');
                } else {
                  onClose();
                }
              }}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* If creating custom unit, show creation input prominently at top (always above keyboard) */}
          {showAddModal ? (
            <View style={styles.addModalContainer}>
              <Text style={styles.addModalTitle}>Custom Unit Name</Text>
              <View style={styles.addInputRow}>
                <TextInput
                  style={styles.addInput}
                  placeholder="Unit name (e.g. BUNDLE, SHIFT)"
                  placeholderTextColor={Colors.textMuted}
                  value={newUnitName}
                  onChangeText={setNewUnitName}
                  autoCapitalize="characters"
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.saveUnitBtn, creating && { opacity: 0.6 }]}
                  onPress={() => handleCreateCustomUnit(newUnitName)}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveUnitBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelUnitBtn}
                  onPress={() => {
                    setShowAddModal(false);
                    setNewUnitName('');
                  }}
                  disabled={creating}
                >
                  <Text style={styles.cancelUnitBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {/* Search Bar (at top, fully above keyboard) */}
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

              {/* Add custom unit prompt button when search doesn't match */}
              {search.trim().length > 0 && !exactMatchExists && (
                <TouchableOpacity
                  style={styles.quickAddRow}
                  onPress={() => handleCreateCustomUnit(search.trim())}
                  disabled={creating}
                >
                  <View style={styles.quickAddIconWrap}>
                    <Ionicons name="add" size={18} color="#C2410C" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quickAddTitle}>Add "{search.trim().toUpperCase()}"</Text>
                    <Text style={styles.quickAddSub}>Create and use this custom unit</Text>
                  </View>
                  {creating ? (
                    <ActivityIndicator size="small" color="#C2410C" />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color="#C2410C" />
                  )}
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Unit List */}
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
                      onClose();
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
                  {!showAddModal && (
                    <TouchableOpacity
                      style={styles.addCustomBtn}
                      onPress={() => setShowAddModal(true)}
                    >
                      <Ionicons name="add-circle-outline" size={18} color="#fff" />
                      <Text style={styles.addCustomBtnText}>Add Custom Unit</Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
            />
          )}

          {/* Bottom Custom Unit Action Bar (only when not in add mode) */}
          {!showAddModal && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.footerBtn}
                onPress={() => setShowAddModal(true)}
              >
                <Ionicons name="add" size={18} color={Colors.primary} />
                <Text style={styles.footerBtnText}>Add Custom Unit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: Radius.lg || 16,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    flexShrink: 1,
    overflow: 'hidden',
  },
  flatList: {
    flex: 1,
    flexShrink: 1,
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
  quickAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: Radius.sm,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    gap: 10,
  },
  quickAddIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9A3412',
  },
  quickAddSub: {
    fontSize: 11,
    color: '#C2410C',
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
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  addCustomBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  footer: {
    padding: 14,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    backgroundColor: '#F8FAFC',
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  footerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  addModalContainer: {
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: Radius.md,
    backgroundColor: '#FFF7ED',
  },
  addModalTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9A3412',
    marginBottom: 8,
  },
  addInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  addInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: Radius.sm,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    fontSize: 13,
    color: Colors.text,
  },
  saveUnitBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveUnitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  cancelUnitBtn: {
    paddingHorizontal: 10,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelUnitBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
