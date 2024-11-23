#include "SetupCalibration.h"
#include <cmath>

const std::array<CalibrationPosition, 6> SetupCalibration::calibrationPositions = {{{Vector3D(0, 0, GRAVITY_MAGNITUDE), "Place device flat on table"},
                                                                                    {Vector3D(0, 0, -GRAVITY_MAGNITUDE), "Turn device upside down"},
                                                                                    {Vector3D(0, GRAVITY_MAGNITUDE, 0), "Stand on long edge (buttons up)"},
                                                                                    {Vector3D(0, -GRAVITY_MAGNITUDE, 0), "Stand on long edge (buttons down)"},
                                                                                    {Vector3D(GRAVITY_MAGNITUDE, 0, 0), "Stand on short edge (USB up)"},
                                                                                    {Vector3D(-GRAVITY_MAGNITUDE, 0, 0), "Stand on short edge (USB down)"}}};

SetupCalibration::SetupCalibration(BLECharacteristic *calibChar, DisplayController &disp) noexcept
    : deviceDisplay(disp),
      pCalibCharacteristic(calibChar),
      calibrationInProgress(false),
      currentState(CalibrationState::IDLE),
      stateStartTime(0),
      sampleCount(0),
      initialTemp(0)
{
    temperatureHistory.reserve(TEMP_CHECK_SAMPLES);
    calibData.isValid = false;
}

// Quick Calibration
void SetupCalibration::startQuickCalibration()
{
    if (calibrationInProgress)
        return;

    try
    {
        accelSamples.reset(new Vector3D[QUICK_SAMPLES]);
        gyroSamples.reset(new Vector3D[QUICK_SAMPLES]);
        calibrationInProgress = true;
        transitionTo(CalibrationState::QUICK_STATIC);
    }
    catch (...)
    {
        Serial.println("[CALIB] Failed to allocate memory for quick calibration");
        transitionTo(CalibrationState::FAILED);
    }
}

void SetupCalibration::handleQuickStatic()
{
    if (sampleCount == 0)
    {
        // Initialize temperature at start of sampling
        M5.Imu.getTemp(&initialTemp);
        Serial.printf("[CALIB] Device temperature: %.2f\n", initialTemp);
        delay(100); // Small delay to ensure temperature reading is stable
    }

    if (sampleCount < QUICK_SAMPLES)
    {
        float currentTemp;
        M5.Imu.getTemp(&currentTemp);

        if (std::abs(currentTemp - initialTemp) > MAX_TEMP_DIFFERENCE)
        {
            Serial.printf("[CALIB] Temperature unstable: current=%.2f, initial=%.2f\n",
                          currentTemp, initialTemp);
            delay(100); // Add delay before retry
            return;
        }

        Vector3D accel, gyro;
        M5.Imu.getAccelData(&accel.x, &accel.y, &accel.z);
        M5.Imu.getGyroData(&gyro.x, &gyro.y, &gyro.z);

        // Check for movement during sampling
        if (gyro.magnitude() > QUICK_MOVEMENT_TOLERANCE * 1000) // todo: 1000 is hotfix
        {
            Serial.printf("[CALIB] Movement detected during quick calibration: magnitude=%.3f\n", gyro.magnitude());
            sampleCount = 0;
            return;
        }

        accelSamples[sampleCount] = accel;
        gyroSamples[sampleCount] = gyro;
        sampleCount++;

        updateProgress(static_cast<uint8_t>((sampleCount * 100) / QUICK_SAMPLES));
    }
    else
    {
        transitionTo(CalibrationState::QUICK_VALIDATION);
    }
}

