import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Shared popup state; each integration owns its WebView and bridge handlers.
export function useChatbotModal() {
  const [fullscreen, setFullscreen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const bridgeId = useMemo(
    () => `rn-${Date.now()}-${Math.random()}-${attempt}`,
    [attempt],
  );

  function fail() {
    setLoading(false);
    setError(true);
  }
  function finishLoading() {
    setLoading(false);
  }
  function retry() {
    setError(false);
    setLoading(true);
    setAttempt(value => value + 1);
  }

  useEffect(() => {
    if (!loading || error) {
      return;
    }
    const timer = setTimeout(() => {
      setLoading(false);
      setError(true);
    }, 30000);
    return () => clearTimeout(timer);
  }, [loading, error, attempt]);

  return {
    bridgeId,
    fullscreen,
    setFullscreen,
    loading,
    error,
    fail,
    finishLoading,
    retry,
  };
}

interface ChatbotModalProps {
  children: ReactNode;
  fullscreen: boolean;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onClose: () => void;
  errorDescription?: string;
}

export function ChatbotModal({
  children,
  fullscreen,
  loading,
  error,
  onRetry,
  onClose,
  errorDescription = 'Kiểm tra kết nối, sau đó thử lại.',
}: ChatbotModalProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      transparent
      animationType="fade"
      visible
      onRequestClose={() => {}}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.backdrop,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <View
          style={[styles.popup, fullscreen ? styles.fullscreen : styles.window]}
        >
          {children}
          {loading && !error && (
            <View pointerEvents="none" style={styles.loading}>
              <ActivityIndicator
                color="#088c45"
                accessibilityLabel="Đang tải chatbot"
              />
            </View>
          )}
          {error && (
            <View style={styles.error}>
              <Text style={styles.errorTitle}>Không thể tải chatbot</Text>
              <Text style={styles.errorText}>{errorDescription}</Text>
              <Pressable
                testID="chatbot-retry"
                accessibilityRole="button"
                style={styles.retry}
                onPress={onRetry}
              >
                <Text style={styles.retryText}>Thử lại</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.close}
                onPress={onClose}
              >
                <Text>Đóng</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popup: { backgroundColor: '#fff', overflow: 'hidden' },
  window: { width: '92%', maxWidth: 480, height: '85%', borderRadius: 20 },
  fullscreen: { width: '100%', height: '100%' },
  loading: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
  },
  error: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: { fontSize: 20, fontWeight: '600', color: '#163c2b' },
  errorText: { textAlign: 'center', marginVertical: 16, color: '#56665e' },
  retry: {
    backgroundColor: '#088c45',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  close: { padding: 16 },
});
