export class OrientationFilter {
  private static readonly CF_ALPHA = 0.96;
  private static readonly GYRO_SCALE = 1.0 / 131.0; // For ±250°/s range
  private lastTimestamp: number | null = null;
  private orientation = { x: 0, y: 0, z: 0 }; // Roll, pitch, yaw in radians

  update(
    accel: { x: number; y: number; z: number },
    gyro: { x: number; y: number; z: number },
    timestamp: number,
  ): { x: number; y: number; z: number } {
    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
      return this.orientation;
    }

    const dt = (timestamp - this.lastTimestamp) / 1000.0; // Convert to seconds
    this.lastTimestamp = timestamp;

    // Calculate accelerometer angles
    const accelMagnitude = Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z);
    const isAccelReliable = Math.abs(accelMagnitude - 1.0) < 0.2;

    if (isAccelReliable) {
      const accelRoll = Math.atan2(accel.y, accel.z);
      const accelPitch = Math.atan2(-accel.x, Math.sqrt(accel.y * accel.y + accel.z * accel.z));

      // Complementary filter
      this.orientation.x =
        OrientationFilter.CF_ALPHA *
          (this.orientation.x + gyro.x * dt * OrientationFilter.GYRO_SCALE) +
        (1.0 - OrientationFilter.CF_ALPHA) * accelRoll;
      this.orientation.y =
        OrientationFilter.CF_ALPHA *
          (this.orientation.y + gyro.y * dt * OrientationFilter.GYRO_SCALE) +
        (1.0 - OrientationFilter.CF_ALPHA) * accelPitch;
    } else {
      this.orientation.x += gyro.x * dt * OrientationFilter.GYRO_SCALE;
      this.orientation.y += gyro.y * dt * OrientationFilter.GYRO_SCALE;
    }

    // Yaw from gyro only
    this.orientation.z += gyro.z * dt * OrientationFilter.GYRO_SCALE;

    // Normalize yaw to [-π, π]
    if (this.orientation.z > Math.PI) this.orientation.z -= 2 * Math.PI;
    if (this.orientation.z < -Math.PI) this.orientation.z += 2 * Math.PI;

    return { ...this.orientation };
  }
}
