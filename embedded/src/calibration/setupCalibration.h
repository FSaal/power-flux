#pragma once
#include <M5StickCPlus2.h>
#include <BLECharacteristic.h>
#include "display/displayController.h"
#include "utils/logger.h"
#include "utils/error.h"
#include <memory>

extern bool deviceConnected;

/**
 * @brief 3D vector structure for sensor data processing
 */
struct Vector3D
{
    float x, y, z;

    Vector3D(float _x = 0, float _y = 0, float _z = 0) : x(_x), y(_y), z(_z) {}

    Vector3D operator+(const Vector3D &other) const
    {
        return Vector3D(x + other.x, y + other.y, z + other.z);
    }

    Vector3D operator/(float scalar) const
    {
        return Vector3D(x / scalar, y / scalar, z / scalar);
    }

    Vector3D operator-(const Vector3D &other) const
    {
        return Vector3D(x - other.x, y - other.y, z - other.z);
    }

    float magnitude() const
    {
        return sqrt(x * x + y * y + z * z);
    }
};

/**
 * @brief Contains corrected sensor data after calibration
 */
struct CorrectedData
{
    Vector3D accel;
    Vector3D gyro;
    bool isValid;
};

enum class CalibrationState : uint8_t
{
    IDLE = 0,
    QUICK_STATIC_FLAT = 1,      // Device lying flat (display up)
    QUICK_WAITING_ROTATION = 2, // Waiting for user to rotate device
    QUICK_STABILIZING = 3,      // Waiting for stability after rotation
    QUICK_STATIC_SIDE = 4,      // Device on side (display towards user)
    QUICK_COMPLETE = 5,         // Calibration successful
    FAILED = 6                  // Calibration failed
};

struct __attribute__((packed)) CalibrationProgress
{
    CalibrationState state;
    uint8_t progress;
};

/**
 * @brief Stores calibration parameters for sensor correction
 */
struct CalibrationData
{
    Vector3D accelBias;
    Vector3D gyroBias;
    float accelScale;
    bool isValid;
};

/**
 * @brief Manages IMU calibration and data correction
 *
 * Handles the calibration process for both accelerometer and gyroscope,
 * stores calibration data, and provides corrected sensor readings.
 */
class SetupCalibration
{
public:
    static constexpr char MODULE_NAME[] = "CALIB";

    explicit SetupCalibration(BLECharacteristic *calibChar, DisplayController &disp) noexcept;

    Error startQuickCalibration();
    void abortCalibration() noexcept;
    void processCalibration();
    CorrectedData correctSensorData(const Vector3D &rawAccel, const Vector3D &rawGyro);
    [[nodiscard]] bool isCalibrationInProgress() const noexcept { return calibrationInProgress; }

private:
    DisplayController &deviceDisplay;
    BLECharacteristic *pCalibCharacteristic;
    bool calibrationInProgress;
    CalibrationState currentState;
    uint8_t currentProgress;
    uint32_t stateStartTime;
    uint32_t sampleCount;
    std::unique_ptr<Vector3D[]> accelSamples;
    std::unique_ptr<Vector3D[]> gyroSamples;
    CalibrationData calibData;
    Vector3D flatAccelMean;
    Vector3D sideAccelMean;

    void handleQuickStaticFlat();
    void handleQuickWaitingRotation();
    void handleQuickStabilizing();
    void handleQuickStaticSide();
    void calculateFlatPosition();
    void calculateSidePosition();
    Vector3D calculateMean(const Vector3D samples[], uint32_t count);
    void updateProgress(uint8_t progress);
    void transitionTo(CalibrationState newState);
    void sendStatusToApp();
};