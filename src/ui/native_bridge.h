#pragma once

#include <windows.h>
#include <string>
#include <functional>
#include <mutex>
#include <vector>
#include <deque>
#include <thread>
#include <condition_variable>
#include <atomic>
#include "third_party/webview2/build/native/include/WebView2.h"
#include "third_party/json.hpp"

class NativeBridge {
public:
    static NativeBridge& Get();

    void RegisterWebView(ICoreWebView2* webView, bool isMain = true);
    void UnregisterWebView(ICoreWebView2* webView);

    void SetMainHwnd(HWND hWnd);
    void DispatchToUI(std::function<void()> task);
    void ProcessUITasks();

    // Process incoming WebMessage (JSON string) from frontend
    void HandleWebMessage(ICoreWebView2* sender, const std::wstring& messageW);

    // Broadcast JSON event to all registered WebViews
    void BroadcastEvent(const std::string& eventName, const nlohmann::json& payload);

    // Broadcast toast notification
    void ShowToast(const std::string& message, bool isError = false);

    // Trigger telemetry broadcast immediately
    void BroadcastTelemetry();

    // AppX state helper
    nlohmann::json HandleGetAppx();

    // Set callback to show memory cleaner window
    void SetOpenMemCleanerCallback(std::function<void()> cb) { m_openMemCleanerCb = cb; }
    void OpenMemCleanerWindow() { if (m_openMemCleanerCb) m_openMemCleanerCb(); }

private:
    NativeBridge();
    ~NativeBridge() = default;

    std::mutex m_mutex;
    std::vector<ICoreWebView2*> m_webViews;
    ICoreWebView2* m_mainWebView = nullptr;
    std::function<void()> m_openMemCleanerCb;

    HWND m_mainHwnd = nullptr;
    DWORD m_mainThreadId = 0;
    std::mutex m_uiTaskMutex;
    std::vector<std::function<void()>> m_uiTasks;

    // Serialized background job queue. All heavy actions run here one at a
    // time, so registry/BCD state is never mutated concurrently by two
    // requests, and a spammy frontend cannot spawn unbounded threads.
    static constexpr size_t kMaxQueuedJobs = 12;
    void StartWorker();
    bool EnqueueJob(std::function<void()> job);

    std::mutex m_jobMutex;
    std::condition_variable m_jobCv;
    std::deque<std::function<void()>> m_jobs;
    std::thread m_worker;
    std::atomic<bool> m_workerStop{ false };

    // Dispatcher
    nlohmann::json ProcessAction(const std::string& action, const nlohmann::json& params);

    // Specific Action Handlers
    nlohmann::json HandleGetInitialState();
    nlohmann::json HandleGetSystemSpecs();
    nlohmann::json HandleGetTweaksState();
    nlohmann::json HandleGetSystemSuiteState();
    nlohmann::json HandleGetServices();
    nlohmann::json HandleGetCleanupOptions();
    nlohmann::json HandleGetMemoryStats();

    nlohmann::json HandleApplyPreset(const nlohmann::json& params);
    nlohmann::json HandleApplyAllTweaks();
    nlohmann::json HandleRevertToDefaults();
    nlohmann::json HandleSetTweak(const nlohmann::json& params);
    nlohmann::json HandleSetTimerLock(const nlohmann::json& params);
    nlohmann::json HandleFlushDNS();
    nlohmann::json HandlePurgeStandbyMemory();

    nlohmann::json HandleApplySystemTweaks();
    nlohmann::json HandleApplySecurityTweaks();
    nlohmann::json HandleApplySingleSystemTweak(const nlohmann::json& params);
    nlohmann::json HandleApplySingleSecurityTweak(const nlohmann::json& params);
    nlohmann::json HandleApplyOsPerfSubTweak(const nlohmann::json& params);
    nlohmann::json HandleApplyAllOsPerfSubTweaks(const nlohmann::json& params);
    nlohmann::json HandleApplySsdPerfSubTweak(const nlohmann::json& params);
    nlohmann::json HandleApplyAllSsdPerfSubTweaks(const nlohmann::json& params);
    nlohmann::json HandleApplyTelemetrySubTweak(const nlohmann::json& params);
    nlohmann::json HandleApplyAllTelemetrySubTweaks(const nlohmann::json& params);

