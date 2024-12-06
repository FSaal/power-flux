#pragma once
#include <M5StickCPlus2.h>
#include "utils/logger.h"
#include "config/config.h"

/**
 * @brief Controls the M5Stick display, managing power state and content updates
 *
 * Handles display sleep/wake cycles, battery information updates, and various
 * UI states including calibration and connection status.
 */
class DisplayController
{
public:
    // Constants
    static constexpr char MODULE_NAME[] = "DISPLAY";

    DisplayController() : lastActivity(0), displayOn(true), lastBatteryUpdate(0) {}

    /**
     * @brief Initializes the display with default settings
     */
    void begin()
    {
        Logger::info(MODULE_NAME, "Initializing display");
        M5.Lcd.setRotation(3);
        updateDisplayStatus(false, false);
    }

    /**
     * @brief Updates the display with current device status
     * @param bleConnected Current BLE connection state
     * @param isRecording Whether the device is currently recording
     */
    void updateDisplayStatus(bool bleConnected, bool isRecording)
    {
        wakeDisplay();
        Logger::logf(Logger::Level::INFO, MODULE_NAME,
                     "Updating status: BLE %s, Recording %s",
                     bleConnected ? "ON" : "OFF",
                     isRecording ? "ON" : "OFF");
        drawMainScreen(bleConnected);
    }

    void manageDisplayState()
    {
        if (displayOn && (millis() - lastActivity > Config::Display::DISPLAY_TIMEOUT))
        {
            Logger::debug(MODULE_NAME, "Display timeout - entering sleep");
            M5.Lcd.sleep();
            displayOn = false;
        }
        if (displayOn && (millis() - lastBatteryUpdate > Config::Display::BATTERY_UPDATE_INTERVAL))
        {
            updateBatteryInfo();
        }
    }

    void wakeDisplay()
    {
        if (!displayOn)
        {
            Logger::debug(MODULE_NAME, "Waking display");
        }
        M5.Lcd.wakeup();
        displayOn = true;
        lastActivity = millis();
    }

    /**
     * @brief Shows calibration progress on screen
     * @param progress Current progress percentage (0-100)
     */
    void showCalibrationProgress(int progress)
    {
        wakeDisplay();
        M5.Lcd.startWrite();
        M5.Lcd.fillScreen(PURPLE);
        M5.Lcd.setCursor(0, 0);
        M5.Lcd.setTextSize(2);
        M5.Lcd.setTextColor(WHITE);
        M5.Lcd.println("Calibrating...");
        M5.Lcd.setCursor(0, 30);
        M5.Lcd.printf("Progress: %d%%", progress);
        M5.Lcd.endWrite();
        lastActivity = millis();
    }

    void showCalibrationInstruction(const char *instruction)
    {
        wakeDisplay();
        M5.Lcd.startWrite();
        M5.Lcd.fillScreen(PURPLE);
        M5.Lcd.setCursor(0, 0);
        M5.Lcd.setTextSize(2);
        M5.Lcd.setTextColor(WHITE);
        M5.Lcd.println("Calibrating...");
        M5.Lcd.setCursor(0, 30);
        M5.Lcd.println(instruction);
        M5.Lcd.endWrite();
        lastActivity = millis();
    }

private:
    uint32_t lastActivity;
    uint32_t lastBatteryUpdate;
    bool displayOn;

    void drawMainScreen(bool bleConnected)
    {
        M5.Lcd.startWrite();
        M5.Lcd.fillScreen(BLACK);
        M5.Lcd.setCursor(5, 5);
        M5.Lcd.setTextSize(2);

        M5.Lcd.setTextColor(bleConnected ? GREEN : RED);
        M5.Lcd.drawString(bleConnected ? "BLE: Connected" : "BLE: Waiting", 5, 5);
        M5.Lcd.setTextColor(WHITE);

        float batteryLevel = M5.Power.getBatteryLevel();
        char batteryStr[16];
        snprintf(batteryStr, sizeof(batteryStr), "BAT: %.0f%%", batteryLevel);
        M5.Lcd.drawString(batteryStr, 5, 55);

        M5.Lcd.endWrite();
        lastActivity = millis();
        lastBatteryUpdate = millis();
    }

    void updateBatteryInfo()
    {
        if (!displayOn)
            return;

        float batteryLevel = M5.Power.getBatteryLevel();
        Logger::logf(Logger::Level::DEBUG, MODULE_NAME, "Battery level: %.1f%%", batteryLevel);

        M5.Lcd.startWrite();
        M5.Lcd.fillRect(5, 55, M5.Lcd.width() - 10, 20, BLACK);
        char batteryStr[16];
        snprintf(batteryStr, sizeof(batteryStr), "BAT: %.0f%%", batteryLevel);
        M5.Lcd.drawString(batteryStr, 5, 55);
        M5.Lcd.endWrite();

        lastBatteryUpdate = millis();
    }
};