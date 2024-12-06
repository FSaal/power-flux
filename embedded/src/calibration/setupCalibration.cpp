#include "config/config.h"
#include "SetupCalibration.h"
#include <cmath>

constexpr char SetupCalibration::MODULE_NAME[];

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
    Logger::info(MODULE_NAME, "SetupCalibration initialized");
}

void SetupCalibration::processCalibration()
{
    if (!calibrationInProgress)
    {
        Logger::debug(MODULE_NAME, "Process called but calibration not in progress");
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
        Logger::info(MODULE_NAME, "Calibration completed successfully");
        break;
    case CalibrationState::FAILED:
        calibrationInProgress = false;
        Logger::error(MODULE_NAME, "Calibration failed");
        break;
    default:
        Logger::error(MODULE_NAME, "Invalid calibration state");
        break;
    }
}

void SetupCalibration::transitionTo(CalibrationState newState)
{
    Logger::logf(Logger::Level::INFO, MODULE_NAME, "State transition: %d -> %d",
                 static_cast<int>(currentState), static_cast<int>(newState));
    currentState = newState;
    stateStartTime = millis();
    sampleCount = 0;
    sendStatusToApp();
    deviceDisplay.showCalibrationProgress(0);
}

Error SetupCalibration::startQuickCalibration()
{
    Logger::info(MODULE_NAME, "Starting quick calibration");

    if (calibrationInProgress)
    {
        Logger::warn(MODULE_NAME, "Calibration already in progress");
        return Error(Error::Code::INVALID_STATE, "Calibration already in progress");
    }

    try
    {
        Logger::debug(MODULE_NAME, "Allocating memory for samples");
        accelSamples.reset(new Vector3D[Config::Calibration::QUICK_SAMPLES]);
        gyroSamples.reset(new Vector3D[Config::Calibration::QUICK_SAMPLES]);

        if (!accelSamples || !gyroSamples)
        {
            Logger::error(MODULE_NAME, "Memory allocation failed");
            return Error(Error::Code::MEMORY_ERROR, "Failed to allocate sample buffers");
        }

        calibrationInProgress = true;
        calibData.isValid = false;
        transitionTo(CalibrationState::QUICK_STATIC_FLAT);
        return Error(Error::Code::NONE, "Success");
    }
    catch (...)
    {
        Logger::error(MODULE_NAME, "Failed to start calibration");
        return Error(Error::Code::CALIBRATION_FAILED, "Unknown error during initialization");
    }
}

