"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose Electron APIs to the renderer process
electron_1.contextBridge.exposeInMainWorld("electronAPI", {
    // Browser accounts management
    getBrowserAccounts: () => electron_1.ipcRenderer.invoke("get-browser-accounts"),
    addBrowserAccount: (account) => electron_1.ipcRenderer.invoke("add-browser-account", account),
    removeBrowserAccount: (accountId) => electron_1.ipcRenderer.invoke("remove-browser-account", accountId),
    openBrowserAccount: (accountId) => electron_1.ipcRenderer.invoke("open-browser-account", accountId),
    closeBrowserAccount: (accountId) => electron_1.ipcRenderer.invoke("close-browser-account", accountId),
    // Browser navigation controls
    browserGoBack: (accountId) => electron_1.ipcRenderer.invoke("browser-go-back", accountId),
    browserGoForward: (accountId) => electron_1.ipcRenderer.invoke("browser-go-forward", accountId),
    browserReload: (accountId) => electron_1.ipcRenderer.invoke("browser-reload", accountId),
    browserGoHome: (accountId) => electron_1.ipcRenderer.invoke("browser-go-home", accountId),
    // Notification handling
    onBrowserNotification: (callback) => {
        electron_1.ipcRenderer.on("browser-notification", (_, data) => callback(data));
    },
    // Play notification sound
    onPlayNotificationSound: (callback) => {
        electron_1.ipcRenderer.on("play-notification-sound", callback);
    },
    // Database notification
    onDatabaseNotification: (callback) => {
        electron_1.ipcRenderer.on("database-notification", (_, data) => callback(data));
    },
    sendDatabaseNotification: (data) => {
        electron_1.ipcRenderer.send("database-notification", data);
    },
    // Check if running in Electron
    isElectron: true,
    // Test notification
    testNotification: (data) => electron_1.ipcRenderer.invoke("test-notification", data),
    // Tabs management
    getOpenTabs: () => electron_1.ipcRenderer.invoke("get-open-tabs"),
    focusTab: (accountId) => electron_1.ipcRenderer.invoke("focus-tab", accountId),
    onTabsChanged: (callback) => {
        electron_1.ipcRenderer.on("tabs-changed", callback);
    },
});
//# sourceMappingURL=preload.js.map