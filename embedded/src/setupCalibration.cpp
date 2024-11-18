#include "SetupCalibration.h"
#include <cmath>

SetupCalibration::SetupCalibration(BLECharacteristic *calibChar, DisplayController &disp) noexcept
    : pCalibCharacteristic(calibChar), display(disp), calibrationInProgress(false), sampleCount(0), accelSamples(nullptr), gyroSamples(nullptr)
{
    calibData = CalibrationData{};
}

void SetupCalibration::startCalibration()
{
    if (calibrationInProgress)
        return;

    try
    {
        accelSamples.reset(new Vector3D[SAMPLES_REQUIRED]);
        gyroSamples.reset(new Vector3D[SAMPLES_REQUIRED]);
    }
    catch (...)
    {
        Serial.println("Failed to allocate memory for calibration");
        updateStatus(3); // Failed
        return;
    }

    calibrationInProgress = true;
    sampleCount = 0;
    updateStatus(1); // In Progress

    Serial.println("Starting calibration...");
}

void SetupCalibration::processCalibration()
{
    if (!calibrationInProgress)
        return;

    if (sampleCount < SAMPLES_REQUIRED)
    {
        collectSample();

        if (sampleCount % 10 == 0)
        {
            int progress = (sampleCount * 100) / SAMPLES_REQUIRED;
            display.showCalibrationProgress(progress);
        }
    }
    else
    {
        calculateCalibration();
        accelSamples.reset();
        gyroSamples.reset();

        calibrationInProgress = false;
        updateStatus(2); // Completed

        // Return to main screen
        display.updateStatus(deviceConnected, true);
    }
}

void SetupCalibration::abortCalibration() noexcept
{
    if (!calibrationInProgress)
        return;

    accelSamples.reset();
    gyroSamples.reset();

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
}

void SetupCalibration::calculateCalibration() noexcept
{
    calibData.accelBias = calculateMean(accelSamples.get(), SAMPLES_REQUIRED);
    calibData.gyroBias = calculateMean(gyroSamples.get(), SAMPLES_REQUIRED);

    calibData.accelScale = calculateStdDev(accelSamples.get(), SAMPLES_REQUIRED, calibData.accelBias);
    calibData.gyroScale = calculateStdDev(gyroSamples.get(), SAMPLES_REQUIRED, calibData.gyroBias);

    M5.Imu.getTemp(&calibData.tempReference);
    calibData.isCalibrated = true;
    calibData.timestamp = millis();
}

Vector3D SetupCalibration::calculateMean(const Vector3D *samples, uint16_t count) const noexcept
{
    Vector3D sum = {0, 0, 0};
    for (uint16_t i = 0; i < count; i++)
    {
        sum = sum + samples[i];
    }
    return sum / static_cast<float>(count);
}

Vector3D SetupCalibration::calculateStdDev(const Vector3D *samples, uint16_t count, const Vector3D &mean) const noexcept
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
        std::sqrt(sumSquares.x / count),
        std::sqrt(sumSquares.y / count),
        std::sqrt(sumSquares.z / count)};
}

void SetupCalibration::updateStatus(uint8_t status) noexcept
{
    if (pCalibCharacteristic)
    {
        pCalibCharacteristic->setValue(&status, 1);
        pCalibCharacteristic->notify();
    }
}

CalibrationData SetupCalibration::getCalibrationData() const noexcept
{
    return calibData;
}