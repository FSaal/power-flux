#include "IMUCalibration.h"

IMUCalibration::IMUCalibration()
{
    memset(&calibData, 0, sizeof(CalibrationData));
}

bool IMUCalibration::begin()
{
    EEPROM.begin(sizeof(CalibrationData));
    return loadCalibration();
}

bool IMUCalibration::performStaticCalibration(uint16_t samples)
{
    // Similar to Python's list comprehension for collecting samples
    Vector3D *accelSamples = new Vector3D[samples];
    Vector3D *gyroSamples = new Vector3D[samples];

    // Collect samples while device is static
    for (uint16_t i = 0; i < samples; i++)
    {
        float ax, ay, az, gx, gy, gz;
        M5.Imu.getAccelData(&ax, &ay, &az);
        M5.Imu.getGyroData(&gx, &gy, &gz);

        accelSamples[i] = {ax, ay, az};
        gyroSamples[i] = {gx, gy, gz};

        delay(5); // 200Hz sampling
    }

    // Calculate mean (bias)
    calibData.accelBias = calculateMean(accelSamples, samples);
    calibData.gyroBias = calculateMean(gyroSamples, samples);

    // Calculate scale factors
    calibData.accelScale = calculateStdDev(accelSamples, samples, calibData.accelBias);
    calibData.gyroScale = calculateStdDev(gyroSamples, samples, calibData.gyroBias);

    delete[] accelSamples;
    delete[] gyroSamples;

    // Store temperature reference
    M5.Imu.getTemp(&calibData.tempAtCalibration);
    calibData.isCalibrated = true;
    calibData.calibrationTime = millis();

    return saveCalibration();
}

Vector3D IMUCalibration::getGravityAlignedAccel()
{
    // Update gravity vector first
    updateGravityVector();

    // Get calibrated acceleration
    Vector3D accel = getCalibratedAccel();

    // Create rotation matrix from gravity vector
    // This will align the Z-axis with gravity
    float xx, yy, zz, xy, xz, yz, wx, wy, wz;
    xx = gravityVector.x * gravityVector.x;
    yy = gravityVector.y * gravityVector.y;
    zz = gravityVector.z * gravityVector.z;
    xy = gravityVector.x * gravityVector.y;
    xz = gravityVector.x * gravityVector.z;
    yz = gravityVector.y * gravityVector.z;
    wx = gravityVector.x * accel.x;
    wy = gravityVector.y * accel.y;
    wz = gravityVector.z * accel.z;

    // Rotation matrix components
    float R[3][3];
    R[0][0] = 1 - 2 * (yy + zz);
    R[0][1] = 2 * (xy - wz);
    R[0][2] = 2 * (xz + wy);
    R[1][0] = 2 * (xy + wz);
    R[1][1] = 1 - 2 * (xx + zz);
    R[1][2] = 2 * (yz - wx);
    R[2][0] = 2 * (xz - wy);
    R[2][1] = 2 * (yz + wx);
    R[2][2] = 1 - 2 * (xx + yy);

    // Apply rotation (matrix multiplication)
    Vector3D aligned;
    aligned.x = R[0][0] * accel.x + R[0][1] * accel.y + R[0][2] * accel.z;
    aligned.y = R[1][0] * accel.x + R[1][1] * accel.y + R[1][2] * accel.z;
    aligned.z = R[2][0] * accel.x + R[2][1] * accel.y + R[2][2] * accel.z;

    return aligned;
}

void IMUCalibration::updateGravityVector()
{
    Vector3D accel = getCalibratedAccel();

    // Low-pass filter for gravity vector (alpha = 0.1)
    // Similar to Python's exponential moving average
    const float alpha = 0.1f;
    float magnitude = sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z);

    if (abs(magnitude - 1.0f) < 0.1f)
    { // Only update when acceleration is close to 1g
        gravityVector.x = alpha * (accel.x / magnitude) + (1 - alpha) * gravityVector.x;
        gravityVector.y = alpha * (accel.y / magnitude) + (1 - alpha) * gravityVector.y;
        gravityVector.z = alpha * (accel.z / magnitude) + (1 - alpha) * gravityVector.z;
    }
}