    nlohmann::json HandleSetServiceState(const nlohmann::json& params);
    nlohmann::json HandleEnableAllServices();
    nlohmann::json HandleDisableRecommendedServices();

    nlohmann::json HandleSelectAppx(const nlohmann::json& params);
    nlohmann::json HandleSelectAllAppx(const nlohmann::json& params);
    nlohmann::json HandleUninstallSelectedAppx();
    nlohmann::json HandleUninstallAllAppx();
    nlohmann::json HandleRestoreAppx(const nlohmann::json& params);
    nlohmann::json HandleSetAppxSetting(const nlohmann::json& params);

    nlohmann::json HandleSetCleanupOption(const nlohmann::json& params);
    nlohmann::json HandleSetAllCleanupOptions(const nlohmann::json& params);
    nlohmann::json HandleExecuteCleanup(const nlohmann::json& params = {});
    nlohmann::json HandleDeepCleanAction(const nlohmann::json& params);

    nlohmann::json HandleTrimWorkingSet();
    nlohmann::json HandleClearSystemCache();
    nlohmann::json HandleCleanAllMemory();
    nlohmann::json HandleSetMemConfig(const nlohmann::json& params);

    nlohmann::json HandleCreateRestorePoint(const nlohmann::json& params);
    nlohmann::json HandleExportProfile();
    nlohmann::json HandleImportProfile();

    nlohmann::json HandleOpenSystemTool(const nlohmann::json& params);

    // Context Menu Handlers
    nlohmann::json HandleGetContextMenuTweaks();
    nlohmann::json HandleToggleContextMenuTweak(const nlohmann::json& params);
    nlohmann::json HandleSetContextMenuShiftOnly(const nlohmann::json& params);
    nlohmann::json HandleApplyAllContextMenuTweaks(const nlohmann::json& params);
    nlohmann::json HandleApplyContextMenuGroup(const nlohmann::json& params);

    // Windows 11 Tweaks Handlers
    nlohmann::json HandleGetWin11Tweaks();
    nlohmann::json HandleToggleWin11Tweak(const nlohmann::json& params);

    // Program Settings Handlers
    nlohmann::json HandleGetConfig();
    nlohmann::json HandleSaveConfig(const nlohmann::json& params);
    nlohmann::json HandleUpdateSetting(const nlohmann::json& params);

    // Startup Manager Handlers
    nlohmann::json HandleGetStartupItems();
    nlohmann::json HandleScanStartup();
    nlohmann::json HandleToggleStartupItem(const nlohmann::json& params);
    nlohmann::json HandleDeleteStartupItem(const nlohmann::json& params);

    // MSI Interrupt Manager Handlers
    nlohmann::json HandleGetMsiDevices();
    nlohmann::json HandleScanDevices();
    nlohmann::json HandleSetMsiEnabled(const nlohmann::json& params);
    nlohmann::json HandleSetMsiPriority(const nlohmann::json& params);
    nlohmann::json HandleApplyMsiEsportsProfile();

    // Appx Scan Handler
    nlohmann::json HandleScanAppx();

    // Game Boost Handlers
    nlohmann::json HandleGetGameBoostStatus();
    nlohmann::json HandleUpdateGameBoostSettings(const nlohmann::json& params);
    nlohmann::json HandleAddCustomBoostGame(const nlohmann::json& params);
    nlohmann::json HandleRemoveCustomBoostGame(const nlohmann::json& params);
    nlohmann::json HandleRemoveBoostGame(const nlohmann::json& params);
    nlohmann::json HandleFetchGameCover(const nlohmann::json& params);

    // In-App Updates Handlers
    nlohmann::json HandleCheckUpdates(const nlohmann::json& params);
    nlohmann::json HandleGetUpdateInfo();
    nlohmann::json HandleOpenUpdateUrl();
};

