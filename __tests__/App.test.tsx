import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { ChatbotPopupV1 } from '../src/chatbot/ChatbotPopupV1';
import { ChatbotPopupV2 } from '../src/chatbot/ChatbotPopupV2';

jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock').default;
  return mock;
});

test('avatar opens the default V2 chatbot and close returns to the home screen', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  expect(renderer.root.findAllByType(ChatbotPopupV2)).toHaveLength(0);
  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Mở chatbot' })
      .props.onPress();
  });
  const popup = renderer.root.findByType(ChatbotPopupV2);
  expect(renderer.root.findAllByType(ChatbotPopupV1)).toHaveLength(0);
  await ReactTestRenderer.act(() => popup.props.onClose());
  expect(renderer.root.findAllByType(ChatbotPopupV2)).toHaveLength(0);
  await ReactTestRenderer.act(() => {
    renderer.root
      .findAllByProps({ accessibilityRole: 'radio' })[0]
      .props.onPress();
  });
  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Mở chatbot' })
      .props.onPress();
  });
  expect(renderer.root.findAllByType(ChatbotPopupV2)).toHaveLength(0);
  const directPopup = renderer.root.findByType(ChatbotPopupV1);
  expect(directPopup.props.auth).toBeUndefined();
  await ReactTestRenderer.act(() => directPopup.props.onClose());
  await ReactTestRenderer.act(() => renderer.unmount());
});
