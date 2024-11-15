#include <M5StickCPlus2.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// Device Configuration
static const char DEVICE_NAME[] = "PowerFlux";
static const char SERVICE_UUID[] = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
static const char CHAR_ACC_UUID[] = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
static const char CHAR_GYR_UUID[] = "beb5483e-36e1-4688-b7f5-ea07361b26a9";

// Split data structures
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

// Global variables
BLEServer *pServer = nullptr;
BLECharacteristic *pAccCharacteristic = nullptr;
BLECharacteristic *pGyrCharacteristic = nullptr;
bool deviceConnected = false;

class ServerCallbacks : public BLEServerCallbacks
{
  void onConnect(BLEServer *pServer) override
  {
    deviceConnected = true;
    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.setCursor(0, 0);
    M5.Lcd.println("Connected!");
    Serial.println("Device connected");
  }

  void onDisconnect(BLEServer *pServer) override
  {
    deviceConnected = false;
    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.setCursor(0, 0);
    M5.Lcd.println("Disconnected!");
    Serial.println("Device disconnected");

    // Restart advertising
    pServer->getAdvertising()->start();
  }
};

void setup()
{
  // Initialize M5Stack
  M5.begin();
  // Initialize serial for debugging
  Serial.begin(115200);
  // Setup display
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

  // Create BLE Characteristics for accelerometer and gyroscope data
  pAccCharacteristic = pService->createCharacteristic(
      CHAR_ACC_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pAccCharacteristic->addDescriptor(new BLE2902());

  pGyrCharacteristic = pService->createCharacteristic(
      CHAR_GYR_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pGyrCharacteristic->addDescriptor(new BLE2902());

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

      // Debug output
      Serial.printf("Sent - Acc(x,y,z): %.2f, %.2f, %.2f Time: %lu\n",
                    accX, accY, accZ, currentTime);
      Serial.printf("Sent - Gyr(x,y,z): %.2f, %.2f, %.2f Time: %lu\n",
                    gyrX, gyrY, gyrZ, currentTime);
    }

    lastUpdate = millis();
  }

  delay(10);
}