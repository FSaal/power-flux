#pragma once
#include <M5StickCPlus2.h>
#include <BLECharacteristic.h>
#include <displayController.h>
#include <memory>
#include <array>

// Represents a 3D vector with basic operations
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

// Expected gravity vector for each calibration position
struct CalibrationPosition
{
    Vector3D expectedGravity;
    const char *description;
};

enum class CalibrationState : uint8_t
{
    IDLE = 0,
    WARMUP = 1,
    TEMP_CHECK = 2,
    BIAS_ESTIMATION = 3,
    POSITION_Z_UP = 4,   // Flat on table
    POSITION_Z_DOWN = 5, // Upside down
    POSITION_Y_UP = 6,   // Standing on long edge
    POSITION_Y_DOWN = 7, // Standing on opposite long edge
    POSITION_X_UP = 8,   // Standing on short edge
    POSITION_X_DOWN = 9, // Standing on opposite short edge
    MOVEMENT_CHECK = 10,
    COMPLETED = 11,
    FAILED = 12,
    QUICK_STATIC = 13,
    QUICK_VALIDATION = 14,
    QUICK_COMPLETE = 15
};

struct __attribute__((packed)) CalibrationProgress
{
    CalibrationState state;
    uint8_t progress; // 0-100
    float temperature;
    uint8_t positionIndex;
    uint8_t reserved;
};

struct PositionData
{
    Vector3D meanAccel;
    Vector3D meanGyro;
    float varAccel;
    float varGyro;
    bool isValid;
};

struct CalibrationData
{
    Vector3D accelBias;
    Vector3D gyroBias;
    std::array<PositionData, 6> positionData; // One for each main position
    float temperature;
    uint32_t timestamp;
    bool isValid;
};

class SetupCalibration
{
public:
    explicit SetupCalibration(BLECharacteristic *calibChar, DisplayController &disp) noexcept;

    void startCalibration();
    void abortCalibration() noexcept;
    void startQuickCalibration();
    void startFullCalibration();
    void processCalibration();
    bool isCalibrationValid() const;
    uint32_t getCalibrationAge() const;
    CorrectedData correctSensorData(const Vector3D &rawAccel, const Vector3D &rawGyro, float temp);
    [[nodiscard]] bool isCalibrationInProgress() const noexcept { return calibrationInProgress; }
    [[nodiscard]] const CalibrationData &getCalibrationData() const { return calibData; }

private:
    static constexpr uint32_t WARMUP_DURATION = 30000;  // 30 seconds
    static constexpr uint32_t SAMPLES_PER_STATE = 1000; // ~10 seconds at 100Hz
    static constexpr float TEMP_STABILITY_THRESHOLD = 0.5f;
    static constexpr uint16_t TEMP_CHECK_SAMPLES = 100;
    static constexpr float GRAVITY_MAGNITUDE = 1.00f;                    // TODO: Current hotfix since IMU values are already normalized
    static constexpr float POSITION_TOLERANCE = 0.2f;                    // Acceptable deviation from expected gravity
    static constexpr float ROTATION_THRESHOLD = 0.5f;                    // rad/s
    static constexpr float STILLNESS_THRESHOLD = 0.1f;                   // rad/s
    static constexpr uint32_t MOVEMENT_SAMPLES = 500;                    // 5 seconds at 100Hz
    static constexpr uint32_t ROTATION_CHECK_DELAY = 2000;               // 2s delay between rotations
    static constexpr uint32_t MAX_CALIBRATION_AGE = 24 * 60 * 60 * 1000; // 24 hours
    static constexpr float MAX_TEMP_DIFFERENCE = 10.0f;                  // °C
    static constexpr float MAX_VARIANCE_THRESHOLD = 0.5f;
    static constexpr uint32_t QUICK_SAMPLES = 200; // 2 seconds at 100Hz
    static constexpr float QUICK_POSITION_TOLERANCE = 0.5f;
    static constexpr float QUICK_MOVEMENT_TOLERANCE = 0.2f;

    DisplayController &deviceDisplay;
    BLECharacteristic *pCalibCharacteristic;
    bool calibrationInProgress;
    CalibrationState currentState;
    uint32_t stateStartTime;
    uint32_t sampleCount;
    float initialTemp;

    std::unique_ptr<Vector3D[]> accelSamples;
    std::unique_ptr<Vector3D[]> gyroSamples;
    std::vector<float> temperatureHistory;
    CalibrationData calibData;

    static const std::array<CalibrationPosition, 6> calibrationPositions;

    // State handlers
    void handleWarmup();
    void handleTempCheck();
    void handleBiasEstimation();
    void handlePositionCalibration();
    void handleMovementCheck();

    // Helper methods
    void updateProgress(uint8_t progress);
    void transitionTo(CalibrationState newState);
    void sendStatusToApp();
    bool isTemperatureStable();
    void collectSample();
    Vector3D applyTemperatureCompensation(const Vector3D &data, float currentTemp);
    bool validateCalibrationData() const;
    void calculatePositionData(size_t positionIndex);
    bool validatePosition(const Vector3D &gravity, size_t positionIndex);
    bool processMovementValidation();
    void calculateBias();

    void handleQuickStatic();
    void handleQuickValidation();
    bool validateQuickPosition(const Vector3D &gravity);
};