#pragma once
#include <M5StickCPlus2.h>

/**
 * @brief Central configuration for the PowerFlux device
 *
 * Contains all configurable parameters organized by feature area.
 * Modify these values to adjust device behavior.
 */
struct Config
{
    struct BLE
    {
        static constexpr char DEVICE_NAME[] = "PowerFlux";
        static constexpr char SERVICE_UUID[] = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
        static constexpr char CHAR_ACC_UUID[] = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
        static constexpr char CHAR_GYR_UUID[] = "beb5483e-36e1-4688-b7f5-ea07361b26a9";
        static constexpr char CHAR_CALIB_UUID[] = "beb5483e-36e1-4688-b7f5-ea07361b26aa";
    };

    struct Display
    {
        static constexpr uint32_t DISPLAY_TIMEOUT = 10000;         // ms before display sleep
        static constexpr uint32_t BATTERY_UPDATE_INTERVAL = 60000; // ms between battery updates
        static constexpr uint16_t LCD_ROTATION = 3;                // Horizontal screen
    };

    struct ButtonControl
    {
        static constexpr uint32_t TRIPLE_CLICK_WINDOW = 1000; // ms
        static constexpr uint32_t CLICK_THRESHOLD = 300;      // ms
    };

    struct Timing
    {
        static constexpr uint32_t CONNECTION_CHECK_INTERVAL = 1000; // ms
        static constexpr uint32_t SENSOR_UPDATE_INTERVAL = 50;      // ms (20Hz)
        static constexpr uint32_t POST_CONNECT_DELAY = 100;         // ms
        static constexpr uint32_t POST_DISCONNECT_DELAY = 500;      // ms
    };

    struct IMU
    {
        struct Registers
        {
            static constexpr uint8_t GYRO_CONFIG = 0x1B;
            static constexpr uint8_t ACCEL_CONFIG = 0x1C;
            static constexpr uint8_t DLPF_CONFIG = 0x1A;
            static constexpr uint8_t SAMPLE_RATE_DIV = 0x19;
        };

        struct Values
        {
            static constexpr uint8_t GYRO_FS_250DPS = 0x0;  // ±250°/s
            static constexpr uint8_t ACCEL_FS_8G = 0x2;     // ±8g
            static constexpr uint8_t DLPF_20HZ = 0x4;       // 20Hz bandwidth
            static constexpr uint8_t SAMPLE_RATE_100HZ = 9; // 1000Hz/(9+1)
        };
    };

    struct Calibration
    {
        static constexpr float GRAVITY_MAGNITUDE = 1.0f;   // Expected gravity magnitude in g
        static constexpr uint32_t QUICK_SAMPLES = 200;     // Samples per calibration position
        static constexpr float MOVEMENT_TOLERANCE = 20.0f; // TODO: Hotfix since gyr not cal yet- Maximum allowed movement during sampling
        static constexpr float STILLNESS_THRESHOLD = 5.1f; // TODO: Hotfix for now Maximum gyro reading to consider device still
        static constexpr float ROTATION_THRESHOLD = 70.0f; // Min degrees for rotation detection
        static constexpr uint32_t STABLE_DURATION = 1000;  // ms of stability needed
        static constexpr float GYRO_DEADBAND = 0.05f;      // Gyro readings below this are zero
        static constexpr float MIN_SCALE_FACTOR = 0.5f;    // Min acceptable scale factor
        static constexpr float MAX_SCALE_FACTOR = 2.0f;    // Max acceptable scale factor
    };
};