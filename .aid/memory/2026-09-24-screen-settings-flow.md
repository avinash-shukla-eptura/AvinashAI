# Screen Settings Request Flow Research

Date: 2026-09-24

## Summary

Connect screen settings delivery is centered in `Connect-ScreenManager`.

Primary single-device request flow:
- `RequestScreenSettings` HTTP GET `ScreenSettings/{deviceId}` or `RequestScreenSettingsQueue` Service Bus trigger.
- `RequestScreenSettingsHandler` resolves the device via `IScreenSettingsService.RequestScreenSettingsAsync`.
- `ScreenSettingsOrchestrator` loads room and account data, then calls `SendAllDeviceSettingsActivity`.
- `ScreenSettingsService.SendDeviceSettingsAsync` builds device settings, theme, and calendar-provider payloads.
- Delivery is split between IoT Hub desired properties and Service Bus cloud-to-device messages, based on device version capability and `sendDeviceSettingDeviceTwin`.

Related fan-out flows:
- `SendUpdatedSettings` HTTP GET `ScreenSettings/{accountId}/{calendarServiceId}` with optional `devicesettingid` schedules `SendUpdateSettingsOrchestrator`.
- Without `devicesettingid`, it sends calendar provider settings to rooms using that calendar service.
- With `devicesettingid`, it pages devices assigned to that screen setting and updates only device settings.
- Screen theme updates have a parallel `SendUpdatedThemeSettings` path.
- `RefreshTwinQueue` and `TwinRefreshOrchestrator` refresh only twin desired properties for a device.

## Refactor Notes

- Payload construction is duplicated across full settings, calendar-only, theme-only, and device-setting-only flows.
- Routing between twin and C2D is repeated and should be centralized.
- Service Bus batching is repeated in multiple private methods.
- ETag comparison and twin desired property mutation are spread across methods.
- Web API `DeviceSettingsController` owns settings CRUD, while Web API `ScreenController` has a manual send path through `IScreenManager.SendDeviceSettingsAsync`.
