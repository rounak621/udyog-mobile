import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { recordError } from '../services/crashReporting';
import { Colors } from '../constants/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    recordError(error, true, {
      componentStack: errorInfo?.componentStack || 'unknown',
    });
  }

  handleRestart = (): void => {
    this.setState({ hasError: false, error: null, showDetails: false });
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <Ionicons name="alert-circle-outline" size={48} color="#EA580C" />
            </View>

            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              An unexpected error occurred. You can restart the app or try again to resume your work.
            </Text>

            <TouchableOpacity
              style={styles.restartBtn}
              onPress={this.handleRestart}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={18} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.restartBtnText}>Restart App</Text>
            </TouchableOpacity>

            {this.state.error && (
              <View style={styles.detailsContainer}>
                <TouchableOpacity
                  onPress={this.toggleDetails}
                  style={styles.detailsToggle}
                  activeOpacity={0.7}
                >
                  <Text style={styles.detailsToggleText}>
                    {this.state.showDetails ? 'Hide error details' : 'Show error details'}
                  </Text>
                  <Ionicons
                    name={this.state.showDetails ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color="#64748B"
                  />
                </TouchableOpacity>

                {this.state.showDetails && (
                  <ScrollView style={styles.errorBox}>
                    <Text style={styles.errorText}>
                      {this.state.error.name}: {this.state.error.message}
                    </Text>
                    {this.state.error.stack && (
                      <Text style={styles.stackText}>{this.state.error.stack}</Text>
                    )}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    maxWidth: 320,
  },
  restartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    minWidth: 200,
  },
  restartBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  detailsContainer: {
    marginTop: 24,
    width: '100%',
    alignItems: 'center',
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  detailsToggleText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  errorBox: {
    marginTop: 8,
    maxHeight: 180,
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: '#F87171',
    fontFamily: 'monospace',
    fontSize: 11,
    marginBottom: 6,
  },
  stackText: {
    color: '#94A3B8',
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 14,
  },
});

export default ErrorBoundary;
