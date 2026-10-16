# GYRO//PLAY — Your Phone. Your Motion. Your Game.

**Turn your smartphone into a real-time motion controller for high-speed browser racing.**

GYRO//PLAY bridges your smartphone's internal gyroscope and accelerometer with a desktop web browser using ultra-low-latency WebSockets. Tilt your phone like a real steering wheel, hit the ergonomic thumb triggers for Gas, Brake, and Nitro boost, and watch your hypercar drift around championship racing circuits in real-time.

GYRO//PLAY features both a **Web-based mobile controller** (zero-install browser link) and a genuine **React Native Android Mobile App** (`mobile/`) with direct native sensor hardware access.

---

## 🏎️ Tech Stack & Architecture

- **React Native Android App (`mobile/`)**: Genuine Native Android App built with React Native 0.76, direct hardware IMU integration via `react-native-sensors` (orientation fusion + gyro/accelerometer complementary filter at ~60Hz), native UI gauges, haptic feedback (`Vibration`), and low-latency `socket.io-client`.
- **Frontend Game (`client/`)**: React 18, TypeScript, Vite, HTML5 Canvas 2D Game Engine, Web Audio API procedural synthesizer, responsive HUD.
- **Backend Server (`server/`)**: Node.js, Express, Socket.IO 4.8, LAN IP auto-detection, in-memory RoomManager with session isolation and token persistence.
- **Shared (`shared/`)**: Shared TypeScript interfaces (`@gyro-play/shared`), Socket.IO event contracts, telemetry, and motion payloads.
- **Design System**: Premium minimalism with futuristic neon racing identity (`#0a0e17` background, `#121824` elevated surfaces, `#00ff88` electric lime accent, `#06b6d4` cyan boost).

---

## 📱 React Native Android App (`mobile/`)

The mobile controller is implemented as a genuine React Native Android app with native UI components and real sensor hardware streaming.

### 🌟 Native App Features

1. **Direct IMU Hardware Sensing**:
   - Accesses Android hardware orientation fusion (`pitch`, `roll`, `yaw`) and 60Hz gyroscope angular velocity with accelerometer gravity compensation.
   - `android.permission.HIGH_SAMPLING_RATE_SENSORS` configured in `AndroidManifest.xml` to prevent Android from throttling sensor events.
2. **Zero-Drift Calibration**:
   - Interactive 2-second calibration dialog. Measures variance across samples (`computeVariance`) to verify the user is holding still before storing zero-point offsets.
3. **Smooth & Precision Driving Profiles**:
   - **Smooth Mode**: Low-pass filtered (alpha = 0.18), relaxed 30° roll, 6% deadband for gentle highway curves.
   - **Precision Mode**: Snappy response (alpha = 0.42), tight 22° roll, 3% deadband for fast hairpin turns.
4. **Native Steering Gauge**:
   - High-contrast neon gauge with center zero line, deadzone bounds, dynamic lime-green fill, and live degrees readout.
5. **Ergonomic Pedals & Haptics**:
   - Left-side Brake pedal and Handbrake trigger.
   - Right-side Throttle pedal and Nitro Boost trigger.
   - Haptic vibration feedback on button presses, calibration completion, and in-game collisions.
6. **Live Telemetry HUD**:
   - Displays real-time speed in km/h, current lap, lap time, and remaining nitro fuel transmitted from the desktop game.
7. **Safe Disarm & Connection Recovery**:
   - Disarm button locks controls to safe neutral `{ steering: 0, throttle: 0, brake: 0 }`.
   - If Wi-Fi flickers, the app automatically reconnects with its stored `controllerToken` without kicking the player out.

### 🛠️ Mobile Setup & Build Guide

#### Prerequisites
- **Node.js** >= 18
- **Java JDK** 17 or 21 (`JAVA_HOME` configured)
- **Android SDK** (API 34/35) and Android command-line tools / Android Studio (`ANDROID_HOME` configured)
- Connected Android phone with **USB Debugging** enabled (or Android Virtual Device emulator)

