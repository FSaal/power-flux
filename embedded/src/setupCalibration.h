#pragma once
#include <M5StickCPlus2.h>
#include <BLECharacteristic.h>

struct Vector3D
{
    float x, y, z;

    Vector3D operator+(const Vector3D &other) const
    {
        return {x + other.x, y + other.y, z + other.z};
    }

    Vector3D operator/(float scalar) const
    {
        return {x / scalar, y / scalar, z / scalar};
    }
};

struct CalibrationData
{
    Vector3D accelBias;  // Offset correction
    Vector3D gyroBias;   // Offset correction
    Vector3D accelScale; // Scale factors
    Vector3D gyroScale;  // Scale factors
    float tempReference; // Temperature at calibration time
    bool isCalibrated;   // Calibration status flag
    uint32_t timestamp;  // When calibration was performed
};

class SetupCalibration
{
public:
    SetupCalibration(BLECharacteristic *calibChar);

    void startCalibration();
    void abortCalibration();
    void processCalibration();

    bool isCalibrationInProgress() const { return calibrationInProgress; }

private:
    // Constants
    static const uint16_t SAMPLES_REQUIRED = 200;   // Number of samples for calibration
    static const uint16_t STABILITY_THRESHOLD = 10; // Samples needed for stability

    BLECharacteristic *pCalibCharacteristic;
    bool calibrationInProgress;
    uint16_t sampleCount;

    // Calibration data storage
    CalibrationData calibData;
    Vector3D *accelSamples;
    Vector3D *gyroSamples;

    bool checkStability();
    void collectSample();
    void calculateCalibration();
    void updateStatus(uint8_t status);

    // Statistical methods
    Vector3D calculateMean(Vector3D *samples, uint16_t count);
    Vector3D calculateStdDev(Vector3D *samples, uint16_t count, const Vector3D &mean);
};