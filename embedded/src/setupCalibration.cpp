#include "SetupCalibration.h"
#include <cmath>

SetupCalibration::SetupCalibration(BLECharacteristic *calibChar, DisplayController &disp) noexcept
    : deviceDisplay(disp),
      pCalibCharacteristic(calibChar),
      calibrationInProgress(false),
      currentState(CalibrationState::IDLE),
      currentProgress(0),
      stateStartTime(0),
      sampleCount(0)
{
    calibData.isValid = false;
    calibData.accelScale = 1.0f;
}

void SetupCalibration::processCalibration()
{
    if (!calibrationInProgress)
    {
        Serial.println("[CALIB] Process called but calibration not in progress");
        return;
    }

    switch (currentState)
    {
    case CalibrationState::QUICK_STATIC_FLAT:
        handleQuickStaticFlat();
        break;
    case CalibrationState::QUICK_WAITING_ROTATION:
        handleQuickWaitingRotation();
        break;
    case CalibrationState::QUICK_STABILIZING:
        handleQuickStabilizing();
        break;
    case CalibrationState::QUICK_STATIC_SIDE:
        handleQuickStaticSide();
        break;
    case CalibrationState::QUICK_COMPLETE:
        calibrationInProgress = false;
        break;
    case CalibrationState::FAILED:
        calibrationInProgress = false;
        break;
    default:
        break;
    }
}

void SetupCalibration::transitionTo(CalibrationState newState)
{
    Serial.printf("[CALIB] Transitioning from state: %d to state: %d\n", static_cast<int>(currentState), static_cast<int>(newState));
    currentState = newState;
    stateStartTime = millis();
    sampleCount = 0;
    sendStatusToApp();
    deviceDisplay.showCalibrationProgress(0); // TODO This might be wrong
}

void SetupCalibration::startQuickCalibration()
{
    Serial.println("[CALIB] Starting quick calibration");
    if (calibrationInProgress)
    {
        Serial.println("[CALIB] Calibration already in progress");
        return;
    }

    try
    {
        Serial.println("[CALIB] Allocating memory for samples");
        accelSamples.reset(new Vector3D[QUICK_SAMPLES]);
        gyroSamples.reset(new Vector3D[QUICK_SAMPLES]);
        if (!accelSamples || !gyroSamples)
        {
            Serial.println("[CALIB] Memory allocation failed");
            throw std::bad_alloc();
        }

        calibrationInProgress = true;
        calibData.isValid = false;
        transitionTo(CalibrationState::QUICK_STATIC_FLAT);
        Serial.println("[CALIB] Quick calibration initialization complete");
    }
    catch (...)
    {
        Serial.println("[CALIB] Failed to start calibration");
        transitionTo(CalibrationState::FAILED);
    }
}

void SetupCalibration::handleQuickStaticFlat()
{
    if (sampleCount < QUICK_SAMPLES)
    {
        Vector3D accel, gyro;
        M5.Imu.getAccelData(&accel.x, &accel.y, &accel.z);
        M5.Imu.getGyroData(&gyro.x, &gyro.y, &gyro.z);

        float gyroMag = gyro.magnitude();
        if (gyroMag > MOVEMENT_TOLERANCE)
        {
            Serial.printf("[CALIB] Movement detected (%.3f > %.3f), restarting\n",
                          gyroMag, MOVEMENT_TOLERANCE);
            sampleCount = 0;
            return;
        }

        accelSamples[sampleCount] = accel;
        gyroSamples[sampleCount] = gyro;
        sampleCount++;

        if (sampleCount % 10 == 0)
        {
            uint8_t progress = static_cast<uint8_t>((sampleCount * 50) / QUICK_SAMPLES);
            currentProgress = progress;
            updateProgress(progress);
        }
    }
    else
    {
        calculateFlatPosition();
        transitionTo(CalibrationState::QUICK_WAITING_ROTATION);
    }
}

