#pragma once
#include <M5StickCPlus2.h>
#include <BLECharacteristic.h>
#include <displayController.h>
#include <memory>
#include <array>

extern bool deviceConnected;

struct Vector3D
{
    float x, y, z;

    Vector3D operator+(const Vector3D &other) const noexcept
    {
        return {x + other.x, y + other.y, z + other.z};
    }

    Vector3D operator/(float scalar) const noexcept
    {
        return {x / scalar, y / scalar, z / scalar};
    }
};

struct CalibrationData
{
    Vector3D accelBias;
    Vector3D gyroBias;
    Vector3D accelScale;
    Vector3D gyroScale;
    float tempReference;
    bool isCalibrated;
    uint32_t timestamp;
};

class SetupCalibration
{
public:
    explicit SetupCalibration(BLECharacteristic *calibChar, DisplayController &disp) noexcept;
    ~SetupCalibration() = default;

    SetupCalibration(const SetupCalibration &) = delete;
    SetupCalibration &operator=(const SetupCalibration &) = delete;
    SetupCalibration(SetupCalibration &&) = delete;
    SetupCalibration &operator=(SetupCalibration &&) = delete;

    void startCalibration();
    void abortCalibration() noexcept;
    void processCalibration();
    [[nodiscard]] bool isCalibrationInProgress() const noexcept { return calibrationInProgress; }
    [[nodiscard]] CalibrationData getCalibrationData() const noexcept;
    [[nodiscard]] bool hasCalibrationData() const noexcept { return calibData.isCalibrated; }

private:
    DisplayController &display;
    static constexpr uint16_t SAMPLES_REQUIRED = 200;
    static constexpr uint16_t STABILITY_THRESHOLD = 10;

    BLECharacteristic *pCalibCharacteristic;
    bool calibrationInProgress;
    uint16_t sampleCount;

    CalibrationData calibData;
    std::unique_ptr<Vector3D[]> accelSamples;
    std::unique_ptr<Vector3D[]> gyroSamples;

    void collectSample();
    void calculateCalibration() noexcept;
    void updateStatus(uint8_t status) noexcept;

    // Statistical methods
    [[nodiscard]] Vector3D calculateMean(const Vector3D *samples, uint16_t count) const noexcept;
    [[nodiscard]] Vector3D calculateStdDev(const Vector3D *samples, uint16_t count, const Vector3D &mean) const noexcept;
};