// setupCalibration.h
#pragma once
#include <M5StickCPlus2.h>
#include <BLECharacteristic.h>
#include <displayController.h>
#include <memory>

struct Vector3D
{
    float x;
    float y;
    float z;

    Vector3D() : x(0), y(0), z(0) {}
    Vector3D(float _x, float _y, float _z) : x(_x), y(_y), z(_z) {}

    // Operator overloading for vector operations
    Vector3D operator+(const Vector3D &other) const
    {
        return Vector3D(x + other.x, y + other.y, z + other.z);
    }

    Vector3D operator/(float scalar) const
    {
        return Vector3D(x / scalar, y / scalar, z / scalar);
    }
};

// Calibration states that will be communicated to the app
enum class CalibrationState : uint8_t
{
    IDLE = 0,
    WARMUP = 1,          // Initial warmup period
    TEMP_CHECK = 2,      // Check if temperature is stable
    BIAS_ESTIMATION = 3, // Initial bias estimation
    MULTI_POSITION = 4,  // Multi-position calibration
    MOVEMENT_CHECK = 5,  // Basic movement validation
    COMPLETED = 6,
    FAILED = 7
};

// Calibration progress information sent to app
struct __attribute__((packed)) CalibrationProgress
{
    CalibrationState state; // Current state
    uint8_t progress;       // Progress in current state (0-100)
    float temperature;      // Current temperature
    uint8_t positionIndex;  // Current position in multi-position phase
    uint8_t reserved;       // For future use/alignment
};

struct BiasData
{
    Vector3D accelBias;
    Vector3D gyroBias;
    float temperature;
    uint32_t timestamp;
};

class SetupCalibration
{
public:
    explicit SetupCalibration(BLECharacteristic *calibChar, DisplayController &disp) noexcept;

    void startCalibration();
    void abortCalibration() noexcept;
    void processCalibration();
    [[nodiscard]] bool isCalibrationInProgress() const noexcept { return calibrationInProgress; }

private:
    static constexpr uint32_t WARMUP_DURATION = 30000;      // 30 seconds warmup
    static constexpr uint32_t SAMPLES_PER_STATE = 1000;     // ~10 seconds at 100Hz
    static constexpr float TEMP_STABILITY_THRESHOLD = 0.5f; // Maximum temperature change (°C)
    static constexpr uint16_t TEMP_CHECK_SAMPLES = 100;     // Samples for temperature stability check

    DisplayController &display;
    BLECharacteristic *pCalibCharacteristic;
    bool calibrationInProgress;
    CalibrationState currentState;
    uint32_t stateStartTime;
    uint32_t sampleCount;
    float initialTemp;

    // Buffers for bias estimation
    std::unique_ptr<Vector3D[]> accelSamples;
    std::unique_ptr<Vector3D[]> gyroSamples;
    std::vector<float> temperatureHistory;
    BiasData biasData;

    // State machine methods
    void handleWarmup();
    void handleTempCheck();
    void handleBiasEstimation();
    void updateProgress(uint8_t progress);
    void transitionTo(CalibrationState newState);
    void sendStatusToApp();
    bool isTemperatureStable();
    void collectSample();
    void calculateBias();
};