import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Radius, Spacing } from '../../constants/theme';

export interface ConvertQuotationProposalData {
  quotation_id: string;
  quotation_number: string;
  customer_name: string;
  total_amount: number;
}

interface MayaConvertQuotationCardProps {
  proposal: ConvertQuotationProposalData;
  isConverting: boolean;
  onConfirm: () => void;
  onClose: () => void;
  isStandalone?: boolean;
}

export const MayaConvertQuotationCard: React.FC<MayaConvertQuotationCardProps> = ({
  proposal,
  isConverting,
  onConfirm,
  onClose,
  isStandalone = false,
}) => {
  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

  return (
    <View style={[styles.card, isStandalone && { marginTop: 0 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Ionicons name="swap-horizontal" size={14} color="#2563EB" />
          </View>
          <Text style={styles.headerTitle}>Convert to Invoice</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Quotation</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.closeBtn}
          disabled={isConverting}
        >
          <Ionicons name="close" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* Quotation Details */}
      <View style={styles.detailsBox}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Quotation #</Text>
          <Text style={styles.detailValueBold}>{proposal.quotation_number || '—'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Party</Text>
          <Text style={styles.detailValueBold}>{proposal.customer_name || 'Customer'}</Text>
        </View>
        <View style={[styles.detailRow, { marginBottom: 0 }]}>
          <Text style={styles.detailLabel}>Total Amount</Text>
          <Text style={styles.amountValue}>{fmt(proposal.total_amount)}</Text>
        </View>
      </View>

      {/* Informational Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={15} color="#0284C7" />
        <Text style={styles.infoBannerText}>
          Sales invoice create hone par GST aur sales ledger mein record ho jayega.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={onClose}
          disabled={isConverting}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.convertBtn, isConverting && styles.convertBtnDisabled]}
          onPress={onConfirm}
          disabled={isConverting}
          activeOpacity={0.8}
        >
          {isConverting ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.convertBtnText}>Converting...</Text>
            </View>
          ) : (
            <View style={styles.loadingRow}>
              <Ionicons name="checkmark-done" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.convertBtnText}>Convert to Invoice</Text>
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
    borderColor: '#3B82F6',
    width: '100%',
    shadowColor: '#3B82F6',
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
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  badge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: '#2563EB',
    fontSize: 10,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  detailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  detailValueBold: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  amountValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563EB',
  },
  infoBanner: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  infoBannerText: {
    fontSize: 11,
    color: '#0369A1',
    flex: 1,
    lineHeight: 15,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '600',
  },
  convertBtn: {
    flex: 1.8,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  convertBtnDisabled: {
    backgroundColor: '#93C5FD',
  },
  convertBtnText: {
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
