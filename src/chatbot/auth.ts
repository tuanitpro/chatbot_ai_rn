export interface ChatbotAuthProvider {
  getToken: () => string | null | Promise<string | null>;
  onTokenRefresh: () => string | null | Promise<string | null>;
  getLanguage: () => string | Promise<string>;
  getEmployeeCode: () => string | null | Promise<string | null>;
}

// Deliberately invalid credentials: replace this provider with your app services.
// Never send a refresh token to the WebView or put access tokens in URLs.
export function createDemoAuthProvider(language = 'vi'): ChatbotAuthProvider {
  let revision = 0;
  let accessToken = 'fake-chatbot-token-0';
  return {
    getToken: () => accessToken,
    onTokenRefresh: () => {
      accessToken = `fake-chatbot-token-${++revision}`;
      return accessToken;
    },
    getLanguage: () => language,
    getEmployeeCode: () => 'TLG-100215',
  };
}
