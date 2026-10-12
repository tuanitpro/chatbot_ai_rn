import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChatbotPopupV1 } from './src/chatbot/ChatbotPopupV1';
import { ChatbotPopupV2 } from './src/chatbot/ChatbotPopupV2';
import { createDemoAuthProvider } from './src/chatbot/auth';
import { chatbotConfig } from './src/chatbot/config';

function Home() {
  const [variant, setVariant] = useState<'v1' | 'v2'>('v2');
  const [open, setOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const auth = useMemo(
    () => createDemoAuthProvider(chatbotConfig.language),
    [],
  );

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.brand}>ANTT / CHATBOT AI</Text>
        <Text style={styles.tag}>REACT NATIVE SAMPLE</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>TRỢ LÝ CỦA BẠN</Text>
        <Text style={styles.title}>Xin chào, tôi có thể giúp gì cho bạn?</Text>
        <Text style={styles.description}>
          Nhấn avatar để mở chatbot và bắt đầu cuộc trò chuyện.
        </Text>
        <View style={styles.options}>
          {(['v1', 'v2'] as const).map(item => (
            <Pressable
              key={item}
              accessibilityRole="radio"
              accessibilityState={{ checked: variant === item }}
              onPress={() => setVariant(item)}
              style={[styles.option, variant === item && styles.selected]}
            >
              <Text style={styles.optionTitle}>
                {item === 'v2' ? 'V2 · Widget + bridge' : 'V1 · Direct link'}
              </Text>
              <Text style={styles.optionText}>
                {item === 'v2'
                  ? 'Token, ngôn ngữ và mã nhân viên'
                  : 'Chat public qua /embed'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.note}>
          V2 đang dùng token giả để minh họa bridge. Thay auth provider bằng
          service đăng nhập của app để chat có xác thực.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mở chatbot"
        onPress={() => setOpen(true)}
        style={styles.launcher}
      >
        {avatarError ? (
          <Text style={styles.fallback}>Chat</Text>
        ) : (
          <Image
            source={{ uri: `${chatbotConfig.baseUrl}/avatar.gif` }}
            style={styles.avatar}
            onError={() => setAvatarError(true)}
          />
        )}
      </Pressable>
      {open &&
        (variant === 'v1' ? (
          <ChatbotPopupV1
            config={chatbotConfig}
            onClose={() => setOpen(false)}
          />
        ) : (
          <ChatbotPopupV2
            config={chatbotConfig}
            auth={auth}
            onClose={() => setOpen(false)}
          />
        ))}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Home />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f8f5' },
  header: { padding: 24, borderBottomWidth: 1, borderBottomColor: '#dce8df' },
  brand: { fontSize: 17, fontWeight: '800', color: '#163c2b' },
  tag: { fontSize: 10, color: '#658171', letterSpacing: 2, marginTop: 8 },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
    paddingBottom: 100,
  },
  eyebrow: {
    color: '#088c45',
    fontWeight: '700',
    letterSpacing: 2,
    fontSize: 11,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#163c2b',
    marginTop: 16,
    lineHeight: 40,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#56665e',
    marginTop: 16,
  },
  options: { marginTop: 28, gap: 12 },
  option: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dce8df',
    backgroundColor: '#fff',
  },
  selected: { borderColor: '#088c45', backgroundColor: '#e7f4ec' },
  optionTitle: { fontWeight: '700', color: '#163c2b', fontSize: 15 },
  optionText: { marginTop: 5, color: '#56665e', fontSize: 13 },
  note: { marginTop: 20, fontSize: 12, lineHeight: 19, color: '#658171' },
  launcher: {
    position: 'absolute',
    right: 20,
    bottom: 32,
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 96, height: 96, resizeMode: 'contain' },
  fallback: {
    color: '#fff',
    backgroundColor: '#088c45',
    padding: 22,
    borderRadius: 40,
    fontWeight: '700',
  },
});
