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
  ABORT = 2,
  START_FULL = 3,
  START_QUICK = 4
};

/**
 * Class handling callbacks for the BLE calibration characteristic.
 */
class CalibrationCallback : public BLECharacteristicCallbacks
{
  /**
   * Called when the BLE calibration characteristic is written to.
   *
   * @param pCharacteristic The BLE characteristic that was written to.
   */
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
    case CalibrationCommand::START_FULL:
      Serial.println("[CALIB] Starting full calibration");
      setupCalibration->startFullCalibration();
      break;
    case CalibrationCommand::START_QUICK:
      Serial.println("[CALIB] Starting quick calibration");
      setupCalibration->startQuickCalibration();
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
    connectionChanged = true;
  }

  void onDisconnect(BLEServer *server) override
  {
    deviceConnected = false;
    connectionChanged = true;
    server->startAdvertising();
  }
};

/**
 * @brief Initializes the BLE stack and advertises the device.
 * @return True if initialization was successful, false otherwise.
 */
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
    setupCalibration.reset(new SetupCalibration(pCalibCharacteristic.get(), deviceDisplay));
    if (!setupCalibration)
    {
      Serial.printf("%s Failed to initialize calibration handler\n", LOG_TAG);
      return false;
    }

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
  Serial.begin(115200); // Initialize serial for debugging
  delay(1500);          // Give a moment for the serial monitor to open
  M5.begin();
  deviceDisplay.begin();

  // Initialize IMU
  if (!M5.Imu.begin())
  {
    Serial.println("[SETUP] IMU initialization failed");
    while (true)
      delay(1000);
  }
  Serial.println("[SETUP] IMU initialized");

  // Initialize BLE
  if (!initBLE())
  {
    Serial.println("[SETUP] BLE initialization failed");
    while (true)
      delay(1000);
  }
  Serial.println("[SETUP] BLE initialized");
  delay(100);
}

void loop()
{
  static uint32_t lastConnectionCheck = 0;
  static uint32_t lastUpdate = 0;
  static constexpr uint32_t CONNECTION_CHECK_INTERVAL = 1000; // 1 Hz check rate
  static constexpr uint32_t UPDATE_INTERVAL = 20;             // 50 Hz update rate
  static constexpr uint32_t DELAY_MS = 5;                     // Loop delay in ms
  uint32_t currentTime = millis();                            // Time since startup in ms

  // Update button states and handle display timeout
  deviceDisplay.update();

  // Ensure initial display state is shown at start
  if (!initialDisplayShown)
  {
    deviceDisplay.updateStatus(false, false);
    initialDisplayShown = true;
  }

  // Periodically verify connection state and update display on change
  if (currentTime - lastConnectionCheck >= CONNECTION_CHECK_INTERVAL && connectionChanged)
  {
    Serial.printf("[BLE] Connection state changed to %s\n", deviceConnected ? "connected" : "disconnected");
    deviceDisplay.updateStatus(deviceConnected, false);
    lastConnectionCheck = currentTime;
    connectionChanged = false;
  }

  // Handle calibration process
  if (setupCalibration && setupCalibration->isCalibrationInProgress())
  {
    setupCalibration->processCalibration();
    delay(10);
    return;
  }

  // Only process and send sensor data when connected to app
  if (deviceConnected && currentTime - lastUpdate >= UPDATE_INTERVAL)
  {
    float temp;
    Vector3D rawAccel, rawGyro;

    M5.Imu.getAccelData(&rawAccel.x, &rawAccel.y, &rawAccel.z);
    M5.Imu.getGyroData(&rawGyro.x, &rawGyro.y, &rawGyro.z);
    M5.Imu.getTemp(&temp);
    // Correct sensor data
    CorrectedData corrected = setupCalibration->correctSensorData(rawAccel, rawGyro, temp);

    // Send accelerometer data
    SensorPacket accPacket{
        corrected.accel.x,
        corrected.accel.y,
        corrected.accel.z,
        currentTime};
    pAccCharacteristic->setValue(reinterpret_cast<uint8_t *>(&accPacket), sizeof(SensorPacket));
    pAccCharacteristic->notify();

    // Send gyroscope data
    SensorPacket gyrPacket{
        corrected.gyro.x,
        corrected.gyro.y,
        corrected.gyro.z,
        currentTime};
    pGyrCharacteristic->setValue(reinterpret_cast<uint8_t *>(&gyrPacket), sizeof(SensorPacket));
    pGyrCharacteristic->notify();

    lastUpdate = currentTime;
  }

  delay(DELAY_MS);
}