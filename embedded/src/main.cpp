#include <M5StickCPlus2.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// BLE server name and UUIDs stored in flash memory
static const char DEVICE_NAME[] PROGMEM = "PowerFlux";
static const char SERVICE_UUID[] PROGMEM = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
static const char CHARACTERISTIC_UUID[] PROGMEM = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

BLEServer *pServer = nullptr;
BLECharacteristic *pCharacteristic = nullptr;
bool deviceConnected = false;

// Sensor data structure to organize variables
struct SensorData
{
  float accX = 0.0F, accY = 0.0F, accZ = 0.0F;
  float gyroX = 0.0F, gyroY = 0.0F, gyroZ = 0.0F;
} sensorData;

const int UPDATE_FREQ = 100;
const float DT = 1.0F / UPDATE_FREQ;

class MyServerCallbacks : public BLEServerCallbacks
{
  void onConnect(BLEServer *pServer) override
  {
    deviceConnected = true;
    M5.Lcd.println("Connected!");
  }

  void onDisconnect(BLEServer *pServer) override
  {
    deviceConnected = false;
    M5.Lcd.println("Disconnected!");
    pServer->getAdvertising()->start();
  }
};

inline float calculateAccMagnitude(float x, float y, float z)
{
  return sqrt(x * x + y * y + z * z);
}

void setup()
{
  M5.begin();
  M5.Imu.begin();

  // Setup display
  M5.Lcd.setRotation(3);
  M5.Lcd.fillScreen(BLACK);
  M5.Lcd.setTextSize(2);
  M5.Lcd.setCursor(0, 0);
  M5.Lcd.println("Power Flux!");

  // Initialize BLE
  BLEDevice::init(DEVICE_NAME);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  // Create BLE Service and Characteristic
  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
      CHARACTERISTIC_UUID,
      BLECharacteristic::PROPERTY_READ |
          BLECharacteristic::PROPERTY_NOTIFY);
  pCharacteristic->addDescriptor(new BLE2902());

  pService->start();
  pServer->getAdvertising()->start();
  M5.Lcd.println("BLE ready!");
  M5.Lcd.println("Name: PowerFlux");
  M5.Lcd.printf("Service: %s\n", SERVICE_UUID);
}

void loop()
{
  M5.update();

  // Read IMU data
  M5.Imu.getAccelData(&sensorData.accX, &sensorData.accY, &sensorData.accZ);
  M5.Imu.getGyroData(&sensorData.gyroX, &sensorData.gyroY, &sensorData.gyroZ);

  float accMagnitude = calculateAccMagnitude(
      sensorData.accX, sensorData.accY, sensorData.accZ);

  if (deviceConnected)
  {
    static char buffer[128];
    snprintf(buffer, sizeof(buffer),
             "{\"ax\":%.2f,\"ay\":%.2f,\"az\":%.2f,"
             "\"gx\":%.2f,\"gy\":%.2f,\"gz\":%.2f,"
             "\"mag\":%.2f}",
             sensorData.accX, sensorData.accY, sensorData.accZ,
             sensorData.gyroX, sensorData.gyroY, sensorData.gyroZ,
             accMagnitude);
    pCharacteristic->setValue(buffer);
    pCharacteristic->notify();
  }

  // Update display
  M5.Lcd.fillScreen(BLACK);
  M5.Lcd.setCursor(0, 0);
  M5.Lcd.printf("Acc:%5.2f\n", accMagnitude);
  M5.Lcd.printf("BLE:%s\n", deviceConnected ? "OK" : "...");

  delay(10); // 100Hz update rate
}