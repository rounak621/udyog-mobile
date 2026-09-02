import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Radius, Spacing } from '../../constants/theme';

interface MayaQuotationCardProps {
  draft: any;
  isCreatingQuotation: boolean;
  onEdit: () => void;
  onCreate: () => void;
  onClose: () => void;
  isStandalone?: boolean;
}

export const MayaQuotationCard: React.FC<MayaQuotationCardProps> = ({
  draft,
  isCreatingQuotation,
  onEdit,
  onCreate,
  onClose,
  isStandalone = false,
}) => {
  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const partyName = draft.walk_in_name || draft.customer_name || draft.party_name || 'Walk-in';

  return (
    <View style={[styles.card, isStandalone && { marginTop: 0 }]}>
      {/* Card Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Ionicons name="document-text" size={14} color="#8B5CF6" />
          </View>
          <Text style={styles.headerTitle}>Quotation Ready</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Estimate</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.closeBtn}
          disabled={isCreatingQuotation}
        >
          <Ionicons name="close" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* Party & Validity Box */}
      <View style={styles.partyBox}>
        <View style={styles.partyRow}>
          <Text style={styles.partyLabel}>Party</Text>
          <View style={styles.partyNameWrap}>
            <Text style={styles.partyValue}>{partyName}</Text>
            {draft.fuzzy_matched && (
              <View style={styles.matchedTag}>
                <Text style={styles.matchedTagText}>matched</Text>
              </View>
            )}
          </View>
        </View>
        {draft.valid_until ? (
          <View style={styles.partyRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="calendar-outline" size={12} color="#64748B" />
              <Text style={styles.partyLabel}>Valid Until</Text>
            </View>
            <Text style={[styles.partyValue, { color: '#6366F1' }]}>{draft.valid_until}</Text>
          </View>
        ) : null}
      </View>

      {/* Line Items */}
      <View style={styles.itemsList}>
        {(draft.items || []).map((item: any, i: number) => {
          const qty = Number(item.qty || item.quantity || 1);
          const rate = Number(item.rate || item.unit_price || 0);
          const amount = item.amount !== undefined ? Number(item.amount) : qty * rate;

          return (
            <View key={i} style={styles.itemRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.itemName}>
                  {item.name || 'Item'} × {qty} {item.unit || 'pcs'}
                </Text>
                {item.hsn_source === 'history' && (
                  <View style={styles.historyTag}>
                    <Text style={styles.historyTagText}>history</Text>
                  </View>
                )}
              </View>
              <Text style={styles.itemAmount}>{fmt(amount)}</Text>
            </View>
          );
        })}
      </View>

      {/* Total row */}
      <View style={styles.totalBox}>
        <Text style={styles.totalLabel}>Estimated Total</Text>
        <Text style={styles.totalValue}>{fmt(draft.total_amount || 0)}</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.btnOutline}
          onPress={onClose}
          disabled={isCreatingQuotation}
        >
          <Text style={styles.btnOutlineText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnOutline}
          onPress={onEdit}
          disabled={isCreatingQuotation}
        >
          <Text style={styles.btnOutlineText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnSolid, isCreatingQuotation && styles.btnSolidDisabled]}
          onPress={onCreate}
          disabled={isCreatingQuotation}
          activeOpacity={0.8}
        >
          {isCreatingQuotation ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.btnSolidText}>Creating...</Text>
            </View>
          ) : (
            <View style={styles.loadingRow}>
              <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.btnSolidText}>Create Quotation</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#8B5CF6',
    width: '100%',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  badge: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: '#8B5CF6',
    fontSize: 10,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  partyBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    gap: 6,
  },
  partyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partyLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  partyNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  partyValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  matchedTag: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  matchedTagText: {
    fontSize: 9,
    color: '#16A34A',
    fontWeight: '600',
  },
  itemsList: {
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F5F9',
  },
  itemName: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  historyTag: {
    backgroundColor: '#F1F5F9',
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  historyTagText: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '500',
  },
  itemAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F5F3FF',
    borderRadius: 8,
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#7C3AED',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  btnOutlineText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '600',
  },
  btnSolid: {
    flex: 1.6,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  btnSolidDisabled: {
    backgroundColor: '#C4B5FD',
  },
  btnSolidText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
