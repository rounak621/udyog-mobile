import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { getPdfViewerHtml } from '../../utils/pdfViewerHtml';
import { Colors } from '../../constants/theme';
import { api } from '../../services/api';

export default function OrderPdfPreviewScreen() {
  const { shareToken } = useLocalSearchParams<{ shareToken: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (!shareToken || hasError) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Invoice Preview</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
          <Text style={styles.errorText}>
            {!shareToken ? 'Preview token is missing.' : 'Failed to generate PDF preview. Please try downloading instead.'}
          </Text>
        </View>
      </View>
    );
  }

  const pdfUrl = `${api.defaults.baseURL}/public/rental/${shareToken}/pdf?mode=inline`;
  const pdfViewerHtml = getPdfViewerHtml(pdfUrl);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invoice Preview</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* WebView Container */}
      <View style={{ flex: 1, position: 'relative', backgroundColor: '#fff' }}>
        <WebView
          source={{ html: pdfViewerHtml }}
          style={{ flex: 1, backgroundColor: '#F8FAFC' }}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => setHasError(true)}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'error') setHasError(true);
            } catch {}
          }}
        />
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Generating Preview...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontSize: 14, color: Colors.textSecondary, marginTop: 10, textAlign: 'center' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { fontSize: 13, color: Colors.textSecondary, marginTop: 10, fontWeight: '500' },
});
