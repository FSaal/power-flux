#pragma once
#include <M5StickCPlus2.h>

/**
 * @class DisplayController
 * @brief Manages the display activities, including showing status, battery info, and calibration progress.
 */
class DisplayController
{
public:
    static constexpr uint32_t DISPLAY_TIMEOUT = 10000;         // 10 seconds before display timeout
    static constexpr uint16_t BATTERY_UPDATE_INTERVAL = 60000; // 60 seconds for battery update

    DisplayController() : lastActivity(0), displayOn(true), lastBatteryUpdate(0) {}

    void begin()
    {
        M5.Lcd.setRotation(3);             // Horizontal screen
        updateDisplayStatus(false, false); // Startup screen showing BLE status and recording status off
    }

    void updateDisplayStatus(bool bleConnected, bool isRecording)
    {
        wakeDisplay();
        Serial.printf("[DISPLAY] Updating status: BLE %s, Recording %s\n", bleConnected ? "ON" : "OFF", isRecording ? "ON" : "OFF");
        drawMainScreen(bleConnected); // TODO: Add recording status
    }

    void manageDisplayState()
{
    if (displayOn && (millis() - lastActivity > DISPLAY_TIMEOUT))
    {
        M5.Lcd.sleep();
        displayOn = false;
    }
    if (displayOn && (millis() - lastBatteryUpdate > BATTERY_UPDATE_INTERVAL))
    {
        updateBatteryInfo();
    }
}

    /**
     * @brief Wakes up the display if it is in sleep mode.
     */
    void wakeDisplay()
    {
        M5.Lcd.wakeup();
        displayOn = true;
        lastActivity = millis();
    }

    /**
     * @brief Displays the calibration progress on the screen.
     * @param progress Current calibration progress percentage.
     */
    void showCalibrationProgress(int progress)
    {
        this->wakeDisplay();
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
        this->wakeDisplay();
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
    uint32_t lastActivity;      // Last recorded activity time
    uint32_t lastBatteryUpdate; // Last recorded battery update time
    bool displayOn;             // Display on/off status

    /**
     * @brief Draws the main screen with the BLE connection status.
     * @param bleConnected Indicates BLE connection status.
     */
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

    /**
     * @brief Updates the battery information on the display.
     */
    void updateBatteryInfo()
    {
        if (!displayOn)
            return;

        float batteryLevel = M5.Power.getBatteryLevel();

        M5.Lcd.startWrite();
        M5.Lcd.fillRect(5, 55, M5.Lcd.width() - 10, 20, BLACK);
        char batteryStr[16];
        snprintf(batteryStr, sizeof(batteryStr), "BAT: %.0f%%", batteryLevel);
        M5.Lcd.drawString(batteryStr, 5, 55);
        M5.Lcd.endWrite();

        lastBatteryUpdate = millis();
    }
};