void SetupCalibration::handleQuickStaticFlat()
{
    if (sampleCount < Config::Calibration::QUICK_SAMPLES)
    {
        Vector3D accel, gyro;
        M5.Imu.getAccelData(&accel.x, &accel.y, &accel.z);
        M5.Imu.getGyroData(&gyro.x, &gyro.y, &gyro.z);

        float gyroMag = gyro.magnitude();
        if (gyroMag > Config::Calibration::MOVEMENT_TOLERANCE)
        {
            Logger::logf(Logger::Level::DEBUG, MODULE_NAME,
                         "Movement detected (%.3f > %.3f), restarting",
                         gyroMag, Config::Calibration::MOVEMENT_TOLERANCE);
            sampleCount = 0;
            return;
        }

        accelSamples[sampleCount] = accel;
        gyroSamples[sampleCount] = gyro;
        sampleCount++;

        if (sampleCount % 10 == 0)
        {
            uint8_t progress = static_cast<uint8_t>((sampleCount * 50) / Config::Calibration::QUICK_SAMPLES);
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
    deviceDisplay.showCalibrationInstruction("Rotate device 90°");

    Vector3D accel;
    M5.Imu.getAccelData(&accel.x, &accel.y, &accel.z);

    float zComponent = accel.z / accel.magnitude();
    float angleFromVertical = acos(zComponent) * 180.0f / M_PI;

    if (angleFromVertical > Config::Calibration::ROTATION_THRESHOLD)
    {
        Logger::info(MODULE_NAME, "Device rotation recognized, starting stabilization");
        transitionTo(CalibrationState::QUICK_STABILIZING);
    }
}

void SetupCalibration::handleQuickStabilizing()
{
    static uint32_t stableStartTime = 0;
    Vector3D gyro;
    M5.Imu.getGyroData(&gyro.x, &gyro.y, &gyro.z);

    if (gyro.magnitude() < Config::Calibration::STILLNESS_THRESHOLD)
    {
        if (stableStartTime == 0)
        {
            stableStartTime = millis();
        }
        else if (millis() - stableStartTime > Config::Calibration::STABLE_DURATION)
        {
            stableStartTime = 0;
            transitionTo(CalibrationState::QUICK_STATIC_SIDE);
        }
    }
    else
    {
        Logger::logf(Logger::Level::DEBUG, MODULE_NAME, "Movement detected: %.3f", gyro.magnitude());
        stableStartTime = 0;
    }
}

void SetupCalibration::handleQuickStaticSide()
{
    if (sampleCount < Config::Calibration::QUICK_SAMPLES)
    {
        Vector3D accel, gyro;
        M5.Imu.getAccelData(&accel.x, &accel.y, &accel.z);
        M5.Imu.getGyroData(&gyro.x, &gyro.y, &gyro.z);

        float gyroMag = gyro.magnitude();
        if (gyroMag > Config::Calibration::MOVEMENT_TOLERANCE)
        {
            Logger::logf(Logger::Level::DEBUG, MODULE_NAME,
                         "Movement detected (%.3f > %.3f), restarting",
                         gyroMag, Config::Calibration::MOVEMENT_TOLERANCE);
            sampleCount = 0;
            return;
        }

        accelSamples[sampleCount] = accel;
        gyroSamples[sampleCount] = gyro;
        sampleCount++;

        if (sampleCount % 10 == 0)
        {
            uint8_t progress = static_cast<uint8_t>(50 + (sampleCount * 50) / Config::Calibration::QUICK_SAMPLES);
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
    flatAccelMean = calculateMean(accelSamples.get(), Config::Calibration::QUICK_SAMPLES);
    Vector3D gyroMean = calculateMean(gyroSamples.get(), Config::Calibration::QUICK_SAMPLES);

    calibData.gyroBias = gyroMean;

    Logger::logf(Logger::Level::INFO, MODULE_NAME,
                 "Flat position mean: X=%.3f, Y=%.3f, Z=%.3f",
                 flatAccelMean.x, flatAccelMean.y, flatAccelMean.z);
    Logger::logf(Logger::Level::INFO, MODULE_NAME,
                 "Gyro bias: X=%.3f, Y=%.3f, Z=%.3f",
                 calibData.gyroBias.x, calibData.gyroBias.y, calibData.gyroBias.z);
}

void SetupCalibration::calculateSidePosition()
{
    sideAccelMean = calculateMean(accelSamples.get(), Config::Calibration::QUICK_SAMPLES);

    float xMagnitude = std::abs(sideAccelMean.x);
    float zMagnitude = std::abs(flatAccelMean.z);
    float averageMagnitude = (zMagnitude + xMagnitude) / 2.0f;
    calibData.accelScale = Config::Calibration::GRAVITY_MAGNITUDE / averageMagnitude;

    Logger::logf(Logger::Level::DEBUG, MODULE_NAME,
                 "xMag: %.3f, zMag: %.3f, avgMag: %.3f",
                 xMagnitude, zMagnitude, averageMagnitude);

    if (calibData.accelScale < Config::Calibration::MIN_SCALE_FACTOR || calibData.accelScale > Config::Calibration::MAX_SCALE_FACTOR)
    {
        Logger::logf(Logger::Level::ERROR, MODULE_NAME,
                     "Invalid scale factor: %.3f", calibData.accelScale);
        transitionTo(CalibrationState::FAILED);
        return;
    }

    calibData.accelBias = Vector3D(
        flatAccelMean.x * calibData.accelScale,
        (flatAccelMean.y + sideAccelMean.y) * calibData.accelScale / 2.0f,
        sideAccelMean.z * calibData.accelScale);

    Logger::logf(Logger::Level::INFO, MODULE_NAME, "Scale: %.3f", calibData.accelScale);
    Logger::logf(Logger::Level::INFO, MODULE_NAME,
                 "Bias: X=%.3f, Y=%.3f, Z=%.3f",
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
        Logger::warn(MODULE_NAME, "Cannot send progress - no characteristic or not connected");
        return;
    }

    CalibrationProgress statusUpdate = {
        .state = static_cast<CalibrationState>(static_cast<uint8_t>(currentState)),
        .progress = progress};

    pCalibCharacteristic->setValue(reinterpret_cast<uint8_t *>(&statusUpdate),
                                   sizeof(CalibrationProgress));
    pCalibCharacteristic->notify();

    Logger::logf(Logger::Level::DEBUG, MODULE_NAME,
                 "Progress update: State=%d, Progress=%d%%",
                 static_cast<int>(statusUpdate.state),
                 statusUpdate.progress);
}

void SetupCalibration::sendStatusToApp()
{
    if (!pCalibCharacteristic)
    {
        Logger::warn(MODULE_NAME, "Cannot send status - no characteristic");
        return;
    }

    CalibrationProgress progress = {
        .state = currentState,
        .progress = currentProgress};

    pCalibCharacteristic->setValue(reinterpret_cast<uint8_t *>(&progress),
                                   sizeof(CalibrationProgress));
    pCalibCharacteristic->notify();
}

void SetupCalibration::abortCalibration() noexcept
{
    if (!calibrationInProgress)
        return;

    Logger::info(MODULE_NAME, "Aborting calibration");
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

    result.accel = Vector3D(
        rawAccel.x * calibData.accelScale - calibData.accelBias.x,
        rawAccel.y * calibData.accelScale - calibData.accelBias.y,
        rawAccel.z * calibData.accelScale - calibData.accelBias.z);

    Vector3D correctedGyro = rawGyro - calibData.gyroBias;
    result.gyro = Vector3D(
        std::abs(correctedGyro.x) < Config::Calibration::GYRO_DEADBAND ? 0.0f : correctedGyro.x,
        std::abs(correctedGyro.y) < Config::Calibration::GYRO_DEADBAND ? 0.0f : correctedGyro.y,
        std::abs(correctedGyro.z) < Config::Calibration::GYRO_DEADBAND ? 0.0f : correctedGyro.z);

    result.isValid = true;
    return result;
}