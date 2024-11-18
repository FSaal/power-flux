#pragma once
#include <M5StickCPlus2.h>

class DisplayController
{
public:
    static constexpr uint32_t DISPLAY_TIMEOUT = 15000;         // 15s
    static constexpr uint16_t BATTERY_UPDATE_INTERVAL = 30000; // 30s

    DisplayController() : lastActivity(0), displayOn(true), lastBatteryUpdate(0) {}

    void begin()
    {
        M5.begin();
        M5.Lcd.setRotation(3);
        updateDisplay();
    }

    void update()
    {
        M5.update();

        if (M5.BtnA.wasPressed())
        {
            wakeDisplay();
            return;
        }
        if (displayOn && (millis() - lastActivity > DISPLAY_TIMEOUT))
        {
            sleepDisplay();
        }
        if (displayOn && (millis() - lastBatteryUpdate > BATTERY_UPDATE_INTERVAL))
        {
            updateBatteryInfo();
        }
    }

    void wakeDisplay()
    {
        if (!displayOn)
        {
            M5.Lcd.wakeup();
            displayOn = true;
            lastActivity = millis();
            updateDisplay();
        }
    }

    void updateStatus(bool bleConnected, bool isRecording)
    {
        if (!displayOn)
            return;

        static bool prevBleStatus = false;
        static bool prevRecordingStatus = false;

        // Only update if status changed
        if (prevBleStatus == bleConnected && prevRecordingStatus == isRecording)
        {
            return;
        }

        prevBleStatus = bleConnected;
        prevRecordingStatus = isRecording;

        drawMainScreen(bleConnected);
    }

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

private:
    uint32_t lastActivity;
    uint32_t lastBatteryUpdate;
    bool displayOn;

    void sleepDisplay()
    {
        M5.Lcd.sleep();
        displayOn = false;
    }

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

        M5.Lcd.startWrite();
        M5.Lcd.fillRect(5, 55, M5.Lcd.width() - 10, 20, BLACK);
        char batteryStr[16];
        snprintf(batteryStr, sizeof(batteryStr), "BAT: %.0f%%", batteryLevel);
        M5.Lcd.drawString(batteryStr, 5, 55);
        M5.Lcd.endWrite();

        lastBatteryUpdate = millis();
    }

    void updateDisplay()
    {
        updateStatus(false, false);
    }
};