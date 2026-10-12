# Chatbot AI — React Native sample

Bản chuyển từ `chatbot_ai_flutter`, giữ chatbot web của `chat.antt.tech` trong `react-native-webview`. App mặc định mở **V2**; chọn V1 trên màn hình chính để thử direct link.

| | V1 — Direct link | V2 — Widget + iframe |
|---|---|---|
| Nội dung | `/embed?mode=mobile` | HTML cục bộ tải `widget.js?mode=mobile&auto_init=false` |
| Auth/context từ native | Không | Token, renew token, ngôn ngữ, mã nhân viên |
| Điều khiển | Đóng/phóng to từ header web | Callback công khai của `ChatWidget.init()` |

Có avatar GIF 96 px và fallback, popup cao 85% / rộng tối đa 480, safe area, xử lý bàn phím, loading, timeout 30 giây và nút thử lại/đóng khi lỗi. Bấm ngoài và Android Back không đóng popup; dùng nút header chatbot.

## Chạy

Dùng Node **22.13+ (nhánh 22)** hoặc **24.3+ (nhánh 24)** theo yêu cầu React Native 0.87; Node 25 hiện cảnh báo engine.

```sh
npm install
npm start
# Terminal khác:
npm run android
```

Android cần JDK 17+ và Android SDK theo cấu hình project. Internet và `adjustResize` đã được khai báo. `android/app/build.gradle` thêm `animated-gif:3.7.0`, khớp Fresco của React Native 0.87. Khi nâng React Native, kiểm tra lại phiên bản này.

Trên macOS, chạy iOS sau khi cài CocoaPods:

```sh
bundle install
cd ios
bundle exec pod install
cd ..
npm run ios
```

URL mẫu dùng HTTPS nên không cần mở ATS/cleartext. Chưa triển khai luồng camera, microphone và download file.

## Cấu hình

Sửa `src/chatbot/config.ts`:

- `baseUrl`: origin HTTPS, không path hoặc dấu `/` cuối, mặc định `https://chat.antt.tech`.
- `botId`, `clientId`: bot và mã app tích hợp.
- `sessionId`: mẫu tạo một ID mỗi lần khởi động JS, dùng chung V1/V2 và giữ khi đóng/mở popup. Trong app thật, cung cấp session riêng theo người dùng; thay khi logout/đổi tài khoản và unmount popup cũ.
- `color`: hex không `#`; `language`: `vi`, `en`, `cn`.

URL params được encode. Token không được đưa vào URL, HTML host hoặc localStorage.

## Dùng popup trong app của bạn

Copy thư mục `src/chatbot`, cài `react-native-webview` và `react-native-safe-area-context`, đặt app trong `SafeAreaProvider`. Render popup có điều kiện để mỗi lần mở tạo một WebView mới:

```tsx
const [chatOpen, setChatOpen] = useState(false);

// Trong JSX:
{chatOpen && (
  <ChatbotPopupV2
    config={chatbotConfig}
    auth={authProvider}
    onClose={() => setChatOpen(false)}
    onAuthError={() => {
      setChatOpen(false);
      // Chuyển về luồng đăng nhập của app.
    }}
  />
)}
```

Import `ChatbotPopupV2` từ `src/chatbot/ChatbotPopupV2` và cấu hình từ `src/chatbot/config`. V2 nhận `auth` và callback `onAuthError` tùy chọn.

V1 là component riêng, không cần auth provider:

```tsx
import {ChatbotPopupV1} from './src/chatbot/ChatbotPopupV1';

// Trong JSX:
{chatOpen && (
  <ChatbotPopupV1
    config={chatbotConfig}
    onClose={() => setChatOpen(false)}
  />
)}
```

Hai component tự quản lý WebView và bridge của mình. `ChatbotModal` dùng chung khung popup, fullscreen, loading, timeout và giao diện lỗi/thử lại. Script V1 ở `directBridge.ts`; HTML host V2 ở `widgetHost.ts`.

## Thay auth service mẫu

`src/chatbot/auth.ts` có `createDemoAuthProvider()`, cố ý trả **token giả**. Nó kiểm tra contract bridge, không xác thực được API. Mẫu không chứa token hoặc refresh token thật.

Thay provider trong `App.tsx` bằng service của app (các service dưới đây do app bạn cung cấp):

```ts
const authProvider: ChatbotAuthProvider = {
  getToken: () => authService.getValidAccessToken(),
  onTokenRefresh: () => authService.renewAccessToken(),
  getLanguage: () => settingsService.languageCode,
  getEmployeeCode: () => userService.employeeCode,
};
```

