#pragma once
#include <Arduino.h>

class Logger
{
public:
    enum class Level
    {
        DEBUG, // Detailed information for debugging
        INFO,  // General operational messages
        WARN,  // Warning messages for potential issues
        ERROR  // Error messages for actual problems
    };

    // Main logging method with source location
    static void log(Level level, const char *module, const char *message)
    {
        if (!Serial)
            return; // Guard against uninitialized Serial

        const char *levelStr;
        switch (level)
        {
        case Level::DEBUG:
            levelStr = "DEBUG";
            break;
        case Level::INFO:
            levelStr = "INFO";
            break;
        case Level::WARN:
            levelStr = "WARN";
            break;
        case Level::ERROR:
            levelStr = "ERROR";
            break;
        }

        // Format: [TIME][LEVEL][MODULE] Message
        Serial.printf("[%lu][%s][%s] %s\n", millis(), levelStr, module, message);
    }

    // Convenience methods
    static void debug(const char *module, const char *message)
    {
        log(Level::DEBUG, module, message);
    }

    static void info(const char *module, const char *message)
    {
        log(Level::INFO, module, message);
    }

    static void warn(const char *module, const char *message)
    {
        log(Level::WARN, module, message);
    }

    static void error(const char *module, const char *message)
    {
        log(Level::ERROR, module, message);
    }

    // Method for logging with formatting
    template <typename... Args>
    static void logf(Level level, const char *module, const char *format, Args... args)
    {
        char buffer[256];
        snprintf(buffer, sizeof(buffer), format, args...);
        log(level, module, buffer);
    }
};