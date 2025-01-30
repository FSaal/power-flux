## PowerFlux: Smart Barbell Motion Analysis System

A real-time barbell tracking system that measures movement speed and bar path using an IMU sensor. The system consists of embedded firmware for an M5Stack StickC Plus2 and a React Native mobile app for live visualization. It helps athletes refine their lifting technique with real-time feedback and post-workout analysis.

## Project Overview

This project tracks barbell motion using an IMU and processes the data for real-time visualization. Key components:

- **Embedded Firmware (C++)**: Runs on M5Stack StickC Plus2 (ESP32-PICO-V3-02, MPU6886), processes IMU data, and transmits via Bluetooth.
- **Mobile App (React Native, Expo)**: Receives and visualizes data on an Android smartphone (iOS support planned).
- **Data Processing & Analysis**: Implements motion tracking, bar path calculation, and performance analytics.

## Features

### Implemented ✅
- High-frequency IMU data acquisition and processing
- Sensor calibration process with live feedback
- Efficient Bluetooth Low Energy (BLE) communication protocol
- Live data visualization with real-time acceleration display
- Session recording with SQLite storage and export capabilities
- Responsive app UI

### Planned ⏳
- Enhanced calibration process with temperature compensation
- Bar path reconstruction using sensor fusion algorithms
- Advanced motion analysis (zero-velocity detection, drift compensation)
- Machine learning-based exercise classification
- Automatic rep detection and form analysis
- iOS support & web dashboard
- Cloud synchronization and sharing features

## Getting Started

### Prerequisites
- **Embedded**: [PlatformIO](https://platformio.org/) (VS Code extension required)
- **Mobile App**: [Node.js](https://nodejs.org/), [Expo](https://expo.dev/)

### Development Setup

1. **Clone the Repository**
```bash
git clone https://github.com/FSaal/power-flux.git
cd powerflux
```

2. **Embedded Development**
```bash
# Open the firmware project in VS Code with PlatformIO
cd embedded

# Install dependencies and build
pio lib install
pio run

# Upload to M5StickC Plus2 (with device connected)
pio run -t upload

# Monitor serial output (optional)
pio device monitor
```

3. **Mobile Application**
```bash
# Install dependencies
cd mobile-app
npm install

# Start development server
npx expo start
```

### Running on Physical Device

1. Install Expo Go app on your smartphone:
   - [Android Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)

2. Connect your phone:
   - Ensure your phone and development machine are on the same WiFi network
   - Open Expo Go app on your phone
   - Scan the QR code shown in the terminal with:
     - Android: Use the Expo Go app to scan
     - iOS: Use the Camera app to scan

3. Development Options:
```bash
# Start with specific platform
npx expo start --android
npx expo start --ios

# Start with clear cache if experiencing issues
npx expo start -c

# For standalone development builds
npm run android  # Make sure an Android device/emulator is connected
npm run ios      # Requires MacOS with Xcode
```

### Common Issues

- Ensure Bluetooth is enabled on your development device
- For Android, location permissions must be granted for BLE scanning
- If build fails, try clearing the build cache: `pio run -t clean`
- For mobile app, if metro bundler gets stuck, try: `expo start -c`

## Technical Details

The project demonstrates expertise in:
- Real-time embedded systems programming
- Sensor fusion and signal processing
- Mobile app development with React Native
- BLE protocol implementation
- TypeScript and modern JavaScript practices

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.