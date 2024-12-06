#include <M5StickCPlus2.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <memory>
#include "SetupCalibration.h"
#include "DisplayController.h"

// Device Configuration
static constexpr char DEVICE_NAME[] = "PowerFlux";
static constexpr char SERVICE_UUID[] = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
static constexpr char CHAR_ACC_UUID[] = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
static constexpr char CHAR_GYR_UUID[] = "beb5483e-36e1-4688-b7f5-ea07361b26a9";
static constexpr char CHAR_CALIB_UUID[] = "beb5483e-36e1-4688-b7f5-ea07361b26aa";

// Global state
std::unique_ptr<BLEServer> pServer;
std::unique_ptr<BLECharacteristic> pAccCharacteristic;
std::unique_ptr<BLECharacteristic> pGyrCharacteristic;
std::unique_ptr<BLECharacteristic> pCalibCharacteristic;
std::unique_ptr<SetupCalibration> setupCalibration;
bool deviceConnected = false;
bool connectionChanged = false;
bool initialDisplayShown = false;
DisplayController deviceDisplay;

static constexpr uint32_t TRIPLE_CLICK_WINDOW = 1000; // Window for triple click in ms
static constexpr uint32_t CLICK_THRESHOLD = 300;      // Max time between clicks
uint32_t lastClickTimes[3] = {0, 0, 0};               // Store last 3 click timestamps
uint8_t clickCount = 0;                               // Current click count

struct __attribute__((packed)) SensorPacket
{
  float x;
  float y;
  float z;
  uint32_t timestamp;
};

enum class CalibrationCommand : uint8_t
{
  START_QUICK = 1,
  ABORT = 2
};

class CalibrationCallback : public BLECharacteristicCallbacks
{
  void onWrite(BLECharacteristic *pCharacteristic) override
  {
    if (!pCharacteristic || !pCharacteristic->getData())
    {
      Serial.println("[CALIB] Invalid characteristic or data");
      return;
    }

    auto cmd = static_cast<CalibrationCommand>(pCharacteristic->getData()[0]);
    Serial.printf("[CALIB] Received command: %d\n", static_cast<int>(cmd));

    if (!setupCalibration)
    {
      Serial.println("[CALIB] Setup calibration instance is null");
      return;
    }

    switch (cmd)
    {
    case CalibrationCommand::START_QUICK:
      Serial.println("[CALIB] Starting quick calibration");
      setupCalibration->startQuickCalibration();
      break;
    case CalibrationCommand::ABORT:
      Serial.println("[CALIB] Aborting calibration");
      setupCalibration->abortCalibration();
      break;
    default:
      Serial.printf("[CALIB] Unknown command received: %d\n", static_cast<int>(cmd));
      break;
    }
  }
};

class ServerCallbacks : public BLEServerCallbacks
{
  void onConnect(BLEServer *server) override
  {
    deviceConnected = true;
    connectionChanged = true;
    // Add delay to allow connection to stabilize
    delay(100);
  }

  void onDisconnect(BLEServer *server) override
  {
    deviceConnected = false;
    connectionChanged = true;

    // Clear any pending notifications
    if (pAccCharacteristic)
    {
      pAccCharacteristic->notify();
    }
    if (pGyrCharacteristic)
    {
      pGyrCharacteristic->notify();
    }
    if (pCalibCharacteristic)
    {
      pCalibCharacteristic->notify();
    }

    delay(500); // Give time for cleanup

    server->getAdvertising()->start();
    deviceDisplay.updateDisplayStatus(false, false);
  }
};
void configureIMU()
{
  auto imu = M5.Imu.getImuInstancePtr(0);

  // Configure gyroscope (±500 dps, enable DLPF)
  uint8_t gyroConfig = imu->readRegister8(0x1B);
  gyroConfig &= ~(0x3 << 3); // Clear FS_SEL bits
  gyroConfig |= (0x0 << 3);  // Set to ±250 dps
  gyroConfig &= ~(0x3);      // Enable DLPF
  imu->writeRegister8(0x1B, gyroConfig);

  // Configure accelerometer (±8g)
  uint8_t accConfig = imu->readRegister8(0x1C);
  accConfig &= ~(0x3 << 3); // Clear ACCEL_FS_SEL bits
  accConfig |= (0x2 << 3);  // Set to ±8g
  imu->writeRegister8(0x1C, accConfig);

  // Configure DLPF (20Hz bandwidth)
  uint8_t config = imu->readRegister8(0x1A);
  config &= ~(0x7); // Clear DLPF_CFG bits
  config |= 0x4;    // Set to 20Hz
  imu->writeRegister8(0x1A, config);

  // Set sample rate to 100Hz (1000Hz / (9 + 1))
  imu->writeRegister8(0x19, 9);
}