void SetupCalibration::handleQuickValidation()
{
    Vector3D accelSum, gyroSum;
    for (uint32_t i = 0; i < QUICK_SAMPLES; i++)
    {
        accelSum = accelSum + accelSamples[i];
        gyroSum = gyroSum + gyroSamples[i];
    }

    Vector3D accelMean = accelSum / static_cast<float>(QUICK_SAMPLES);
    Vector3D gyroMean = gyroSum / static_cast<float>(QUICK_SAMPLES);

    if (validateQuickPosition(accelMean))
    {
        calibData.gyroBias = gyroMean;
        calibData.accelBias = Vector3D(accelMean.x, accelMean.y, accelMean.z - GRAVITY_MAGNITUDE);
        Serial.printf("[CALIB] Calculated bias: %.3f, %.3f, %.3f", calibData.accelBias.x, calibData.accelBias.y, calibData.accelBias.z);
        calibData.isValid = true;
        deviceDisplay.showCalibrationProgress(100); // Show 100% completion
        delay(1000);                                // Show completion briefly
        deviceDisplay.updateStatus(true, false);    // Return to main screen with connected=true, recording=false
        transitionTo(CalibrationState::QUICK_COMPLETE);
    }
    else
    {
        Serial.println("[CALIB] Quick calibration position validation failed");
        deviceDisplay.updateStatus(true, false); // Return to main screen
        transitionTo(CalibrationState::FAILED);
    }
}

bool SetupCalibration::validateQuickPosition(const Vector3D &gravity)
{
    // Check total magnitude
    float magDiff = std::abs(gravity.magnitude() - GRAVITY_MAGNITUDE);
    Serial.printf("[CALIB] Validation - Total magnitude: actual=%.3f, expected=%.3f, diff=%.3f, tolerance=%.3f\n",
                  gravity.magnitude(), GRAVITY_MAGNITUDE, magDiff, QUICK_POSITION_TOLERANCE);

    if (magDiff > QUICK_POSITION_TOLERANCE)
    {
        Serial.println("[CALIB] Failed magnitude check");
        return false;
    }

    // Check Z-axis alignment (should be close to gravity)
    float zDiff = std::abs(gravity.z - GRAVITY_MAGNITUDE);
    Serial.printf("[CALIB] Validation - Z axis: %.3f, expected: %.3f, diff=%.3f, tolerance=%.3f\n",
                  gravity.z, GRAVITY_MAGNITUDE, zDiff, QUICK_POSITION_TOLERANCE);
    if (zDiff > QUICK_POSITION_TOLERANCE)
    {
        Serial.println("[CALIB] Failed Z-axis check");
        return false;
    }

    // Check X and Y axes (should be close to 0)
    Serial.printf("[CALIB] Validation - X: %.3f, Y: %.3f\n", gravity.x, gravity.y);
    if (std::abs(gravity.x) > QUICK_POSITION_TOLERANCE ||
        std::abs(gravity.y) > QUICK_POSITION_TOLERANCE)
    {
        Serial.println("[CALIB] Failed X/Y axes check");
        return false;
    }

    Serial.println("[CALIB] Quick calibration position validated");
    return true;
}

// Core Flow Methods
void SetupCalibration::startCalibration()
{
    if (calibrationInProgress)
        return;

    try
    {
        accelSamples.reset(new Vector3D[SAMPLES_PER_STATE]);
        gyroSamples.reset(new Vector3D[SAMPLES_PER_STATE]);
        temperatureHistory.clear();
        calibrationInProgress = true;
        M5.Imu.getTemp(&initialTemp);
        transitionTo(CalibrationState::WARMUP);
    }
    catch (...)
    {
        Serial.println("[CALIB] Failed to allocate memory for calibration");
        transitionTo(CalibrationState::FAILED);
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
    case CalibrationState::POSITION_Z_UP:
    case CalibrationState::POSITION_Z_DOWN:
    case CalibrationState::POSITION_Y_UP:
    case CalibrationState::POSITION_Y_DOWN:
    case CalibrationState::POSITION_X_UP:
    case CalibrationState::POSITION_X_DOWN:
        handlePositionCalibration();
        break;
    case CalibrationState::MOVEMENT_CHECK:
        handleMovementCheck();
        break;
    case CalibrationState::QUICK_STATIC:
        handleQuickStatic();
        break;
    case CalibrationState::QUICK_VALIDATION:
        handleQuickValidation();
        break;
    case CalibrationState::QUICK_COMPLETE:
        calibrationInProgress = false;
        break;
    default:
        break;
    }
}

