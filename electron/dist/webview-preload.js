"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Listen for custom events from the injected page script
if (typeof window !== 'undefined') {
    window.addEventListener("message", (event) => {
        // Only accept messages from same origin
        if (event.source !== window)
            return;
        if (event.data && event.data.type === "NEW_NOTIFICATION") {
            console.log("[WebView Preload] Received notification event:", event.data.payload);
            electron_1.ipcRenderer.send("new-notification-from-webview", event.data.payload);
        }
    });
}
// Expose limited API for webviews (platform pages)
electron_1.contextBridge.exposeInMainWorld("electronAPI", {
    // Notify main process about new notifications
    notifyNewNotification: (data) => {
        electron_1.ipcRenderer.send("new-notification-from-webview", data);
    },
});
console.log("[WebView Preload] Loaded successfully");
//# sourceMappingURL=webview-preload.js.map