#### 1. Running in Development Mode
Start the Metro JavaScript bundler:
```bash
cd mobile
npm start
```

In a separate terminal, launch the app on your Android device or emulator:
```bash
cd mobile
npm run android
```

#### 2. Building the Installable Android APK
To compile a standalone debug APK without opening Android Studio:
```bash
cd mobile/android
./gradlew assembleDebug
```

The generated APK will be located at:
```
mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

To install the compiled APK directly onto your connected phone via ADB:
```bash
adb install -r mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📡 Phone-to-Laptop Pairing & Networking Guide

### 1. Local Network Requirements
- **Same Wi-Fi Network**: Both devices must be connected to the same local Wi-Fi router / access point (or your laptop's Wi-Fi hotspot).
- **AP Isolation**: Ensure your Wi-Fi router does not have "AP Isolation" or "Client Isolation" enabled.

### 2. Firewall & Port Requirements
The application utilizes two ports:
- **Port 5173 (TCP)**: Vite Web Server (delivers desktop game and browser controller).
- **Port 3001 (TCP)**: Backend Express and Socket.IO server.

**Linux (UFW):**
```bash
sudo ufw allow 5173/tcp
sudo ufw allow 3001/tcp
```

**Windows Defender Firewall:**
When launching `npm run dev`, click **"Allow Access"** on the Windows Defender prompt for Node.js.

### 3. Reachable LAN IP & QR Code Generation
- The backend automatically discovers the host laptop's active network interface (e.g. `192.168.x.x`), avoiding `localhost` and virtual container bridges.
- The desktop pairing dialog generates a high-contrast QR code pointing to:
  `http://<LAPTOP_LAN_IP>:5173/controller?room=<ROOM_ID>`
- In the React Native app, simply enter the 6-letter Room Code displayed on your desktop screen. If needed, toggle "Configure Server Host" to enter your laptop's LAN IP.

---

## 🔒 Session Security & Lifecycle States

The pairing system enforces strict server-side session membership:
1. **Waiting**: Desktop session is live (`ROOM ABCD`), listening for controller connection.
2. **Connected**: The phone joins with its device metadata. Server validates that the room exists, host is online, and issues a unique `controllerToken`.
3. **Session Isolation**: Third-party takeover attempts are blocked. Unauthorized packets from unverified sockets are discarded.
4. **Reconnecting**: If Wi-Fi drops, the phone uses its stored `controllerToken` to resume its driving session without disruption.
5. **Safe Disarm**: When the controller disconnects or pauses, safe neutral controls `{ steering: 0, throttle: 0, brake: 0 }` are immediately dispatched to prevent the car from running away.

---

## 🚀 Running the Application

### 1. Install Root Dependencies
```bash
npm install
```

### 2. Start Backend & Desktop Client Concurrently
```bash
npm run dev
```
- Desktop Game: `http://localhost:5173`
- Backend Server: `http://localhost:3001`

### 3. Typecheck All Workspaces
```bash
npm run build:server
npm run build:client
cd mobile && npx tsc --noEmit
```

---

## 🧪 Automated Test Verification

GYRO//PLAY includes 38 comprehensive automated tests:
1. **Pairing System Integration Tests (`tests/test-pairing-system.mjs`)**:
   - Server health check & room creation
   - Invalid room rejection & session isolation
   - Token issuance & reconnection recovery
   - Ping-sync round trip latency measurement
   - Motion packet clamping & sequence number validation
   - Disconnect handling & safe neutral packet dispatch
2. **Mobile Controller Engine Tests (`tests/test-mobile-app.mjs`)**:
   - Hardware IMU zero-drift calibration & variance testing
   - Deadband thresholding & smooth rescaling
   - Sensitivity scaling & strict [-1.0, 1.0] clamping
   - Smooth vs Precision profile configurations
   - Inverted steering logic
   - End-to-end Socket.IO motion packet streaming from mobile client to host

### Run All Tests
```bash
npm test
```
**Output:**
```
=======================================================
  Total: 38 tests  |  ✅ 38 Passed  |  ❌ 0 Failed
=======================================================
```