bool initBLE()
{
  try
  {
    BLEDevice::init(DEVICE_NAME);
    Serial.printf("[BLE_INIT] Device initialized as %s\n", DEVICE_NAME);

    pServer.reset(BLEDevice::createServer());
    if (!pServer)
    {
      Serial.printf("[BLE_INIT] Failed to create server\n");
      return false;
    }
    pServer->setCallbacks(new ServerCallbacks());

    auto *pService = pServer->createService(SERVICE_UUID);
    if (!pService)
    {
      Serial.printf("[BLE_INIT] Failed to create service\n");
      return false;
    }

    // Create accelerometer characteristic
    pAccCharacteristic.reset(pService->createCharacteristic(
        CHAR_ACC_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY));
    if (!pAccCharacteristic)
      return false;
    pAccCharacteristic->addDescriptor(new BLE2902());

    // Create gyroscope characteristic
    pGyrCharacteristic.reset(pService->createCharacteristic(
        CHAR_GYR_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY));
    if (!pGyrCharacteristic)
      return false;
    pGyrCharacteristic->addDescriptor(new BLE2902());

    // Create calibration characteristic
    pCalibCharacteristic.reset(pService->createCharacteristic(
        CHAR_CALIB_UUID,
        BLECharacteristic::PROPERTY_READ |
            BLECharacteristic::PROPERTY_WRITE |
            BLECharacteristic::PROPERTY_NOTIFY |
            BLECharacteristic::PROPERTY_INDICATE));

    if (!pCalibCharacteristic)
      return false;

    auto *descriptor = new BLE2902();
    descriptor->setNotifications(true);
    descriptor->setIndications(true);
    pCalibCharacteristic->addDescriptor(descriptor);
    pCalibCharacteristic->setCallbacks(new CalibrationCallback());

    setupCalibration.reset(new SetupCalibration(pCalibCharacteristic.get(), deviceDisplay));
    if (!setupCalibration)
      return false;

    pService->start();
    pServer->getAdvertising()->start();
    return true;
  }
  catch (...)
  {
    return false;
  }
}

void handleButton()
{
  uint32_t currentTime = millis();

  // Always wake display on any button press
  deviceDisplay.wakeDisplay();

  // Shift previous clicks
  lastClickTimes[0] = lastClickTimes[1];
  lastClickTimes[1] = lastClickTimes[2];
  lastClickTimes[2] = currentTime;

  // Check if we have 3 clicks within the time window
  if (currentTime - lastClickTimes[0] < TRIPLE_CLICK_WINDOW &&
      (lastClickTimes[2] - lastClickTimes[1]) < CLICK_THRESHOLD &&
      (lastClickTimes[1] - lastClickTimes[0]) < CLICK_THRESHOLD)
  {
    Serial.println("Triple click detected - Resetting BLE");

    if (pServer && deviceConnected)
    {
      // Disconnect all clients
      pServer->disconnect(0);
      // onDisconnect callback will handle the cleanup
    }

    // Reset click tracking
    memset(lastClickTimes, 0, sizeof(lastClickTimes));
  }
}

void setup()
{
  Serial.begin(115200);
  delay(1000);
  M5.begin();
  deviceDisplay.begin();

  if (!M5.Imu.begin())
  {
    Serial.println("[SETUP] IMU initialization failed");
    while (true)
      delay(1000);
  }
  configureIMU();
  Serial.println("[SETUP] IMU configured");

  if (!initBLE())
  {
    Serial.println("[SETUP] BLE initialization failed");
    while (true)
      delay(1000);
  }
  Serial.println("[SETUP] BLE initialized");
  // Ensure initial display state is shown at start
  deviceDisplay.updateDisplayStatus(false, false);
}

void loop()
{
  static uint32_t lastConnectionCheck = 0;
  static uint32_t lastUpdate = 0;
  static constexpr uint32_t CONNECTION_CHECK_INTERVAL = 1000;
  static constexpr uint32_t UPDATE_INTERVAL = 50; // 20Hz sampling
  uint32_t currentTime = millis();

  M5.update();

  // Check for button press
  if (M5.BtnA.wasPressed())
  {
    handleButton();
  }

  deviceDisplay.manageDisplayState();

  // Verify connection state and update display on change
  if (currentTime - lastConnectionCheck >= CONNECTION_CHECK_INTERVAL && connectionChanged)
  {
    Serial.printf("[BLE] Connection state changed to %s\n", deviceConnected ? "connected" : "disconnected");
    deviceDisplay.updateDisplayStatus(deviceConnected, false);
    lastConnectionCheck = currentTime;
    connectionChanged = false;
  }

  if (setupCalibration && setupCalibration->isCalibrationInProgress())
  {
    setupCalibration->processCalibration();
    delay(10);
    return;
  }

  // Process and send sensor data when connected to app
  if (deviceConnected && currentTime - lastUpdate >= UPDATE_INTERVAL)
  {
    Vector3D rawAccel, rawGyro;

    M5.Imu.getAccelData(&rawAccel.x, &rawAccel.y, &rawAccel.z);
    M5.Imu.getGyroData(&rawGyro.x, &rawGyro.y, &rawGyro.z);

    CorrectedData data = setupCalibration->correctSensorData(rawAccel, rawGyro);

    // Send accelerometer data
    SensorPacket accPacket{
        data.accel.x,
        data.accel.y,
        data.accel.z,
        currentTime};
    pAccCharacteristic->setValue(reinterpret_cast<uint8_t *>(&accPacket), sizeof(SensorPacket));
    pAccCharacteristic->notify();

    // Send gyroscope data
    SensorPacket gyrPacket{
        data.gyro.x,
        data.gyro.y,
        data.gyro.z,
        currentTime};
    pGyrCharacteristic->setValue(reinterpret_cast<uint8_t *>(&gyrPacket), sizeof(SensorPacket));
    pGyrCharacteristic->notify();

    lastUpdate = currentTime;
  }
}