void SetupCalibration::handleQuickWaitingRotation()
{
    // Display instruction to rotate device
    deviceDisplay.showCalibrationInstruction("Rotate device 90°");

    Vector3D accel;
    M5.Imu.getAccelData(&accel.x, &accel.y, &accel.z);

    // Calculate angle between current acceleration vector and vertical (Z-axis)
    float zComponent = accel.z / accel.magnitude();
    float angleFromVertical = acos(zComponent) * 180.0f / M_PI;

    if (angleFromVertical > ROTATION_THRESHOLD)
    {
        Serial.println("[CALIB] Device rotation recognized, starting stabilization");
        transitionTo(CalibrationState::QUICK_STABILIZING);
    }
}

void SetupCalibration::handleQuickStabilizing()
{
    // TODO: Hotfix, just wait a bit to let device stabilize
    delay(2000);
    static uint32_t stableStartTime = 0;

    Vector3D gyro;
    M5.Imu.getGyroData(&gyro.x, &gyro.y, &gyro.z);

    if (gyro.magnitude() < STILLNESS_THRESHOLD)
    {
        if (stableStartTime == 0)
        {
            stableStartTime = millis();
        }
        else if (millis() - stableStartTime > STABLE_DURATION)
        {
            stableStartTime = 0;
            transitionTo(CalibrationState::QUICK_STATIC_SIDE);
        }
    }
    else
    {
        Serial.printf("[CALIB] Movement detected: %.3f\n", gyro.magnitude());
        stableStartTime = 0;
    }
}

void SetupCalibration::handleQuickStaticSide()
{
    if (sampleCount < QUICK_SAMPLES)
    {
        Vector3D accel, gyro;
        M5.Imu.getAccelData(&accel.x, &accel.y, &accel.z);
        M5.Imu.getGyroData(&gyro.x, &gyro.y, &gyro.z);

        float gyroMag = gyro.magnitude();
        if (gyroMag > MOVEMENT_TOLERANCE)
        {
            Serial.printf("[CALIB] Movement detected (%.3f > %.3f), restarting\n",
                          gyroMag, MOVEMENT_TOLERANCE);
            sampleCount = 0;
            return;
        }

        accelSamples[sampleCount] = accel;
        gyroSamples[sampleCount] = gyro;
        sampleCount++;

        // Update progress (50-100%)
        if (sampleCount % 10 == 0)
        {
            uint8_t progress = static_cast<uint8_t>(50 + (sampleCount * 50) / QUICK_SAMPLES);
            currentProgress = progress;
            updateProgress(progress);
        }
    }
    else
    {
        calculateSidePosition();
        transitionTo(CalibrationState::QUICK_COMPLETE);
    }
}

Vector3D SetupCalibration::calculateMean(const Vector3D samples[], uint32_t count)
{
    Vector3D sum;
    for (uint32_t i = 0; i < count; i++)
    {
        sum = sum + samples[i];
    }
    return sum / static_cast<float>(count);
}

void SetupCalibration::calculateFlatPosition()
{
    flatAccelMean = calculateMean(accelSamples.get(), QUICK_SAMPLES);
    Vector3D gyroMean = calculateMean(gyroSamples.get(), QUICK_SAMPLES);

    // Store gyro bias from flat position
    calibData.gyroBias = gyroMean;

    Serial.printf("[CALIB] Flat position mean: X=%.3f, Y=%.3f, Z=%.3f\n",
                  flatAccelMean.x, flatAccelMean.y, flatAccelMean.z);
    Serial.printf("[CALIB] Gyro bias: X=%.3f, Y=%.3f, Z=%.3f\n",
                  calibData.gyroBias.x, calibData.gyroBias.y, calibData.gyroBias.z);
}