// State Handlers
void SetupCalibration::handleWarmup()
{
    uint32_t elapsed = millis() - stateStartTime;
    if (elapsed >= WARMUP_DURATION)
    {
        transitionTo(CalibrationState::TEMP_CHECK);
        return;
    }
    updateProgress(static_cast<uint8_t>((elapsed * 100) / WARMUP_DURATION));
}

void SetupCalibration::handleTempCheck()
{
    float currentTemp;
    M5.Imu.getTemp(&currentTemp);
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
        transitionTo(CalibrationState::POSITION_Z_UP);
    }
}

void SetupCalibration::handlePositionCalibration()
{
    size_t positionIndex = static_cast<size_t>(currentState) - static_cast<size_t>(CalibrationState::POSITION_Z_UP);

    if (sampleCount < SAMPLES_PER_STATE)
    {
        collectSample();

        if (sampleCount % 100 == 0)
        {
            deviceDisplay.showCalibrationProgress(
                static_cast<uint8_t>((sampleCount * 100) / SAMPLES_PER_STATE));
        }

        if (sampleCount % 10 == 0)
        {
            Vector3D currentAccel;
            M5.Imu.getAccelData(&currentAccel.x, &currentAccel.y, &currentAccel.z);

            if (!validatePosition(currentAccel, positionIndex))
            {
                sampleCount = 0;
                deviceDisplay.showCalibrationProgress(0);
                return;
            }
        }
    }
    else
    {
        calculatePositionData(positionIndex);

        if (positionIndex < calibrationPositions.size() - 1)
        {
            transitionTo(static_cast<CalibrationState>(
                static_cast<uint8_t>(currentState) + 1));
        }
        else
        {
            transitionTo(CalibrationState::MOVEMENT_CHECK);
        }
    }
}

void SetupCalibration::handleMovementCheck()
{
    if (processMovementValidation())
    {
        calibData.isValid = true;
        transitionTo(CalibrationState::COMPLETED);
    }
    else
    {
        transitionTo(CalibrationState::FAILED);
    }
}

// Data Collection & Calculation
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
    Vector3D accelSum, gyroSum;
    for (uint32_t i = 0; i < SAMPLES_PER_STATE; i++)
    {
        accelSum = accelSum + accelSamples[i];
        gyroSum = gyroSum + gyroSamples[i];
    }

    calibData.accelBias = accelSum / static_cast<float>(SAMPLES_PER_STATE);
    calibData.gyroBias = gyroSum / static_cast<float>(SAMPLES_PER_STATE);
    M5.Imu.getTemp(&calibData.temperature);
    calibData.timestamp = millis();
}

void SetupCalibration::calculatePositionData(size_t positionIndex)
{
    Vector3D accelSum, gyroSum;

    for (uint32_t i = 0; i < SAMPLES_PER_STATE; i++)
    {
        accelSum = accelSum + accelSamples[i];
        gyroSum = gyroSum + gyroSamples[i];
    }

    PositionData &posData = calibData.positionData[positionIndex];
    posData.meanAccel = accelSum / static_cast<float>(SAMPLES_PER_STATE);
    posData.meanGyro = gyroSum / static_cast<float>(SAMPLES_PER_STATE);

    float accelVarSum = 0;
    float gyroVarSum = 0;

    for (uint32_t i = 0; i < SAMPLES_PER_STATE; i++)
    {
        Vector3D accelDiff = accelSamples[i] - posData.meanAccel;
        Vector3D gyroDiff = gyroSamples[i] - posData.meanGyro;

        accelVarSum += accelDiff.magnitude();
        gyroVarSum += gyroDiff.magnitude();
    }

    posData.varAccel = accelVarSum / SAMPLES_PER_STATE;
    posData.varGyro = gyroVarSum / SAMPLES_PER_STATE;
    posData.isValid = validatePosition(posData.meanAccel, positionIndex);
}