| Getter | Kết quả |
|---|---|
| `getToken` | Access token thuần, không tiền tố `Bearer` |
| `onTokenRefresh` | Access token mới, đồng thời cập nhật auth service |
| `getLanguage` | Ngôn ngữ hiện tại; ưu tiên hơn URL lúc init |
| `getEmployeeCode` | Mã nhân viên hiện tại hoặc `null` |

Getter nhận giá trị đồng bộ hoặc Promise. Không trả refresh token sang WebView. Auth service nên dùng chung tác vụ renew đang chạy nếu nhiều phần của app cùng yêu cầu refresh. Null/lỗi khi lấy hoặc refresh token làm hiện trạng thái lỗi và gọi `onAuthError`; app chủ xử lý đăng nhập lại. Callback không nhận hoặc log dữ liệu token.

README của frontend ghi external login không cấp refresh token. Nếu dùng hình thức này, service cần tái xác thực hoặc yêu cầu đăng nhập lại thay vì giả định có endpoint refresh.

## Luồng V2

```text
React Native mở Modal → WebView tải HTML host cục bộ
→ host tải widget.js → ChatWidget.init(getters + callbacks)
→ widget tạo iframe /embed → iframe gửi CHATBOT_READY
→ widget gọi getter → ReactNativeWebView.postMessage(request)
→ native gọi auth/context service → injectJavaScript(reply)
→ Promise phía host resolve → widget gửi AUTH/LANGUAGE/EMPLOYEE_CODE vào iframe

API 401 → REFRESH_TOKEN → onTokenRefresh → native renew → AUTH → FE retry
```

HTML host dùng `baseUrl=https://chat.antt.tech/react-native-chatbot-v2`; không cần tạo endpoint server. `initialized` chỉ xác nhận widget đã init, chưa xác nhận API/hội thoại sẵn sàng. Không inject CSS vào iframe và không truy cập private API widget.

Widget kiểm tra origin, iframe source, bot ID và auth channel trước callback điều khiển. Native kiểm tra origin từ native event và path host trong envelope (WebView 14 Android chỉ trả origin trong `onMessage.url`), bridge ID, method allowlist và request ID trước khi trả dữ liệu. Request hết hạn sau 20 giây; kết quả service cũ bị bỏ qua sau retry/unmount. Top-level navigation bị giới hạn vào trang host; các iframe do widget quản lý.

Nếu đổi domain, cập nhật cả `ALLOWED_HOSTS` trong frontend `src/widget.js` và `ALLOWED_PARENT_ORIGINS` trong `src/utils/embedOrigin.ts`, build widget rồi deploy FE/script cùng nhau. Tham số `v` chỉ đổi cache key, không thay thế deploy. V1 chỉ dành cho chat public, không truyền auth/context.

## Cấu trúc

```text
App.tsx                       Màn hình sample và avatar launcher
src/chatbot/config.ts         Cấu hình chung + URL builder
src/chatbot/auth.ts           Provider contract + demo token giả
src/chatbot/ChatbotPopupV1.tsx Direct link + bridge điều khiển, không cần auth
src/chatbot/ChatbotPopupV2.tsx Widget + auth/context RPC
src/chatbot/ChatbotModal.tsx   Khung popup và trạng thái loading/error/retry
src/chatbot/directBridge.ts   Script bridge điều khiển V1
src/chatbot/widgetHost.ts     HTML host và RPC JavaScript V2
src/chatbot/bridge.ts         Encode script, kiểm tra message/origin dùng chung
__tests__/chatbot.test.tsx     Bridge, auth, refresh, origin, retry và callback tests
```

## Kiểm tra

```sh
npx tsc --noEmit
npm run lint
npm test -- --runInBand
cd android
./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
```

Đã build APK debug ARM64 và kiểm tra mở widget V2 trên Android emulator. iOS chưa build do môi trường CocoaPods chưa đủ dependency.

Unit tests mock WebView native và thực thi JavaScript host trong DOM giả; không xác nhận đăng nhập thật hoặc API trả lời. APK debug: `android/app/build/outputs/apk/debug/app-debug.apk`. Kiểm tra thêm trên iOS và thiết bị thật, nhất là bàn phím, fullscreen và luồng auth hết hạn.

Nếu chatbot trống: kiểm tra kết nối, origin/baseUrl, allowlist và phiên bản widget đã deploy. Nếu API 401: thay demo provider bằng token thật. Nếu không có nút đóng/phóng to: deploy FE có mobile callbacks.

Tham khảo API WebView: [Guide chính thức](https://github.com/react-native-webview/react-native-webview/blob/master/docs/Guide.md), [Reference](https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md).
