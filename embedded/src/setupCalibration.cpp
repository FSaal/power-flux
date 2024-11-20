#include "SetupCalibration.h"
#include <cmath>

SetupCalibration::SetupCalibration(BLECharacteristic *calibChar, DisplayController &disp) noexcept
    : display(disp), pCalibCharacteristic(calibChar), calibrationInProgress(false), currentState(CalibrationState::IDLE), stateStartTime(0), sampleCount(0), initialTemp(0)
{
    // Reserve space for temperature history
    temperatureHistory.reserve(TEMP_CHECK_SAMPLES);
}

void SetupCalibration::startCalibration()
{
    if (calibrationInProgress)
        return;

    try
    {
        // Allocate buffers for bias estimation
        accelSamples.reset(new Vector3D[SAMPLES_PER_STATE]);
        gyroSamples.reset(new Vector3D[SAMPLES_PER_STATE]);
        temperatureHistory.clear();

        calibrationInProgress = true;
        transitionTo(CalibrationState::WARMUP);

        // Get initial temperature
        M5.Imu.getTemp(&initialTemp);
    }
    catch (...)
    {
        Serial.println("[CALIB] Failed to allocate memory for calibration");
        transitionTo(CalibrationState::FAILED);
        return;
    }
}

void SetupCalibration::processCalibration()
{
    if (!calibrationInProgress)
        return;

    switch (currentState)
    {
    case CalibrationState::WARMUP:
        handleWarmup();
        break;

    case CalibrationState::TEMP_CHECK:
        handleTempCheck();
        break;

    case CalibrationState::BIAS_ESTIMATION:
        handleBiasEstimation();
        break;

    default:
        break;
    }
}

void SetupCalibration::handleWarmup()
{
    uint32_t elapsed = millis() - stateStartTime;

    if (elapsed >= WARMUP_DURATION)
    {
        transitionTo(CalibrationState::TEMP_CHECK);
        return;
    }

    // Update progress (0-100%)
    updateProgress(static_cast<uint8_t>((elapsed * 100) / WARMUP_DURATION));
}

void SetupCalibration::handleTempCheck()
{
    float currentTemp;
    M5.Imu.getTemp(&currentTemp);

    // Add temperature to history
    temperatureHistory.push_back(currentTemp);

    if (temperatureHistory.size() >= TEMP_CHECK_SAMPLES)
    {
        if (isTemperatureStable())
        {
            transitionTo(CalibrationState::BIAS_ESTIMATION);
        }
        else
        {
            Serial.println("[CALIB] Temperature not stable");
            transitionTo(CalibrationState::FAILED);
        }
        return;
    }

    // Update progress
    updateProgress(static_cast<uint8_t>((temperatureHistory.size() * 100) / TEMP_CHECK_SAMPLES));
}

void SetupCalibration::handleBiasEstimation()
{
    if (sampleCount < SAMPLES_PER_STATE)
    {
        collectSample();
        updateProgress(static_cast<uint8_t>((sampleCount * 100) / SAMPLES_PER_STATE));
    }
    else
    {
        calculateBias();
        // For now, end calibration here
        transitionTo(CalibrationState::COMPLETED);
    }
}

void SetupCalibration::collectSample()
{
    Vector3D accel, gyro;
    M5.Imu.getAccelData(&accel.x, &accel.y, &accel.z);
    M5.Imu.getGyroData(&gyro.x, &gyro.y, &gyro.z);

    accelSamples[sampleCount] = accel;
    gyroSamples[sampleCount] = gyro;
    sampleCount++;
}

void SetupCalibration::calculateBias()
{
    Vector3D accelSum = {0, 0, 0};
    Vector3D gyroSum = {0, 0, 0};

    for (uint32_t i = 0; i < SAMPLES_PER_STATE; i++)
    {
        accelSum = accelSum + accelSamples[i];
        gyroSum = gyroSum + gyroSamples[i];
    }

    biasData.accelBias = accelSum / static_cast<float>(SAMPLES_PER_STATE);
    biasData.gyroBias = gyroSum / static_cast<float>(SAMPLES_PER_STATE);
    M5.Imu.getTemp(&biasData.temperature);
    biasData.timestamp = millis();
}

bool SetupCalibration::isTemperatureStable()
{
    if (temperatureHistory.size() < TEMP_CHECK_SAMPLES)
        return false;

    float maxTemp = temperatureHistory[0];
    float minTemp = temperatureHistory[0];

    for (float temp : temperatureHistory)
    {
        maxTemp = std::max(maxTemp, temp);
        minTemp = std::min(minTemp, temp);
    }

    return (maxTemp - minTemp) <= TEMP_STABILITY_THRESHOLD;
}

void SetupCalibration::transitionTo(CalibrationState newState)
{
    currentState = newState;
    stateStartTime = millis();
    sampleCount = 0;
    sendStatusToApp();

    // Update display with new state
    display.showCalibrationProgress(0); // Reset progress for new state
}

void SetupCalibration::sendStatusToApp()
{
    if (!pCalibCharacteristic)
        return;

    CalibrationProgress progress;
    progress.state = currentState;
    progress.progress = 0;
    progress.temperature = 0.0f;
    M5.Imu.getTemp(&progress.temperature);
    progress.positionIndex = 0;
    progress.reserved = 0;

    pCalibCharacteristic->setValue(reinterpret_cast<uint8_t *>(&progress), sizeof(CalibrationProgress));
    pCalibCharacteristic->notify();
}

void SetupCalibration::updateProgress(uint8_t progress)
{
    display.showCalibrationProgress(progress);

    CalibrationProgress statusUpdate;
    statusUpdate.state = currentState;
    statusUpdate.progress = progress;
    M5.Imu.getTemp(&statusUpdate.temperature);
    statusUpdate.positionIndex = 0;
    statusUpdate.reserved = 0;

    pCalibCharacteristic->setValue(reinterpret_cast<uint8_t *>(&statusUpdate), sizeof(CalibrationProgress));
    pCalibCharacteristic->notify();
}

void SetupCalibration::abortCalibration() noexcept
{
    if (!calibrationInProgress)
        return;

    accelSamples.reset();
    gyroSamples.reset();
    temperatureHistory.clear();

    calibrationInProgress = false;
    transitionTo(CalibrationState::FAILED);
}