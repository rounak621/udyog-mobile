import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, Alert
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../constants/theme';

interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onApply: (start: string, end: string) => void;
}

const formatDateDisplay = (dateStr: string, placeholder: string) => {
  if (!dateStr) return placeholder;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const dateToYmd = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function DateRangePicker({ startDate, endDate, onApply }: DateRangePickerProps) {
  const [tempStart, setTempStart] = useState<string>(startDate);
  const [tempEnd, setTempEnd] = useState<string>(endDate);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const handleStartChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      const ymd = dateToYmd(selectedDate);
      setTempStart(ymd);
      if (tempEnd && ymd > tempEnd) {
        setTempEnd(ymd);
      }
    }
  };

  const handleEndChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      const ymd = dateToYmd(selectedDate);
      if (tempStart && ymd < tempStart) {
        Alert.alert('Invalid Date Range', 'End date cannot be earlier than start date.');
        setTempEnd(tempStart);
      } else {
        setTempEnd(ymd);
      }
    }
  };

  const handleApplyPress = () => {
    onApply(tempStart, tempEnd);
  };

  const startDateObj = tempStart ? new Date(tempStart + 'T00:00:00') : new Date();
  const endDateObj = tempEnd ? new Date(tempEnd + 'T00:00:00') : new Date();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.dateBox}
        onPress={() => setShowStartPicker(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={14} color={Colors.primary} style={{ marginRight: 6 }} />
        <Text style={styles.dateText} numberOfLines={1}>
          {formatDateDisplay(tempStart, 'Start Date')}
        </Text>
      </TouchableOpacity>

      <Text style={styles.toText}>to</Text>

      <TouchableOpacity
        style={styles.dateBox}
        onPress={() => setShowEndPicker(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={14} color={Colors.primary} style={{ marginRight: 6 }} />
        <Text style={styles.dateText} numberOfLines={1}>
          {formatDateDisplay(tempEnd, 'End Date')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.applyBtn} onPress={handleApplyPress} activeOpacity={0.8}>
        <Ionicons name="checkmark" size={18} color="#fff" />
      </TouchableOpacity>

      {showStartPicker && (
        <DateTimePicker
          value={isNaN(startDateObj.getTime()) ? new Date() : startDateObj}
          mode="date"
          display="default"
          onChange={handleStartChange}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={isNaN(endDateObj.getTime()) ? new Date() : endDateObj}
          mode="date"
          display="default"
          onChange={handleEndChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  dateBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  toText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  applyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
