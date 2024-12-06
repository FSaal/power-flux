#include <M5StickCPlus2.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <memory>
#include "SetupCalibration.h"
#include "DisplayController.h"
#include "utils/logger.h"
#include "utils/error.h"
#include "config/config.h"

/**
 * @brief Main application for the PowerFlux M5Stick device
 *
 * Handles BLE communication, sensor data processing, and device management.
 * The device operates as a BLE server, providing real-time IMU data and
 * supporting device calibration.
 */

static constexpr char MODULE_NAME[] = "MAIN";

// Global state
std::unique_ptr<BLEServer> pServer;
std::unique_ptr<BLECharacteristic> pAccCharacteristic;
std::unique_ptr<BLECharacteristic> pGyrCharacteristic;
std::unique_ptr<BLECharacteristic> pCalibCharacteristic;
std::unique_ptr<SetupCalibration> setupCalibration;
bool deviceConnected = false;
bool connectionChanged = false;
DisplayController deviceDisplay;

std::array<uint32_t, 3> lastClickTimes{};

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
      Logger::error(MODULE_NAME, "Invalid characteristic or data");
      return;
    }

    auto cmd = static_cast<CalibrationCommand>(pCharacteristic->getData()[0]);
    Logger::logf(Logger::Level::INFO, MODULE_NAME, "Received command: %d", static_cast<int>(cmd));

    if (!setupCalibration)
    {
      Logger::error(MODULE_NAME, "Setup calibration instance is null");
      return;
    }

    switch (cmd)
    {
    case CalibrationCommand::START_QUICK:
      Logger::info(MODULE_NAME, "Starting quick calibration");
      setupCalibration->startQuickCalibration();
      break;
    case CalibrationCommand::ABORT:
      Logger::info(MODULE_NAME, "Aborting calibration");
      setupCalibration->abortCalibration();
      break;
    default:
      Logger::logf(Logger::Level::ERROR, MODULE_NAME, "Unknown command: %d", static_cast<int>(cmd));
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
    Logger::info(MODULE_NAME, "Device connected");
    delay(Config::Timing::POST_CONNECT_DELAY);
  }

  void onDisconnect(BLEServer *server) override
  {
    deviceConnected = false;
    connectionChanged = true;
    Logger::info(MODULE_NAME, "Device disconnected");

    if (pAccCharacteristic)
      pAccCharacteristic->notify();
    if (pGyrCharacteristic)
      pGyrCharacteristic->notify();
    if (pCalibCharacteristic)
      pCalibCharacteristic->notify();

    delay(Config::Timing::POST_DISCONNECT_DELAY);
    server->getAdvertising()->start();
    deviceDisplay.updateDisplayStatus(false, false);
  }
};

Error configureIMU()
{
  auto imu = M5.Imu.getImuInstancePtr(0);
  if (!imu)
  {
    return Error(Error::Code::IMU_INIT_FAILED, "Failed to get IMU instance");
  }

  // Configure gyroscope
  uint8_t gyroConfig = imu->readRegister8(Config::IMU::Registers::GYRO_CONFIG);
  gyroConfig &= ~(0x3 << 3); // Clear FS_SEL bits
  gyroConfig |= (Config::IMU::Values::GYRO_FS_250DPS << 3);
  gyroConfig &= ~(0x3); // Enable DLPF
  imu->writeRegister8(Config::IMU::Registers::GYRO_CONFIG, gyroConfig);

  // Configure accelerometer
  uint8_t accConfig = imu->readRegister8(Config::IMU::Registers::ACCEL_CONFIG);
  accConfig &= ~(0x3 << 3);
  accConfig |= (Config::IMU::Values::ACCEL_FS_8G << 3);
  imu->writeRegister8(Config::IMU::Registers::ACCEL_CONFIG, accConfig);

  // Configure DLPF
  uint8_t config = imu->readRegister8(Config::IMU::Registers::DLPF_CONFIG);
  config &= ~(0x7);
  config |= Config::IMU::Values::DLPF_20HZ;
  imu->writeRegister8(Config::IMU::Registers::DLPF_CONFIG, config);

  // Set sample rate
  imu->writeRegister8(Config::IMU::Registers::SAMPLE_RATE_DIV,
                      Config::IMU::Values::SAMPLE_RATE_100HZ);

  Logger::info(MODULE_NAME, "IMU configuration completed");
  return Error(Error::Code::NONE, "Success");
}

