#pragma once
#include <M5StickCPlus2.h>
#include <BLECharacteristic.h>
#include <displayController.h>
#include <memory>

extern bool deviceConnected;

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
    uint8_t progress; // 0-100%
};

struct CalibrationData
{
    Vector3D accelBias; // Accelerometer offset correction
    Vector3D gyroBias;  // Gyroscope offset correction
    float accelScale;   // Accelerometer scale factor
    bool isValid;       // Indicates if calibration data is valid
};

class SetupCalibration
{
public:
    explicit SetupCalibration(BLECharacteristic *calibChar, DisplayController &disp) noexcept;

    void startQuickCalibration();
    void abortCalibration() noexcept;
    void processCalibration();
    CorrectedData correctSensorData(const Vector3D &rawAccel, const Vector3D &rawGyro, float temp);
    [[nodiscard]] bool isCalibrationInProgress() const noexcept { return calibrationInProgress; }

private:
    // Calibration constants
    static constexpr float GRAVITY_MAGNITUDE = 1.0f;   // Gravity in g
    static constexpr uint32_t QUICK_SAMPLES = 200;     // Samples per position
    static constexpr float MOVEMENT_TOLERANCE = 20.0f; // TODO: Hotfix since gyr not cal yet- Maximum allowed movement during sampling
    static constexpr float STILLNESS_THRESHOLD = 5.1f; // TODO: Hotfix for now Maximum gyro reading to consider device still
    static constexpr float ROTATION_THRESHOLD = 70.0f; // Minimum degrees of rotation required
    static constexpr uint32_t STABLE_DURATION = 1000;  // Ms of stability required before sampling
    static constexpr float GYRO_DEADBAND = 0.05f;      // Gyro readings below this are considered zero
    static constexpr float MIN_SCALE_FACTOR = 0.5f;    // Minimum acceptable scale factor
    static constexpr float MAX_SCALE_FACTOR = 2.0f;    // Maximum acceptable scale factor

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
    Vector3D flatAccelMean; // Stores mean acceleration from flat position
    Vector3D sideAccelMean; // Stores mean acceleration from side position

    // State handlers
    void handleQuickStaticFlat();
    void handleQuickWaitingRotation();
    void handleQuickStabilizing();
    void handleQuickStaticSide();

    // Helper methods
    void calculateFlatPosition();
    void calculateSidePosition();
    Vector3D calculateMean(const Vector3D samples[], uint32_t count);
    void updateProgress(uint8_t progress);
    void transitionTo(CalibrationState newState);
    void sendStatusToApp();
};