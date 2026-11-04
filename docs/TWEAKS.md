# Что на самом деле делают твики

Документ отвечает на один вопрос: **этот твик реально что-то делает или это плацебо?**

Статусы:

- **РАБОТАЕТ** — твик меняет документированный параметр, который Windows действительно читает.
- **ЛЕГАСИ** — параметр существует, но современные версии Windows его игнорируют. Оставлен для совместимости, откат удаляет значение.
- **РИСК** — работает, но последствия серьёзные (перезагрузка, нестабильность, отключение защиты). Не входит ни в один пресет.
- **ПЛАЦЕБО** — механизма нет, ключ никто не читает. Кандидат на удаление из интерфейса.

---

## Задержка, таймеры, планировщик

| Твик | Механизм | Статус |
|------|----------|--------|
| `timerResolution05ms` | `NtSetTimerResolution(5000, TRUE)` — повышает разрешение системного таймера до 0.5 мс | РАБОТАЕТ (действует, пока приложение запущено) |
| `win32PrioritySeparation` | `HKLM\SYSTEM\CurrentControlSet\Control\PriorityControl` = `0x26` (кванты под игры), откат `0x2` | РАБОТАЕТ |
| `mmcssGamesPriority` | `SystemResponsiveness=0` + задачи `Games`: `GPU Priority=8`, `Priority=6` | НЕ РЕКОМЕНДУЕТСЯ: класс `High` отбирает время у звука, сети и диска. С 3.6.2 не входит в пресеты, остаётся ручным |
| `disableDynamicTick` | `bcdedit /set disabledynamictick yes` | ВРЕДНО на Zen 3 / Alder Lake+: повышает DPC-латентность. С 3.6.2 не входит в пресеты, остаётся ручным |
| `usePlatformClock` / `usePlatformTick` | `bcdedit /set useplatformclock yes|no` | Эффект на разных платформах разный вплоть до отрицательного. С 3.6.2 не входит в пресеты |
| `disableCoreParking` | `powercfg` — `CPMINCORES=100%` | РАБОТАЕТ |
| `disablePowerThrottling` | `PowerThrottlingOff=1` | РАБОТАЕТ |
| `disableCpuMitigations` | `FeatureSettingsOverride/OverrideMask` (Meltdown/Spectre-V2) | РИСК: снижает защиту, не отключает более поздние CVE |
| `disableVbsHvci` | `DeviceGuard` + `HypervisorEnforcedCodeIntegrity` = 0 | РИСК: отключает VBS/HVCI, ломает WSL2, Hyper-V, Docker и эмуляторы. Входит в Max Performance с 3.6.2 |
| `ultimatePowerPlan` | дублирует схему Ultimate Performance, откат — Balanced | РАБОТАЕТ. С 3.6.2 пресеты его не применяют, только ручной переключатель |

## Память

| Твик | Механизм | Статус |
|------|----------|--------|
| `largeSystemCache` | `LargeSystemCache=0` (десктопный режим), откат — удаление | РАБОТАЕТ. Раньше писал 1, то есть включал серверный режим при «включении» |
| `disablePagingExecutive` | `DisablePagingExecutive=1` — ядро не выгружается в файл подкачки | РАБОТАЕТ, но выигрыш заметен только при нехватке RAM |
| `ioPageLockLimit` | `IoPageLockLimit` | ЛЕГАСИ: игнорируется с Vista SP1 |
| `nonPagedPoolFix` | `PoolUsageMaximum=60` — на самом деле ограничивает **paged** pool | РАБОТАЕТ, но название врёт |
| `alwaysUnloadDll` | `AlwaysUnloadDLL` | ПЛАЦЕБО: игнорируется с Vista |

## Сеть

| Твик | Механизм | Статус |
|------|----------|--------|
| `tcpNoDelay` / `tcpAckFrequency` | `TcpAckFrequency=1`, `TCPNoDelay=1` **на каждом интерфейсе**; откат удаляет только существующие значения | РАБОТАЕТ |
| `disableNetworkThrottling` | `NetworkThrottlingIndex=0xFFFFFFFF`, откат `10` | РАБОТАЕТ |
| `defaultTTL64` | `DefaultTTL=64`, откат — удаление (система вернётся к 128) | РАБОТАЕТ |
| `optimalMTU` | MTU 1500 только физическим Ethernet/Wi-Fi, с сохранением прежнего значения | РАБОТАЕТ. Раньше писал 1500 даже в VPN/PPPoE |
| `disableNagleTicks` | `TcpDelAckTicks` | ЛЕГАСИ (удалён из записи) |

## Графика

| Твик | Механизм | Статус |
|------|----------|--------|
| `hagsEnabled` | `HwSchMode` = 2 (вкл) / 1 (выкл), Win10 2004+ | РАБОТАЕТ |
| `disableGameDVR` | `GameDVR_Enabled=0` + политика `AllowGameDVR=0` | РАБОТАЕТ |
| `disableFullscreenOptimizations` | глобального ключа не существует: `GameDVR_FSEBehaviorMode=2` + `HonorUserFSEBehaviorMode=1` — ближайший рабочий аналог | ЧАСТИЧНО. Настоящий механизм — флаг совместимости на каждый .exe |
| `gpuMsiMode` / `audioMsiMode` | `MSISupported=1` в `Enum\PCI\...\Interrupt Management` | РАБОТАЕТ, но **только** для устройств, чей драйвер уже объявил поддержку MSI |

## Ввод

