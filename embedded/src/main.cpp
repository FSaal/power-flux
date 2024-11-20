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
bool initialDisplayShown = false;
DisplayController display;

struct __attribute__((packed)) SensorPacket
{
  float x;
  float y;
  float z;
  uint32_t timestamp;
};

enum class CalibrationCommand : uint8_t
{
  START = 1,
  ABORT = 2
};

class CalibrationCallback : public BLECharacteristicCallbacks
{
  void onWrite(BLECharacteristic *pCharacteristic) override
  {
    if (!pCharacteristic || !pCharacteristic->getData())
      return;

    auto cmd = static_cast<CalibrationCommand>(pCharacteristic->getData()[0]);
    Serial.printf("[CALIB] Received command: %d\n", static_cast<int>(cmd));

    if (!setupCalibration)
      return;

    switch (cmd)
    {
    case CalibrationCommand::START:
      Serial.println("[CALIB] Starting calibration");
      setupCalibration->startCalibration();
      break;
    case CalibrationCommand::ABORT:
      Serial.println("[CALIB] Aborting calibration");
      setupCalibration->abortCalibration();
      break;
    }
  }
};

class ServerCallbacks : public BLEServerCallbacks
{
  void onConnect(BLEServer *server) override
  {
    deviceConnected = true;
  }

  void onDisconnect(BLEServer *server) override
  {
    deviceConnected = false;
    server->startAdvertising();
  }
};

bool initBLE()
{
  static constexpr const char *LOG_TAG = "[BLE_INIT]";
  try
  {
    // Initialize BLE device
    BLEDevice::init(DEVICE_NAME);
    Serial.printf("%s Device initialized as %s\n", LOG_TAG, DEVICE_NAME);

    // Create BLE server
    pServer.reset(BLEDevice::createServer());
    if (!pServer)
    {
      Serial.printf("%s Failed to create server\n", LOG_TAG);
      return false;
    }
    pServer->setCallbacks(new ServerCallbacks());

    // Create BLE service
    auto *pService = pServer->createService(SERVICE_UUID);
    if (!pService)
    {
      Serial.printf("%s Failed to create service\n", LOG_TAG);
      return false;
    }

    // Create accelerometer characteristic
    pAccCharacteristic.reset(pService->createCharacteristic(
        CHAR_ACC_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY));
    if (!pAccCharacteristic)
    {
      Serial.printf("%s Failed to create accelerometer characteristic\n", LOG_TAG);
      return false;
    }
    pAccCharacteristic->addDescriptor(new BLE2902());
    Serial.printf("%s Accelerometer characteristic created\n", LOG_TAG);

    // Create gyroscope characteristic
    pGyrCharacteristic.reset(pService->createCharacteristic(
        CHAR_GYR_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY));
    if (!pGyrCharacteristic)
    {
      Serial.printf("%s Failed to create gyroscope characteristic\n", LOG_TAG);
      return false;
    }
    pGyrCharacteristic->addDescriptor(new BLE2902());
    Serial.printf("%s Gyroscope characteristic created\n", LOG_TAG);

    // Create calibration characteristic
    pCalibCharacteristic.reset(pService->createCharacteristic(
        CHAR_CALIB_UUID,
        BLECharacteristic::PROPERTY_READ |
            BLECharacteristic::PROPERTY_WRITE |
            BLECharacteristic::PROPERTY_NOTIFY));
    if (!pCalibCharacteristic)
    {
      Serial.printf("%s Failed to create calibration characteristic\n", LOG_TAG);
      return false;
    }
    pCalibCharacteristic->addDescriptor(new BLE2902());
    pCalibCharacteristic->setCallbacks(new CalibrationCallback());
    Serial.printf("%s Calibration characteristic created\n", LOG_TAG);

    // Initialize calibration handler
    setupCalibration.reset(new SetupCalibration(pCalibCharacteristic.get(), display));
    if (!setupCalibration)
    {
      Serial.printf("%s Failed to initialize calibration handler\n", LOG_TAG);
      return false;
    }

    // ... rest of initialization code ...

    // Start service and advertising
    pService->start();
    pServer->getAdvertising()->start();

    return true;
  }
  catch (const std::exception &e)
  {
    Serial.printf("%s Exception during initialization: %s\n", LOG_TAG, e.what());
    return false;
  }
  catch (...)
  {
    Serial.printf("%s Unknown exception during initialization\n", LOG_TAG);
    return false;
  }
}
void setup()
{
  M5.begin();
  display.begin();
  Serial.begin(115200);

  if (!M5.Imu.begin())
  {
    Serial.println("[IMU] IMU initialization failed");
    M5.Lcd.println("[IMU] IMU initialization failed");
    while (true)
    {
      delay(1000); // Halt execution
    }
  }

  if (!initBLE())
  {
    Serial.println("[BLE] BLE initialization failed");
    M5.Lcd.println("[IMU] BLE initialization failed");
    while (true)
    {
      delay(1000); // Halt execution
    }
  }

  Serial.println("[SETUP] All components initialized");
}

void loop()
{
  static uint32_t lastConnectionCheck = 0;
  static uint32_t lastUpdate = 0;
  static bool lastConnectionState = false;
  static constexpr uint32_t CONNECTION_CHECK_INTERVAL = 1000; // 1 Hz check rate
  static constexpr uint32_t UPDATE_INTERVAL = 20;             // 50 Hz update rate
  static constexpr uint32_t DELAY_MS = 5;                     // Loop delay in ms

  // Update button states and handle display timeout
  display.update();
  const uint32_t currentTime = millis();

  // Ensure initial display state is shown at start
  if (!initialDisplayShown)
  {
    display.updateStatus(false, false);
    initialDisplayShown = true;
  }

  // Periodically verify connection state and update display
  if (currentTime - lastConnectionCheck >= CONNECTION_CHECK_INTERVAL)
  {
    bool connectionState = pServer && pServer->getConnectedCount() > 0;
    if (lastConnectionState != connectionState)
    {
      Serial.printf("[BLE] Connection state changed to %s\n", connectionState ? "connected" : "disconnected");
      deviceConnected = connectionState;
      lastConnectionState = connectionState;
      display.wakeDisplay();
      display.updateStatus(deviceConnected, false);
    }
    lastConnectionCheck = currentTime;
  }

  // Handle calibration process
  if (setupCalibration && setupCalibration->isCalibrationInProgress())
  {
    setupCalibration->processCalibration();
    delay(10);
    return;
  }

  // Process sensor data
  if (currentTime - lastUpdate >= UPDATE_INTERVAL && deviceConnected)
  {
    float ax{}, ay{}, az{}, gx{}, gy{}, gz{};
    M5.Imu.getAccelData(&ax, &ay, &az);
    M5.Imu.getGyroData(&gx, &gy, &gz);

    // Send accelerometer data*
    SensorPacket accPacket{ax, ay, az, currentTime};
    pAccCharacteristic->setValue(reinterpret_cast<uint8_t *>(&accPacket), sizeof(SensorPacket));
    pAccCharacteristic->notify();
    // Send gyroscope data*
    SensorPacket gyrPacket{gx, gy, gz, currentTime};
    pGyrCharacteristic->setValue(reinterpret_cast<uint8_t *>(&gyrPacket), sizeof(SensorPacket));
    pGyrCharacteristic->notify();

    lastUpdate = currentTime;
  }

  delay(DELAY_MS);
}