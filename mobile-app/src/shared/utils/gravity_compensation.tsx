interface Vector3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Removes gravity component from acceleration data.
 * This is a simplified version that assumes device orientation
 * based purely on accelerometer data.
 */
export const removeGravity = (acceleration: Vector3D): Vector3D => {
  // Calculate total magnitude of acceleration
  const magnitude = Math.sqrt(
    acceleration.x * acceleration.x +
      acceleration.y * acceleration.y +
      acceleration.z * acceleration.z,
  );

  // Skip gravity removal if magnitude is significantly different from 1g
  // This indicates dynamic acceleration
  if (Math.abs(magnitude - 1.0) > 0.2) {
    return acceleration;
  }

  // Calculate gravity components using current orientation
  const gravityX = acceleration.x / magnitude;
  const gravityY = acceleration.y / magnitude;
  const gravityZ = acceleration.z / magnitude;

  // Remove gravity component (1g = 1 in normalized units)
  return {
    x: acceleration.x - gravityX,
    y: acceleration.y - gravityY,
    z: acceleration.z - gravityZ,
  };
};
