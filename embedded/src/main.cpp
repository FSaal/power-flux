// main_debug.cpp
#include <M5StickCPlus2.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// Device Configuration
static const char DEVICE_NAME[] = "PowerFlux";
static const char SERVICE_UUID[] = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
static const char CHARACTERISTIC_UUID[] = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

// Global variables
BLEServer *pServer = nullptr;
BLECharacteristic *pCharacteristic = nullptr;
bool deviceConnected = false;

// Data packet structure (8 bytes total)
struct __attribute__((packed)) DataPacket
{
  float magnitude;    // 4 bytes - acceleration magnitude
  uint32_t timestamp; // 4 bytes - timestamp
};

// BLE Server Callbacks
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
  Serial.begin(115200);
  M5.Imu.begin();

  // Setup display
  M5.Lcd.setRotation(3);
  M5.Lcd.fillScreen(BLACK);
  M5.Lcd.setTextSize(2);
  M5.Lcd.setCursor(0, 0);
  M5.Lcd.println("BLE Debug Mode");

  // Initialize BLE
  BLEDevice::init(DEVICE_NAME);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  // Create BLE Service
  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Create BLE Characteristic
  pCharacteristic = pService->createCharacteristic(
      CHARACTERISTIC_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pCharacteristic->addDescriptor(new BLE2902());

  // Start the service
  pService->start();

  // Start advertising
  BLEAdvertising *pAdvertising = pServer->getAdvertising();
  pAdvertising->start();

  Serial.println("BLE device ready");
  Serial.println("Waiting for connection...");
}

void loop()
{
  static uint32_t lastUpdate = 0;
  const uint32_t UPDATE_INTERVAL = 200; // 5Hz update rate

  if (millis() - lastUpdate >= UPDATE_INTERVAL)
  {
    float accX, accY, accZ;
    M5.Imu.getAccelData(&accX, &accY, &accZ);

    // Calculate magnitude
    float magnitude = sqrt(accX * accX + accY * accY + accZ * accZ);

    // Update display
    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.setCursor(0, 0);
    M5.Lcd.printf("Acc: %.2f\n", magnitude);
    M5.Lcd.printf("BLE: %s", deviceConnected ? "Connected" : "Waiting...");

    // Send data if connected
    if (deviceConnected)
    {
      DataPacket packet = {
          .magnitude = magnitude,
          .timestamp = millis()};

      pCharacteristic->setValue((uint8_t *)&packet, sizeof(DataPacket));
      pCharacteristic->notify();

      // Debug output
      Serial.printf("Sent - Magnitude: %.2f, Time: %lu\n",
                    magnitude, packet.timestamp);
    }

    lastUpdate = millis();
  }

  delay(10); // Small delay to prevent tight loop
}