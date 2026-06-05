import {
  PlatformData,
  platformDataByPlatform,
  validatePlatformData
} from "@/lib/domain/platform-data";

export function serializePlatformData(
  platform: keyof typeof platformDataByPlatform,
  value: unknown
): string {
  return JSON.stringify(validatePlatformData(platform, value));
}

export function parsePlatformData(
  platform: keyof typeof platformDataByPlatform,
  value: string
): PlatformData {
  return validatePlatformData(platform, JSON.parse(value));
}