| Твик | Механизм | Статус |
|------|----------|--------|
| `flatMouseCurve` | `MouseSpeed/Threshold1/Threshold2 = 0/0/0` + `SystemParametersInfo(SPI_SETMOUSE)`; откат `1/6/10` | РАБОТАЕТ |
| `keyboardMaxSpeed` | `KeyboardDelay=0`, `KeyboardSpeed=31` + SPI; откат `1/31` | РАБОТАЕТ |

## Загрузка и ОС

| Твик | Механизм | Статус |
|------|----------|--------|
| `bootuxDisabled` | `bcdedit /set {current} bootuxdisabled on`, откат — `deletevalue` | РАБОТАЕТ |
| `disable8dot3Names` | `fsutil 8dot3name set 1` + `NtfsDisable8dot3NameCreation`; откат `2` (per-volume) | РАБОТАЕТ |
| `disableLastAccess` | `NtfsDisableLastAccessUpdate` = 1, откат — удаление + `fsutil` в 2 | РАБОТАЕТ |
| `enableTrimSupport` | `DisableDeleteNotify=0` для NTFS и ReFS | РАБОТАЕТ (это «держать включённым», выключить нельзя — так и задумано) |
| `disablePrefetchSuperfetch` | `EnablePrefetcher=0` + остановка SysMain; откат `3` + automatic | РАБОТАЕТ, спорно на SSD |
| `disableHibernation` | `powercfg -h off` + `HibernateEnabled=0` | РАБОТАЕТ, освобождает `hiberfil.sys` |
| `disableReservedStorage` | `ShippedWithReserves=0` + DISM | РАБОТАЕТ |
| `waitScreenLock` | заставка/блокировка: `NoLockScreen` и тайм-ауты | РАБОТАЕТ |
| `enableF8Boot` | `bcdedit /set {default} bootmenupolicy legacy` | РАБОТАЕТ (детект всегда «выкл» — по реестру не определить) |
| `powerShellAcceleration` | `ngen install` по всем сборкам | РИСК: необратимое действие за чекбоксом |

## Телеметрия и приватность

| Твик | Механизм | Статус |
|------|----------|--------|
| `disableAllTelemetry` | `AllowTelemetry=0` + 15 подтвиков, включая hosts-блок | РАБОТАЕТ ЧАСТИЧНО: на Home/Pro Windows трактует 0 как 1 |
| `blockTelemetryDomains` | блок в `hosts` между маркерами BEGIN/END, резервная копия `hosts.wcsbak` | РАБОТАЕТ (раньше блок не удалялся и дублировался) |
| `disableOfficeTelemetry` | `Office\16.0\Common\Privacy\DisconnectedState=2` | РАБОТАЕТ |
| `disableNvidiaTelemetry` | задачи `NvTm*` через PowerShell (`schtasks` не умеет маски) | РАБОТАЕТ |
| `disableAdvertisingId` | политика `AdvertisingInfo\DisabledByGroupPolicy=1` | РАБОТАЕТ |
| `disableAppInventory` / `disableAppUsageStats` | `CommercialDataOptIn=0`, `CloudContent` | РАБОТАЕТ |
| `preventEdgeAutorun` | `MicrosoftEdge\Main\AllowPrelaunch` | ПЛАЦЕБО: Chromium Edge эти ключи не читает |
| `blockFacebookSync` / `blockSkypeSync` / `blockOutlookSync` | недокументированные значения | ПЛАЦЕБО |

## Безопасность (всё под РИСК)

| Твик | Механизм | Статус |
|------|----------|--------|
| `disableUAC` | `EnableLUA=0`, откат `1` + `ConsentPromptBehaviorAdmin=5` | РИСК: ломает Store-приложения, нужна перезагрузка |
| `disableDefenderRealtime` | политика `DisableRealtimeMonitoring` | РИСК |
| `disableCpuMitigations` | см. выше | РИСК |
| `disableVbsHvci` | см. выше | РИСК |
| `disableExeWarnings` / `disableDownloadWarnings` | `LowRiskFileTypes`, `SaveZoneInformation` | РИСК: снимает предупреждения о запуске скачанного |
| `disableAllEventLogs` | Application/System через `wevtutil`; **Security не трогается никогда** | РАБОТАЕТ |

## Службы и приложения

| Что | Механизм | Статус |
|-----|----------|--------|
| `DisableRecommendedServices` | список отключаемых служб | Из списка убраны `wuauserv`, `BITS`, Defender, `iphlpsvc`, `IKEEXT`, `WwanSvc`, телефония — иначе «оптимизация» ломала обновления и сеть |
| `removeSpyServices` | `DiagTrack`, `DPS`, `WdiServiceHost`, `WerSvc` | РАБОТАЕТ, обратимо |
| UWP-удаление | `Remove-AppxPackage` | РАБОТАЕТ, **необратимо** |
| MSI-профиль | только устройства с уже объявленной поддержкой MSI | РАБОТАЕТ, но на большинстве ПК применяется к немногому — это сделано специально |

---

## Почему не «всё включено»

Твики из раздела «РИСК» сознательно не входят в пресеты: пресет должен улучшать систему, а не превращать её в нечто, что потом не откатить. Если такой твик нужен — он включается вручную.

## Что осталось честно проблемным

- `AllowTelemetry=0` на домашних редакциях Windows не даёт полного эффекта — это ограничение самой ОС.
- Глобального выключателя Fullscreen Optimizations нет; используется ближайший рабочий аналог.
- MSI-профиль теперь безопасный, но из-за этого на многих машинах ему нечего включать.
- Показатель «standby» в очистке памяти — это системный кэш (`GetPerformanceInfo().SystemCache`), а не список ожидания. Число настоящее, метрика приблизительная.