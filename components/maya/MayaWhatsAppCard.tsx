import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Radius, Spacing } from '../../constants/theme';

export interface WhatsAppProposalData {
  invoice_id: number;
  invoice_number: string;
  customer_name: string;
  phone: string;
  amount: number;
  send_type: 'invoice' | 'reminder';
}

interface MayaWhatsAppCardProps {
  proposal: WhatsAppProposalData;
  isSending: boolean;
  onSend: () => void;
  onClose: () => void;
  isStandalone?: boolean;
}

export const MayaWhatsAppCard: React.FC<MayaWhatsAppCardProps> = ({
  proposal,
  isSending,
  onSend,
  onClose,
  isStandalone = false,
}) => {
  const isReminder = proposal.send_type === 'reminder';
  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

  return (
    <View style={[styles.card, isStandalone && { marginTop: 0 }]}>
      {/* Card Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconCircle, isReminder ? styles.reminderIconBg : styles.documentIconBg]}>
            <Ionicons
              name={isReminder ? 'time' : 'logo-whatsapp'}
              size={14}
              color={isReminder ? '#D97706' : '#16A34A'}
            />
          </View>
          <Text style={styles.headerTitle}>
            {isReminder ? 'Payment Reminder' : 'WhatsApp Invoice'}
          </Text>
          <View style={[styles.badge, isReminder ? styles.reminderBadge : styles.documentBadge]}>
            <Text style={[styles.badgeText, isReminder ? styles.reminderBadgeText : styles.documentBadgeText]}>
              {isReminder ? 'Reminder' : 'Document'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.closeBtn}
          disabled={isSending}
        >
          <Ionicons name="close" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* Recipient Details */}
      <View style={styles.detailsBox}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Customer</Text>
          <Text style={styles.detailValueBold}>{proposal.customer_name || 'Customer'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>WhatsApp Phone</Text>
          <Text style={styles.detailValue}>{proposal.phone || '—'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Invoice Number</Text>
          <Text style={[styles.detailValue, { color: '#2563EB', fontWeight: '600' }]}>
            {proposal.invoice_number || '—'}
          </Text>
        </View>
        <View style={[styles.detailRow, { marginBottom: 0 }]}>
          <Text style={styles.detailLabel}>
            {isReminder ? 'Balance Due' : 'Invoice Amount'}
          </Text>
          <Text style={[styles.amountValue, isReminder ? { color: '#DC2626' } : { color: '#16A34A' }]}>
            {fmt(proposal.amount)}
          </Text>
        </View>
      </View>

      {/* Confirmation Note */}
      <Text style={styles.noteText}>
        {isReminder
          ? 'Customer ko unke WhatsApp number par payment reminder message bheja jayega.'
          : 'Customer ko unke WhatsApp number par official PDF bill bheja jayega.'}
      </Text>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={onClose}
          disabled={isSending}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sendBtn, isSending && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={isSending}
          activeOpacity={0.8}
        >
          {isSending ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.sendBtnText}>Sending...</Text>
            </View>
          ) : (
            <View style={styles.loadingRow}>
              <Ionicons name="paper-plane" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.sendBtnText}>Send on WhatsApp</Text>
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
    borderColor: '#22C55E',
    width: '100%',
    shadowColor: '#22C55E',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentIconBg: {
    backgroundColor: '#DCFCE7',
  },
  reminderIconBg: {
    backgroundColor: '#FEF3C7',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  documentBadge: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  reminderBadge: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  documentBadgeText: {
    color: '#15803D',
  },
  reminderBadgeText: {
    color: '#B45309',
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
  detailValue: {
    fontSize: 12,
    color: '#0F172A',
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
  },
  noteText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 12,
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
  sendBtn: {
    flex: 1.8,
    backgroundColor: '#16A34A',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  sendBtnDisabled: {
    backgroundColor: '#86EFAC',
  },
  sendBtnText: {
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
