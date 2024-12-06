#pragma once
#include <string>

class Error
{
public:
    enum class Code
    {
        NONE,
        BLE_INIT_FAILED,
        IMU_INIT_FAILED,
        CALIBRATION_FAILED,
        INVALID_STATE,
        MEMORY_ERROR
    };

    Error(Code code, const char *message) : code_(code), message_(message) {}

    Code code() const { return code_; }
    const char *message() const { return message_; }
    bool isError() const { return code_ != Code::NONE; }

private:
    Code code_;
    const char *message_;
};