# GYRO//PLAY 🏎️🎮

**Turn your smartphone into a real-time motion game controller for high-speed desktop browser racing.**

GYRO//PLAY bridges your smartphone's native gyroscope and accelerometer with a desktop browser racing game over ultra-low-latency WebSockets (~60 FPS). Tilt your phone like a real steering wheel, trigger touch pedals for Gas, Brake, Handbrake, and Nitro boost, and watch your car drift in real-time.

---

## 🏗️ Architecture & Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Desktop Game (`client/`)** | React 18, TypeScript, Vite, HTML5 Canvas 2D | 60 FPS physics-based racing engine with audio effects and HUD |
| **Backend Server (`server/`)** | Node.js, Express, Socket.IO 4.8 | Real-time Room Manager, LAN auto-discovery, packet clamping & sync |
| **Mobile App (`mobile/`)** | React Native 0.76, `react-native-sensors` | Native IMU sensor fusion, haptics, steering gauge, and touch pedals |
| **Shared Contracts (`shared/`)** | TypeScript | Shared motion packets, telemetry, and room protocol types |

---

## ⚡ Quick Start

### 1. Install & Start Backend + Game
```bash
# Clone the repository
git clone https://github.com/dhruvilmodi111/GameController-APP.git
cd GameController-APP

# Install dependencies and start both server & desktop client
npm install
npm run dev
```

- **Desktop Game**: `http://localhost:5173`
- **Socket.IO Server**: `http://localhost:3001`

---

## 📱 Connecting Your Phone

When you open the game on your computer, click **"CONNECT CONTROLLER"** to display your unique 4-letter Room Code (e.g., `ABCD`).

### Option 1: Via USB Cable (Recommended — Zero Network Configuration)
If your phone is plugged into your laptop via USB with USB Debugging enabled:
```bash
adb reverse tcp:3001 tcp:3001
```
1. Open the mobile app.
2. Keep the server host as `http://localhost:3001`.
3. Enter the 4-letter Room Code and tap **CONNECT**.

### Option 2: Over Local Wi-Fi
1. Ensure both your laptop and phone are on the **same Wi-Fi network**.
2. Find your laptop's local IP address (`ip route` on Linux, `ipconfig` on Windows).
3. In the mobile app, tap the **Gear / Settings** icon and set the Server Host to `http://<YOUR_LAPTOP_IP>:3001`.
4. Enter the 4-letter Room Code and tap **CONNECT**.

---

## 🕹️ Driving Controls & Features

- **Tilt Steering**: Tilt phone left/right to steer. Automatically detects and supports both **Landscape** (steering wheel posture) and **Portrait** orientations.
- **1-Tap Quick Calibrate**: Tap anywhere on the circular **Steering Gauge** (or tap **CALIBRATE**) to instantly lock your current holding position as neutral zero.
- **Gas / Throttle Pedal**: Press and hold the right green pedal to accelerate. Pressing Gas automatically prioritizes forward drive over accidental tilt braking.
- **Brake Pedal & Handbrake**: Press the red pedal to decelerate or hold the handbrake to initiate high-speed drift.
- **Nitro Boost**: Tap NITRO to engage instant high-speed propulsion.
- **Driving Profiles**: Toggle between **Smooth** (relaxed highway curves) and **Precision** (sharp hairpins) in Settings.
- **Haptic Vibration**: Real-time tactile feedback on pedal taps, calibration, and in-game collisions.

---

## 📦 Building & Installing the Android APK

If you want to compile and install the standalone native Android APK directly onto your phone:

```bash
# 1. Build the APK
cd mobile/android
./gradlew assembleDebug

# 2. Install to connected device via ADB
adb install -r mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🧪 Testing

The project includes an end-to-end test suite verifying socket pairing, room isolation, sensor math, deadzone filtering, and packet clamping:

```bash
npm test
```
```
Total: 38 tests  |  ✅ 38 Passed  |  ❌ 0 Failed
```

---

## 📄 License
MIT
