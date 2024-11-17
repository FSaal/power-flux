#include <M5StickCPlus2.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "SetupCalibration.h"

// Device Configuration
static const char DEVICE_NAME[] = "PowerFlux";
static const char SERVICE_UUID[] = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
static const char CHAR_ACC_UUID[] = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
static const char CHAR_GYR_UUID[] = "beb5483e-36e1-4688-b7f5-ea07361b26a9";
static const char CHAR_CALIB_UUID[] = "beb5483e-36e1-4688-b7f5-ea07361b26aa";

// Global variables needed across multiple classes
BLEServer *pServer = nullptr;
BLECharacteristic *pAccCharacteristic = nullptr;
BLECharacteristic *pGyrCharacteristic = nullptr;
BLECharacteristic *pCalibCharacteristic = nullptr;
bool deviceConnected = false;
SetupCalibration *setupCalibration = nullptr;

// Data packet structures for BLE transmission
struct __attribute__((packed)) AccPacket
{
  float accX;
  float accY;
  float accZ;
  uint32_t timestamp;
}; // 16 bytes

struct __attribute__((packed)) GyrPacket
{
  float gyrX;
  float gyrY;
  float gyrZ;
  uint32_t timestamp;
}; // 16 bytes

// Commands from app
enum CalibrationCommand
{
  CMD_START_CALIBRATION = 1,
  CMD_ABORT_CALIBRATION = 2
};

// Forward declare classes we'll use
class ServerCallbacks;

// Define ServerCallbacks class
class ServerCallbacks : public BLEServerCallbacks
{
public:
  static BLEServer *connectedDevice;

  void onConnect(BLEServer *pServer) override
  {
    deviceConnected = true;
    connectedDevice = pServer;

    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.setCursor(0, 0);
    M5.Lcd.println("Connected!");
    Serial.println("Device connected");
  }

  void onDisconnect(BLEServer *pServer) override
  {
    deviceConnected = false;
    connectedDevice = nullptr;

    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.setCursor(0, 0);
    M5.Lcd.println("Disconnected!");
    Serial.println("Device disconnected");

    // Restart advertising
    pServer->getAdvertising()->start();
  }
};

// Define the static member
BLEServer *ServerCallbacks::connectedDevice = nullptr;

// Callback handler for calibration commands
class CalibrationCallback : public BLECharacteristicCallbacks
{
  void onWrite(BLECharacteristic *pCharacteristic) override
  {
    uint8_t *data = pCharacteristic->getData();
    if (data)
    {
      switch (data[0])
      {
      case CMD_START_CALIBRATION:
        if (setupCalibration)
          setupCalibration->startCalibration();
        break;
      case CMD_ABORT_CALIBRATION:
        if (setupCalibration)
          setupCalibration->abortCalibration();
        break;
      }
    }
  }
};

void setup()
{
  // Initialize M5Stack
  M5.begin();
  Serial.begin(115200);
  M5.Lcd.setRotation(3);
  M5.Lcd.fillScreen(BLACK);
  M5.Lcd.setTextSize(2);
  M5.Lcd.setCursor(0, 0);
  M5.Lcd.println("PowerFlux!!!");

  M5.Imu.begin();

  // Initialize BLE
  BLEDevice::init(DEVICE_NAME);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  // Create BLE Service
  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Create BLE Characteristics
  pAccCharacteristic = pService->createCharacteristic(
      CHAR_ACC_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pAccCharacteristic->addDescriptor(new BLE2902());

  pGyrCharacteristic = pService->createCharacteristic(
      CHAR_GYR_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pGyrCharacteristic->addDescriptor(new BLE2902());

  // Add calibration characteristic
  pCalibCharacteristic = pService->createCharacteristic(
      CHAR_CALIB_UUID,
      BLECharacteristic::PROPERTY_READ |
          BLECharacteristic::PROPERTY_WRITE |
          BLECharacteristic::PROPERTY_NOTIFY);
  pCalibCharacteristic->addDescriptor(new BLE2902());
  pCalibCharacteristic->setCallbacks(new CalibrationCallback());

  // Initialize calibration system
  setupCalibration = new SetupCalibration(pCalibCharacteristic);

  // Start the service
  pService->start();

  // Start advertising
  BLEAdvertising *pAdvertising = pServer->getAdvertising();
  pAdvertising->start();
}

void loop()
{
  static uint32_t lastUpdate = 0;
  const uint32_t UPDATE_INTERVAL = 200; // 5Hz update rate

  // Process calibration if in progress
  if (setupCalibration && setupCalibration->isCalibrationInProgress())
  {
    setupCalibration->processCalibration();
    delay(10);
    return; // Skip sensor data sending during calibration
  }

  if (millis() - lastUpdate >= UPDATE_INTERVAL)
  {
    float accX, accY, accZ;
    float gyrX, gyrY, gyrZ;
    uint32_t currentTime = millis();

    M5.Imu.getAccelData(&accX, &accY, &accZ);
    M5.Imu.getGyroData(&gyrX, &gyrY, &gyrZ);

    if (deviceConnected)
    {
      // Send accelerometer data
      AccPacket accPacket = {
          .accX = accX,
          .accY = accY,
          .accZ = accZ,
          .timestamp = currentTime};
      pAccCharacteristic->setValue((uint8_t *)&accPacket, sizeof(AccPacket));
      pAccCharacteristic->notify();

      // Send gyroscope data
      GyrPacket gyrPacket = {
          .gyrX = gyrX,
          .gyrY = gyrY,
          .gyrZ = gyrZ,
          .timestamp = currentTime};
      pGyrCharacteristic->setValue((uint8_t *)&gyrPacket, sizeof(GyrPacket));
      pGyrCharacteristic->notify();
    }

    lastUpdate = millis();
  }

  delay(10);
}