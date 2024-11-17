// IMUCalibration.h
#pragma once
#include <M5StickCPlus2.h>
#include <EEPROM.h>

struct Vector3D
{
    float x, y, z;
};

// Calibration data structure (will be stored in EEPROM)
struct CalibrationData
{
    // Offset values
    Vector3D accelBias;
    Vector3D gyroBias;

    // Scale factors
    Vector3D accelScale;
    Vector3D gyroScale;

    // Temperature compensation
    float tempAtCalibration;
    Vector3D tempSensitivity; // Change per degree

    // Calibration status
    uint32_t calibrationTime; // When was last calibration
    bool isCalibrated;
};

class IMUCalibration
{
public:
    IMUCalibration();

    // Initialize calibration
    bool begin();

    // Main calibration routines
    bool performStaticCalibration(uint16_t samples = 1000);
    bool performScaleCalibration();
    bool performTempCalibration();

    // Apply calibration to raw readings
    Vector3D getCalibratedAccel();
    Vector3D getCalibratedGyro();

    // Orientation detection (returns gravity-aligned coordinates)
    Vector3D getGravityAlignedAccel();

    // Temperature compensation
    void updateTempCompensation();

    // Calibration storage
    bool saveCalibration();
    bool loadCalibration();

private:
    CalibrationData calibData;
    float currentTemp;

    // Orientation detection
    Vector3D gravityVector;
    void updateGravityVector();

    // Utility functions
    Vector3D calculateMean(Vector3D *samples, uint16_t count);
    Vector3D calculateStdDev(Vector3D *samples, uint16_t count, Vector3D mean);
};