void SetupCalibration::calculateSidePosition()
{
    sideAccelMean = calculateMean(accelSamples.get(), QUICK_SAMPLES);

    // Calculate scale factor using both positions
    float xMagnitude = std::abs(sideAccelMean.x);
    float zMagnitude = std::abs(flatAccelMean.z);
    float averageMagnitude = (zMagnitude + xMagnitude) / 2.0f;
    calibData.accelScale = GRAVITY_MAGNITUDE / averageMagnitude;
    Serial.printf("[CALIB] xMag: %.3f, zMag: %.3f, avgMag: %.3f\n", xMagnitude, zMagnitude, averageMagnitude);

    if (calibData.accelScale < MIN_SCALE_FACTOR || calibData.accelScale > MAX_SCALE_FACTOR)
    {
        Serial.printf("[CALIB] Invalid scale factor: %.3f\n", calibData.accelScale);
        transitionTo(CalibrationState::FAILED);
        return;
    }

    // Calculate bias using scaled values from both positions
    calibData.accelBias = Vector3D(
        flatAccelMean.x * calibData.accelScale,
        (flatAccelMean.y + sideAccelMean.y) * calibData.accelScale / 2.0f,
        sideAccelMean.z * calibData.accelScale);

    Serial.printf("[CALIB] Scale: %.3f\n", calibData.accelScale);
    Serial.printf("[CALIB] Bias: X=%.3f, Y=%.3f, Z=%.3f\n",
                  calibData.accelBias.x, calibData.accelBias.y, calibData.accelBias.z);

    calibData.isValid = true;
    deviceDisplay.updateDisplayStatus(deviceConnected, false);
    transitionTo(CalibrationState::QUICK_COMPLETE);
}

void SetupCalibration::updateProgress(uint8_t progress)
{
    deviceDisplay.showCalibrationProgress(progress);

    if (!pCalibCharacteristic || !deviceConnected)
    {
        Serial.println("[CALIB] Cannot send progress - no characteristic or not connected");
        return;
    }
    CalibrationProgress statusUpdate = {
        .state = static_cast<CalibrationState>(static_cast<uint8_t>(currentState)),
        .progress = progress};

    // Send the update immediately
    pCalibCharacteristic->setValue(reinterpret_cast<uint8_t *>(&statusUpdate), sizeof(CalibrationProgress));
    pCalibCharacteristic->notify();

    // Debug output
    Serial.printf("[CALIB] Sent progress update: State=%d, Progress=%d%%\n",
                  static_cast<int>(statusUpdate.state),
                  statusUpdate.progress);
}

void SetupCalibration::sendStatusToApp()
{
    if (!pCalibCharacteristic)
        return;

    CalibrationProgress progress = {
        .state = currentState,
        .progress = currentProgress};

    pCalibCharacteristic->setValue(reinterpret_cast<uint8_t *>(&progress), sizeof(CalibrationProgress));
    pCalibCharacteristic->notify();
}

void SetupCalibration::abortCalibration() noexcept
{
    if (!calibrationInProgress)
        return;

    accelSamples.reset();
    gyroSamples.reset();
    calibrationInProgress = false;
    calibData.isValid = false;
    transitionTo(CalibrationState::FAILED);
}

CorrectedData SetupCalibration::correctSensorData(const Vector3D &rawAccel, const Vector3D &rawGyro)
{
    CorrectedData result;

    if (!calibData.isValid)
    {
        result.accel = rawAccel;
        result.gyro = rawGyro;
        result.isValid = false;
        return result;
    }

    // Apply scale then bias correction to accelerometer
    result.accel = Vector3D(
        rawAccel.x * calibData.accelScale - calibData.accelBias.x,
        rawAccel.y * calibData.accelScale - calibData.accelBias.y,
        rawAccel.z * calibData.accelScale - calibData.accelBias.z);

    // Apply bias correction and deadband to gyroscope
    Vector3D correctedGyro = rawGyro - calibData.gyroBias;
    result.gyro = Vector3D(
        std::abs(correctedGyro.x) < GYRO_DEADBAND ? 0.0f : correctedGyro.x,
        std::abs(correctedGyro.y) < GYRO_DEADBAND ? 0.0f : correctedGyro.y,
        std::abs(correctedGyro.z) < GYRO_DEADBAND ? 0.0f : correctedGyro.z);

    result.isValid = true;
    return result;
}