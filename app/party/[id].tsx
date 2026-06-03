import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';

export default function PartyDetailScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Party Detail — Coming Soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 16, color: Colors.textSecondary },
});