Error initBLE()
{
  try
  {
    BLEDevice::init(Config::BLE::DEVICE_NAME);
    Logger::logf(Logger::Level::INFO, MODULE_NAME, "Device initialized as %s",
                 Config::BLE::DEVICE_NAME);

    pServer.reset(BLEDevice::createServer());
    if (!pServer)
    {
      return Error(Error::Code::BLE_INIT_FAILED, "Failed to create server");
    }
    pServer->setCallbacks(new ServerCallbacks());

    auto *pService = pServer->createService(Config::BLE::SERVICE_UUID);
    if (!pService)
    {
      return Error(Error::Code::BLE_INIT_FAILED, "Failed to create service");
    }

    // Create characteristics
    pAccCharacteristic.reset(pService->createCharacteristic(
        Config::BLE::CHAR_ACC_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY));
    pAccCharacteristic->addDescriptor(new BLE2902());

    // Create gyroscope characteristic
    pGyrCharacteristic.reset(pService->createCharacteristic(
        Config::BLE::CHAR_GYR_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY));
    pGyrCharacteristic->addDescriptor(new BLE2902());

    // Create calibration characteristic
    pCalibCharacteristic.reset(pService->createCharacteristic(
        Config::BLE::CHAR_CALIB_UUID,
        BLECharacteristic::PROPERTY_READ |
            BLECharacteristic::PROPERTY_WRITE |
            BLECharacteristic::PROPERTY_NOTIFY |
            BLECharacteristic::PROPERTY_INDICATE));

    auto *descriptor = new BLE2902();
    descriptor->setNotifications(true);
    descriptor->setIndications(true);
    pCalibCharacteristic->addDescriptor(descriptor);
    pCalibCharacteristic->setCallbacks(new CalibrationCallback());

    setupCalibration.reset(new SetupCalibration(pCalibCharacteristic.get(), deviceDisplay));

    pService->start();
    pServer->getAdvertising()->start();
    Logger::info(MODULE_NAME, "BLE initialization completed successfully");
    return Error(Error::Code::NONE, "Success");
  }
  catch (...)
  {
    Logger::error(MODULE_NAME, "Unexpected error during BLE initialization");
    return Error(Error::Code::BLE_INIT_FAILED, "Unexpected error during BLE initialization");
  }
}

void handleButton()
{
  deviceDisplay.wakeDisplay();
  uint32_t currentTime = millis();

  std::copy(lastClickTimes.begin() + 1, lastClickTimes.end(), lastClickTimes.begin());
  lastClickTimes[2] = currentTime;

  if (currentTime - lastClickTimes[0] < Config::ButtonControl::TRIPLE_CLICK_WINDOW &&
      (lastClickTimes[2] - lastClickTimes[1]) < Config::ButtonControl::CLICK_THRESHOLD &&
      (lastClickTimes[1] - lastClickTimes[0]) < Config::ButtonControl::CLICK_THRESHOLD)
  {

    Logger::info(MODULE_NAME, "Triple click detected - Resetting BLE");

    if (pServer && deviceConnected)
    {
      pServer->disconnect(0);
    }
    lastClickTimes.fill(0);
  }
}

void setup()
{
  Serial.begin(115200);
  delay(1000);

  M5.begin();
  Logger::info(MODULE_NAME, "M5 initialization completed");

  deviceDisplay.begin();

  if (!M5.Imu.begin())
  {
    Logger::error(MODULE_NAME, "IMU initialization failed");
    while (true)
      delay(1000);
  }

  Error imuError = configureIMU();
  if (imuError.isError())
  {
    Logger::error(MODULE_NAME, imuError.message());
    while (true)
      delay(1000);
  }

  Error bleError = initBLE();
  if (bleError.isError())
  {
    Logger::error(MODULE_NAME, bleError.message());
    while (true)
      delay(1000);
  }

  deviceDisplay.updateDisplayStatus(false, false);
}

void loop()
{
  static uint32_t lastConnectionCheck = 0;
  static uint32_t lastUpdate = 0;
  uint32_t currentTime = millis();

  M5.update();

  if (M5.BtnA.wasPressed())
  {
    handleButton();
  }

  deviceDisplay.manageDisplayState();

  // Verify connection state and update display on change
  if (currentTime - lastConnectionCheck >= Config::Timing::CONNECTION_CHECK_INTERVAL && connectionChanged)
  {
    Logger::logf(Logger::Level::INFO, MODULE_NAME, "Connection state: %s",
                 deviceConnected ? "connected" : "disconnected");
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
  if (deviceConnected && currentTime - lastUpdate >= Config::Timing::SENSOR_UPDATE_INTERVAL)
  {
    Vector3D rawAccel, rawGyro;
    M5.Imu.getAccelData(&rawAccel.x, &rawAccel.y, &rawAccel.z);
    M5.Imu.getGyroData(&rawGyro.x, &rawGyro.y, &rawGyro.z);

    CorrectedData data = setupCalibration->correctSensorData(rawAccel, rawGyro);

    // Send sensor data packets
    SensorPacket accPacket{data.accel.x, data.accel.y, data.accel.z, currentTime};
    pAccCharacteristic->setValue(reinterpret_cast<uint8_t *>(&accPacket), sizeof(SensorPacket));
    pAccCharacteristic->notify();

    SensorPacket gyrPacket{data.gyro.x, data.gyro.y, data.gyro.z, currentTime};
    pGyrCharacteristic->setValue(reinterpret_cast<uint8_t *>(&gyrPacket), sizeof(SensorPacket));
    pGyrCharacteristic->notify();

    lastUpdate = currentTime;
  }
}