bool SetupCalibration::validatePosition(const Vector3D &gravity, size_t positionIndex)
{
    if (positionIndex >= calibrationPositions.size())
        return false;

    float magDiff = std::abs(gravity.magnitude() - GRAVITY_MAGNITUDE);
    if (magDiff > POSITION_TOLERANCE)
        return false;

    const Vector3D &expected = calibrationPositions[positionIndex].expectedGravity;
    float xDiff = std::abs(gravity.x - expected.x);
    float yDiff = std::abs(gravity.y - expected.y);
    float zDiff = std::abs(gravity.z - expected.z);

    return xDiff <= POSITION_TOLERANCE &&
           yDiff <= POSITION_TOLERANCE &&
           zDiff <= POSITION_TOLERANCE;
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

// Movement Validation
bool SetupCalibration::processMovementValidation()
{
    enum class MovementState
    {
        ROTATE_X,
        CHECK_X,
        ROTATE_Y,
        CHECK_Y,
        ROTATE_Z,
        CHECK_Z,
        COMPLETE
    };

    static MovementState moveState = MovementState::ROTATE_X;
    static uint32_t stateTimer = 0;
    static uint32_t sampleCounter = 0;
    static float maxRotation = 0;

    Vector3D gyro;
    M5.Imu.getGyroData(&gyro.x, &gyro.y, &gyro.z);

    auto checkRotation = [this](float rotation, const char *axis)
    {
        if (std::abs(rotation) > ROTATION_THRESHOLD)
        {
            Serial.printf("[CALIB] Good rotation detected on %s axis: %.2f rad/s\n", axis, rotation);
            return true;
        }
        return false;
    };

    auto checkStillness = [this](const Vector3D &gyro)
    {
        return gyro.magnitude() < STILLNESS_THRESHOLD;
    };

    switch (moveState)
    {
    case MovementState::ROTATE_X:
        deviceDisplay.showCalibrationProgress(0);
        Serial.println("[CALIB] Please rotate around X axis");
        if (checkRotation(gyro.x, "X"))
        {
            moveState = MovementState::CHECK_X;
            stateTimer = millis();
        }
        break;

    case MovementState::CHECK_X:
        if (millis() - stateTimer > ROTATION_CHECK_DELAY)
        {
            if (checkStillness(gyro))
            {
                moveState = MovementState::ROTATE_Y;
                maxRotation = 0;
            }
        }
        break;

    case MovementState::ROTATE_Y:
        deviceDisplay.showCalibrationProgress(33);
        Serial.println("[CALIB] Please rotate around Y axis");
        if (checkRotation(gyro.y, "Y"))
        {
            moveState = MovementState::CHECK_Y;
            stateTimer = millis();
        }
        break;

    case MovementState::CHECK_Y:
        if (millis() - stateTimer > ROTATION_CHECK_DELAY)
        {
            if (checkStillness(gyro))
            {
                moveState = MovementState::ROTATE_Z;
                maxRotation = 0;
            }
        }
        break;

    case MovementState::ROTATE_Z:
        deviceDisplay.showCalibrationProgress(66);
        Serial.println("[CALIB] Please rotate around Z axis");
        if (checkRotation(gyro.z, "Z"))
        {
            moveState = MovementState::CHECK_Z;
            stateTimer = millis();
        }
        break;

    case MovementState::CHECK_Z:
        if (millis() - stateTimer > ROTATION_CHECK_DELAY)
        {
            if (checkStillness(gyro))
            {
                moveState = MovementState::COMPLETE;
            }
        }
        break;

    case MovementState::COMPLETE:
        deviceDisplay.showCalibrationProgress(100);
        Serial.println("[CALIB] Movement validation complete");
        moveState = MovementState::ROTATE_X; // Reset for next time
        return true;
    }

    if (sampleCounter++ > MOVEMENT_SAMPLES)
    {
        Serial.println("[CALIB] Movement validation timeout");
        moveState = MovementState::ROTATE_X; // Reset for next time
        return false;
    }

    return false;
}

// Calibration Management
bool SetupCalibration::isCalibrationValid() const
{
    if (!calibData.isValid)
        return false;
    if (getCalibrationAge() > MAX_CALIBRATION_AGE)
        return false;
    return validateCalibrationData();
}

bool SetupCalibration::validateCalibrationData() const
{
    float currentTemp;
    M5.Imu.getTemp(&currentTemp);

    // Check temperature difference
    if (std::abs(currentTemp - calibData.temperature) > MAX_TEMP_DIFFERENCE)
    {
        return false;
    }

    // Validate position data
    for (const auto &pos : calibData.positionData)
    {
        if (!pos.isValid || pos.varAccel > MAX_VARIANCE_THRESHOLD ||
            pos.varGyro > MAX_VARIANCE_THRESHOLD)
        {
            return false;
        }
    }

    return true;
}

uint32_t SetupCalibration::getCalibrationAge() const
{
    return millis() - calibData.timestamp;
}

Vector3D SetupCalibration::applyTemperatureCompensation(const Vector3D &data, float currentTemp)
{
    float tempDiff = currentTemp - calibData.temperature;
    // Simple linear temperature compensation - can be improved with actual characterization data
    // float compensationFactor = 1.0f + (tempDiff * 0.001f); // 0.1% per degree
    float compensationFactor = 1.0f; // TODO: Find actual compensation factor, both for accel and gyro
    return Vector3D(
        data.x * compensationFactor,
        data.y * compensationFactor,
        data.z * compensationFactor);
}

// UI & Communication
void SetupCalibration::transitionTo(CalibrationState newState)
{
    currentState = newState;
    stateStartTime = millis();
    sampleCount = 0;
    sendStatusToApp();
    deviceDisplay.showCalibrationProgress(0);
}

void SetupCalibration::sendStatusToApp()
{
    if (!pCalibCharacteristic)
        return;

    // Add delay to prevent notification buffer overflow
    delay(20); // 20ms delay between notifications

    CalibrationProgress progress;
    progress.state = currentState;
    progress.progress = 0;
    M5.Imu.getTemp(&progress.temperature);
    progress.positionIndex = currentState >= CalibrationState::POSITION_Z_UP &&
                                     currentState <= CalibrationState::POSITION_X_DOWN
                                 ? static_cast<uint8_t>(currentState) - static_cast<uint8_t>(CalibrationState::POSITION_Z_UP)
                                 : 0;
    progress.reserved = 0;

    pCalibCharacteristic->setValue(reinterpret_cast<uint8_t *>(&progress), sizeof(CalibrationProgress));
    pCalibCharacteristic->notify();
}

void SetupCalibration::updateProgress(uint8_t progress)
{
    deviceDisplay.showCalibrationProgress(progress);

    if (!pCalibCharacteristic)
        return;

    // Add delay to prevent notification buffer overflow
    delay(20); // 20ms delay between notifications

    CalibrationProgress statusUpdate;
    statusUpdate.state = currentState;
    statusUpdate.progress = progress;
    M5.Imu.getTemp(&statusUpdate.temperature);
    statusUpdate.positionIndex = currentState >= CalibrationState::POSITION_Z_UP &&
                                         currentState <= CalibrationState::POSITION_X_DOWN
                                     ? static_cast<uint8_t>(currentState) - static_cast<uint8_t>(CalibrationState::POSITION_Z_UP)
                                     : 0;
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
    calibData.isValid = false;
    transitionTo(CalibrationState::FAILED);
}

void SetupCalibration::startFullCalibration()
{
    if (calibrationInProgress)
        return;

    try
    {
        accelSamples.reset(new Vector3D[SAMPLES_PER_STATE]);
        gyroSamples.reset(new Vector3D[SAMPLES_PER_STATE]);
        calibrationInProgress = true;
        M5.Imu.getTemp(&initialTemp);
        transitionTo(CalibrationState::WARMUP);
    }
    catch (...)
    {
        Serial.println("[CALIB] Failed to allocate memory for full calibration");
        transitionTo(CalibrationState::FAILED);
    }
}

CorrectedData SetupCalibration::correctSensorData(const Vector3D &rawAccel, const Vector3D &rawGyro, float temp)
{
    CorrectedData result;

    if (!calibData.isValid)
    {
        result.accel = rawAccel;
        result.gyro = rawGyro;
        result.isValid = false;
        return result;
    }

    // Apply bias correction and temperature compensation
    result.accel = applyTemperatureCompensation(rawAccel - calibData.accelBias, temp);
    result.gyro = applyTemperatureCompensation(rawGyro - calibData.gyroBias, temp);
    result.isValid = true;

    return result;
}