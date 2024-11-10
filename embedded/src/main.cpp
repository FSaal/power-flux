#include <M5StickCPlus2.h>

// Global variables for storing sensor data
float accX = 0.0F;
float accY = 0.0F;
float accZ = 0.0F;
float gyroX = 0.0F;
float gyroY = 0.0F;
float gyroZ = 0.0F;

float calculateAccMagnitude(float x, float y, float z)
{
  return sqrt(x * x + y * y + z * z);
}

void setup()
{
  M5.begin();
  // Initialize IMU
  M5.Imu.begin();

  // Setup display
  M5.Lcd.setRotation(3);
  M5.Lcd.fillScreen(BLACK);
  M5.Lcd.setTextSize(2);
  M5.Lcd.setCursor(0, 0);
  M5.Lcd.println("Power Flux!");
}

void loop()
{
  M5.update();

  // Read IMU data
  M5.Imu.getAccelData(&accX, &accY, &accZ);
  M5.Imu.getGyroData(&gyroX, &gyroY, &gyroZ);

  // Calculate acceleration magnitude
  float accMagnitude = calculateAccMagnitude(accX, accY, accZ);

  // Clear previous text
  M5.Lcd.fillScreen(BLACK);
  M5.Lcd.setCursor(0, 0);

  // Display IMU data
  M5.Lcd.printf("AccX: %5.2f\n", accX);
  M5.Lcd.printf("AccY: %5.2f\n", accY);
  M5.Lcd.printf("AccZ: %5.2f\n", accZ);
  M5.Lcd.printf("Mag : %5.2f\n", accMagnitude);

  // Update every 100ms
  delay(100);
}

// put function definitions here:
int myFunction(int x, int y)
{
  return x + y;
}