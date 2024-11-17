#include "SetupCalibration.h"

SetupCalibration::SetupCalibration(BLECharacteristic *calibChar)
    : pCalibCharacteristic(calibChar),
      calibrationInProgress(false),
      sampleCount(0),
      accelSamples(nullptr),
      gyroSamples(nullptr)
{
    calibData.accelBias = {0.0f, 0.0f, 0.0f};
    calibData.gyroBias = {0.0f, 0.0f, 0.0f};
    calibData.accelScale = {1.0f, 1.0f, 1.0f};
    calibData.gyroScale = {1.0f, 1.0f, 1.0f};
    calibData.tempReference = 0.0f;
    calibData.isCalibrated = false;
    calibData.timestamp = 0;
}

void SetupCalibration::startCalibration()
{
    if (calibrationInProgress)
    {
        return;
    }

    // Allocate memory for samples
    accelSamples = new Vector3D[SAMPLES_REQUIRED];
    gyroSamples = new Vector3D[SAMPLES_REQUIRED];

    calibrationInProgress = true;
    sampleCount = 0;
    updateStatus(1); // In Progress

    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.setCursor(0, 0);
    M5.Lcd.println("Calibrating...");

    // Debug output
    Serial.println("Starting calibration...");
}

void SetupCalibration::processCalibration()
{
    if (!calibrationInProgress)
    {
        return;
    }

    if (sampleCount < SAMPLES_REQUIRED)
    {
        // Collect samples regardless of stability
        collectSample();

        // Update progress every 10 samples
        if (sampleCount % 10 == 0)
        {
            int progress = (sampleCount * 100) / SAMPLES_REQUIRED;
            M5.Lcd.setCursor(0, 20);
            M5.Lcd.printf("Progress: %d%%", progress);
            Serial.printf("Calibration progress: %d%%\n", progress);
        }
    }
    else
    {
        // Calculate calibration values
        calculateCalibration();

        // Cleanup
        delete[] accelSamples;
        delete[] gyroSamples;
        accelSamples = nullptr;
        gyroSamples = nullptr;

        calibrationInProgress = false;
        updateStatus(2); // Completed

        M5.Lcd.fillScreen(BLACK);
        M5.Lcd.setCursor(0, 0);
        M5.Lcd.println("Calibration Complete!");
        Serial.println("Calibration completed successfully");
    }
}

void SetupCalibration::abortCalibration()
{
    if (!calibrationInProgress)
    {
        return;
    }

    delete[] accelSamples;
    delete[] gyroSamples;
    accelSamples = nullptr;
    gyroSamples = nullptr;

    calibrationInProgress = false;
    updateStatus(3); // Failed/Aborted

    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.setCursor(0, 0);
    M5.Lcd.println("Calibration Aborted!");
}

void SetupCalibration::collectSample()
{
    float ax, ay, az, gx, gy, gz;
    M5.Imu.getAccelData(&ax, &ay, &az);
    M5.Imu.getGyroData(&gx, &gy, &gz);

    accelSamples[sampleCount] = {ax, ay, az};
    gyroSamples[sampleCount] = {gx, gy, gz};
    sampleCount++;

    // Debug output every 100 samples
    if (sampleCount % 100 == 0)
    {
        Serial.printf("Sample %d: Acc(%.2f,%.2f,%.2f) Gyro(%.2f,%.2f,%.2f)\n",
                      sampleCount, ax, ay, az, gx, gy, gz);
    }
}

void SetupCalibration::calculateCalibration()
{
    // Calculate means
    calibData.accelBias = calculateMean(accelSamples, SAMPLES_REQUIRED);
    calibData.gyroBias = calculateMean(gyroSamples, SAMPLES_REQUIRED);

    // Calculate scale factors
    calibData.accelScale = calculateStdDev(accelSamples, SAMPLES_REQUIRED, calibData.accelBias);
    calibData.gyroScale = calculateStdDev(gyroSamples, SAMPLES_REQUIRED, calibData.gyroBias);

    // Store temperature reference
    M5.Imu.getTemp(&calibData.tempReference);

    calibData.isCalibrated = true;
    calibData.timestamp = millis();
}

Vector3D SetupCalibration::calculateMean(Vector3D *samples, uint16_t count)
{
    Vector3D sum = {0, 0, 0};
    for (uint16_t i = 0; i < count; i++)
    {
        sum = sum + samples[i];
    }
    return sum / static_cast<float>(count);
}

Vector3D SetupCalibration::calculateStdDev(Vector3D *samples, uint16_t count, const Vector3D &mean)
{
    Vector3D sumSquares = {0, 0, 0};
    for (uint16_t i = 0; i < count; i++)
    {
        Vector3D diff = {
            samples[i].x - mean.x,
            samples[i].y - mean.y,
            samples[i].z - mean.z};
        sumSquares.x += diff.x * diff.x;
        sumSquares.y += diff.y * diff.y;
        sumSquares.z += diff.z * diff.z;
    }
    return {
        sqrt(sumSquares.x / count),
        sqrt(sumSquares.y / count),
        sqrt(sumSquares.z / count)};
}

void SetupCalibration::updateStatus(uint8_t status)
{
    if (pCalibCharacteristic)
    {
        pCalibCharacteristic->setValue(&status, 1);
        pCalibCharacteristic->notify();
    }
}
