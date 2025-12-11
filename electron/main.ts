import {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain,
  session,
  Notification,
  Menu,
  Tray,
  nativeImage,
  shell,
} from "electron";
import * as path from "path";
import * as fs from "fs";
import { spawn, ChildProcess } from "child_process";

let nextServerProcess: ChildProcess | null = null;

// Start Next.js standalone server
async function startNextServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const port = 3456;
    
    let serverPath: string;
    let cwd: string;
    
    if (app.isPackaged) {
      const resourcesPath = path.join(process.resourcesPath, "app.asar.unpacked");
      serverPath = path.join(resourcesPath, ".next/standalone/server.js");
      cwd = path.join(resourcesPath, ".next/standalone");
      
      if (!fs.existsSync(serverPath)) {
        const asarPath = path.join(process.resourcesPath, "app.asar");
        serverPath = path.join(asarPath, ".next/standalone/server.js");
        cwd = path.join(asarPath, ".next/standalone");
      }
    } else {
      serverPath = path.join(__dirname, "../.next/standalone/server.js");
      cwd = path.join(__dirname, "../.next/standalone");
    }
    
    console.log("Starting Next.js server from:", serverPath);
    
    if (!fs.existsSync(serverPath)) {
      console.error("Server file not found:", serverPath);
      resolve(3000);
      return;
    }
    
    const env = {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "localhost",
      NODE_ENV: "production",
    };

    nextServerProcess = spawn("node", [serverPath], {
      env,
      cwd,
      shell: true,
    });

    nextServerProcess.stdout?.on("data", (data) => {
      console.log(`Next.js: ${data}`);
      if (data.toString().includes("Ready") || data.toString().includes("started") || data.toString().includes("Listening")) {
        resolve(port);
      }
    });

    nextServerProcess.stderr?.on("data", (data) => {
      console.error(`Next.js error: ${data}`);
    });

    nextServerProcess.on("error", (err) => {
      console.error("Failed to start Next.js server:", err);
      resolve(3000);
    });

    setTimeout(() => resolve(port), 5000);
  });
}

function stopNextServer() {
  if (nextServerProcess) {
    nextServerProcess.kill();
    nextServerProcess = null;
  }
}

// Store for browser accounts sessions
interface BrowserAccountSession {
  id: string;
  platform: "airbnb" | "gathern" | "whatsapp";
  accountName: string;
  partition: string;
  createdBy?: string; // User ID who created this account
  window?: BrowserWindow;
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const browserSessions: Map<string, BrowserAccountSession> = new Map();
const isDev = !app.isPackaged;
let isAppQuitting = false;

// Data directory for persistent storage
const userDataPath = app.getPath("userData");
const sessionsPath = path.join(userDataPath, "sessions.json");

function loadSavedSessions(): BrowserAccountSession[] {
  try {
    if (fs.existsSync(sessionsPath)) {
      const data = fs.readFileSync(sessionsPath, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading sessions:", error);
  }
  return [];
}

function saveSessions() {
  try {
    const sessions = Array.from(browserSessions.values()).map((s) => ({
      id: s.id,
      platform: s.platform,
      accountName: s.accountName,
      partition: s.partition,
      createdBy: s.createdBy,
    }));
    fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2));
  } catch (error) {
    console.error("Error saving sessions:", error);
  }
}

function createMainWindow() {
  // إنشاء session منفصل للداشبورد الرئيسي
  // هذا يمنع مشاركة cookies مع المتصفح العادي
  const dashboardSession = session.fromPartition("persist:dashboard-main", {
    cache: true,
  });

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: "لوحة التحكم - إدارة الوحدات",
    icon: fs.existsSync(path.join(__dirname, "../build/icon.ico"))
      ? path.join(__dirname, "../build/icon.ico")
      : fs.existsSync(path.join(__dirname, "../public/logo.ico"))
      ? path.join(__dirname, "../public/logo.ico")
      : path.join(__dirname, "../public/logo.png"),
    webPreferences: {
      session: dashboardSession, // استخدام session منفصل
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    // DevTools will open manually with F12 if needed
  } else {
    startNextServer().then((port) => {
      mainWindow?.loadURL(`http://localhost:${port}`);
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.on("close", (event) => {
    if (!isAppQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  const menu = Menu.buildFromTemplate([
    {
      label: "ملف",
      submenu: [
        { label: "تحديث", accelerator: "CmdOrCtrl+R", click: () => mainWindow?.reload() },
        { type: "separator" },
        { label: "خروج", accelerator: "CmdOrCtrl+Q", click: () => { isAppQuitting = true; app.quit(); } },
      ],
    },
    {
      label: "عرض",
      submenu: [
        { label: "تكبير", accelerator: "CmdOrCtrl+Plus", click: () => mainWindow?.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 0.5) },
        { label: "تصغير", accelerator: "CmdOrCtrl+-", click: () => mainWindow?.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 0.5) },
        { label: "حجم عادي", accelerator: "CmdOrCtrl+0", click: () => mainWindow?.webContents.setZoomLevel(0) },
        { type: "separator" },
        { label: "أدوات المطور", accelerator: "F12", click: () => mainWindow?.webContents.toggleDevTools() },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

function createTray() {
  const iconPath = fs.existsSync(path.join(__dirname, "../build/icon.ico"))
    ? path.join(__dirname, "../build/icon.ico")
    : fs.existsSync(path.join(__dirname, "../public/logo.ico"))
    ? path.join(__dirname, "../public/logo.ico")
    : path.join(__dirname, "../public/logo.png");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: "فتح البرنامج", click: () => mainWindow?.show() },
    { type: "separator" },
    { label: "خروج", click: () => { isAppQuitting = true; app.quit(); } },
  ]);

  tray.setToolTip("لوحة التحكم - إدارة الوحدات");
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => mainWindow?.show());
}

// Create a separate browser window for platform account
function createBrowserWindow(accountSession: BrowserAccountSession): BrowserWindow {
  const partition = `persist:${accountSession.partition}`;
  const ses = session.fromPartition(partition);

  // Set a real Chrome User-Agent to avoid detection
  const chromeUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  ses.setUserAgent(chromeUserAgent);

  // Intercept requests to add proper headers (helps bypass protection)
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    headers["User-Agent"] = chromeUserAgent;
    headers["Accept-Language"] = "ar,en-US;q=0.9,en;q=0.8";
    headers["sec-ch-ua"] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
    headers["sec-ch-ua-mobile"] = "?0";
    headers["sec-ch-ua-platform"] = '"Windows"';
    callback({ requestHeaders: headers });
  });

  const platformColors = {
    airbnb: "#FF5A5F",
    gathern: "#10B981",
    whatsapp: "#25D366",
  };

  const browserWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: `${accountSession.accountName} - ${accountSession.platform === "airbnb" ? "Airbnb" : "Gathern"}`,
    icon: fs.existsSync(path.join(__dirname, "../build/icon.ico"))
      ? path.join(__dirname, "../build/icon.ico")
      : fs.existsSync(path.join(__dirname, "../public/logo.ico"))
      ? path.join(__dirname, "../public/logo.ico")
      : path.join(__dirname, "../public/logo.png"),
    webPreferences: {
      session: ses,
      preload: path.join(__dirname, "webview-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Important: Enable these for better compatibility
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    // Custom titlebar
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: platformColors[accountSession.platform],
      symbolColor: "#ffffff",
      height: 40,
    },
  });

  const platformUrl =
    accountSession.platform === "airbnb"
      ? "https://www.airbnb.com/hosting/inbox"
      : accountSession.platform === "gathern"
      ? "https://business.gathern.co/app/chat"
      : "https://web.whatsapp.com";

  // Load with proper options
  browserWindow.loadURL(platformUrl, {
    userAgent: chromeUserAgent,
  });

  // Enable F12 to open DevTools
  browserWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12") {
      browserWindow.webContents.toggleDevTools();
    }
    // Also support Ctrl+Shift+I
    if (input.control && input.shift && input.key === "I") {
      browserWindow.webContents.toggleDevTools();
    }
  });

  // Inject notification monitoring script when page loads
  browserWindow.webContents.on("did-finish-load", () => {
    console.log("[Browser Window] Page loaded, injecting notification monitor");
    injectNotificationMonitor(browserWindow, accountSession);
    
    // Inject custom CSS for better integration
    browserWindow.webContents.insertCSS(`
      /* Hide some annoying elements */
      .announcement-banner { display: none !important; }
    `);
  });

  // Re-inject on navigation (in case of SPA routing)
  browserWindow.webContents.on("did-navigate-in-page", () => {
    console.log("[Browser Window] In-page navigation detected, re-injecting monitor");
    injectNotificationMonitor(browserWindow, accountSession);
  });

  // Re-inject on full navigation
  browserWindow.webContents.on("did-navigate", () => {
    console.log("[Browser Window] Full navigation detected");
  });

  // Handle page title updates
  browserWindow.webContents.on("page-title-updated", (event, title) => {
    browserWindow.setTitle(`${accountSession.accountName} - ${title}`);
  });

  // Handle external links
  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Add context menu for DevTools
  browserWindow.webContents.on("context-menu", (event, params) => {
    const isDevToolsOpened = browserWindow.webContents.isDevToolsOpened();
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "رجوع",
        enabled: browserWindow.webContents.canGoBack(),
        click: () => browserWindow.webContents.goBack(),
      },
      {
        label: "تقدم",
        enabled: browserWindow.webContents.canGoForward(),
        click: () => browserWindow.webContents.goForward(),
      },
      {
        label: "إعادة تحميل",
        click: () => browserWindow.webContents.reload(),
      },
      { type: "separator" },
      {
        label: "فحص العنصر (DevTools)",
        click: () => {
          browserWindow.webContents.inspectElement(params.x, params.y);
        },
      },
      {
        label: isDevToolsOpened ? "إخفاء أدوات المطور" : "إظهار أدوات المطور",
        accelerator: "F12",
        click: () => {
          browserWindow.webContents.toggleDevTools();
        },
      },
    ]);
    contextMenu.popup();
  });

  // Handle window close
  browserWindow.on("closed", () => {
    const account = browserSessions.get(accountSession.id);
    if (account) {
      account.window = undefined;
    }
    // Notify dashboard about tab change
    notifyTabsChanged();
  });

  // Handle window focus/blur to update tab state
  browserWindow.on("focus", () => {
    notifyTabsChanged();
  });

  browserWindow.on("blur", () => {
    notifyTabsChanged();
  });

  // Handle title updates
  browserWindow.on("page-title-updated", () => {
    notifyTabsChanged();
  });

  return browserWindow;
}

// Notify dashboard about tabs changes
function notifyTabsChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("tabs-changed");
  }
}

// Inject script to monitor notifications
function injectNotificationMonitor(browserWindow: BrowserWindow, account: BrowserAccountSession) {
  // Special handling for WhatsApp - Badge Monitoring
  if (account.platform === "whatsapp") {
    const whatsappMonitor = `
      (function() {
        console.log('[WhatsApp Monitor] 🚀 Started for ${account.accountName}');
        
        let previousTotalUnread = -1;
        let baselineSet = false;
        let checkInterval = null;
        
        function checkForNewMessages() {
          try {
            // Method 1: Count unread badges (green badges with numbers)
            const unreadBadges = document.querySelectorAll('span[data-testid="icon-unread-count"], span[aria-label*="unread"]');
            let totalUnread = 0;
            
            unreadBadges.forEach(badge => {
              const count = parseInt(badge.textContent?.trim() || '0');
              if (!isNaN(count)) {
                totalUnread += count;
              }
            });
            
            // Method 2: Count chats with unread indicators (fallback)
            if (totalUnread === 0) {
              const unreadChats = document.querySelectorAll('[aria-label*="unread message"], [class*="unread"]');
              totalUnread = unreadChats.length;
            }
            
            // Method 3: Check for green dots or badges
            const greenDots = document.querySelectorAll('span[data-icon="unread-count"]');
            if (greenDots.length > 0 && totalUnread === 0) {
              totalUnread = greenDots.length;
            }
            
            console.log(\`[WhatsApp Monitor] 📊 Total unread: \${totalUnread}, Previous: \${previousTotalUnread}, Baseline set: \${baselineSet}\`);
            
            // Check for new messages
            if (baselineSet && totalUnread > previousTotalUnread) {
              const newMessages = totalUnread - previousTotalUnread;
              console.log(\`[WhatsApp Monitor] 🔔🔔🔔 NEW MESSAGES DETECTED! (+\${newMessages})\`);
              
              window.postMessage({
                type: 'NEW_NOTIFICATION',
                payload: {
                  accountId: '${account.id}',
                  accountName: '${account.accountName}',
                  platform: '${account.platform}',
                  count: newMessages,
                }
              }, '*');
              
              console.log('[WhatsApp Monitor] ✅ Notification sent!');
            } else if (!baselineSet) {
              console.log('[WhatsApp Monitor] 📍 Baseline set - ignoring existing messages');
              baselineSet = true;
            } else if (totalUnread === previousTotalUnread) {
              console.log('[WhatsApp Monitor] ℹ️ No change in unread count');
            } else if (totalUnread < previousTotalUnread) {
              console.log('[WhatsApp Monitor] 📉 Unread count decreased (message read)');
            }
            
            previousTotalUnread = totalUnread;
            
          } catch (err) {
            console.error('[WhatsApp Monitor] ❌ Error checking:', err);
          }
        }
        
        // Initial check after 10 seconds (to set baseline)
        setTimeout(() => {
          console.log('[WhatsApp Monitor] 📍 Running initial baseline check...');
          checkForNewMessages();
          
          // Then check every 30 seconds (WhatsApp is more responsive)
          checkInterval = setInterval(checkForNewMessages, 30000);
          console.log('[WhatsApp Monitor] ✅ Now monitoring every 30 seconds (+ MutationObserver for instant detection)');
        }, 10000);
        
        // Use MutationObserver for immediate detection
        const observer = new MutationObserver((mutations) => {
          // Check if any badge or unread indicator was added
          const hasUnreadChange = mutations.some(m => {
            if (m.type === 'childList') {
              return Array.from(m.addedNodes).some(node => {
                if (node instanceof Element) {
                  return node.querySelector?.('span[data-testid="icon-unread-count"]') ||
                         node.querySelector?.('[aria-label*="unread"]') ||
                         node.getAttribute?.('data-testid') === 'icon-unread-count';
                }
                return false;
              });
            }
            return false;
          });
          
          if (hasUnreadChange && baselineSet) {
            console.log('[WhatsApp Monitor] 🔍 Unread indicator detected! Checking...');
            checkForNewMessages();
          }
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
        
        console.log('[WhatsApp Monitor] 🎯 Setup complete - monitoring DOM changes & polling...');
      })();
    `;
    
    browserWindow.webContents.executeJavaScript(whatsappMonitor).catch(err => {
      console.error('[WhatsApp Monitor] Failed to inject:', err);
    });
    
    return;
  }
  
  // Special handling for Gathern - Smart DOM Polling
  if (account.platform === "gathern") {
    const gathernSmartMonitor = `
      (function() {
        console.log('[Gathern Smart Monitor] 🚀 Started for ${account.accountName}');
        
        let previousTotalUnread = -1; // -1 means baseline not set yet
        let baselineSet = false;
        let checkInterval = null;
        
        function checkForNewMessages() {
          try {
            // Method 1: Check for purple dots (unread indicators)
            const purpleDots = document.querySelectorAll('.MuiBox-root.gathern-rtl-19f9myt');
            const currentDotCount = purpleDots.length;
            
            // Method 2: Try to find unread count in UI
            let totalUnread = 0;
            
            // Look for any element with unread count
            const possibleCounters = document.querySelectorAll('[class*="badge"], [class*="count"], [class*="unread"]');
            possibleCounters.forEach(el => {
              const text = el.textContent?.trim();
              if (text && !isNaN(parseInt(text))) {
                totalUnread += parseInt(text);
              }
            });
            
            // Method 3: Check chat list items for indicators
            const chatItems = document.querySelectorAll('[class*="chat"], [class*="conversation"]');
            let chatsWithIndicators = 0;
            chatItems.forEach(item => {
              const hasPurpleDot = item.querySelector('.MuiBox-root.gathern-rtl-19f9myt');
              if (hasPurpleDot) {
                chatsWithIndicators++;
              }
            });
            
            console.log(\`[Gathern Smart Monitor] 📊 Purple dots: \${currentDotCount}, Unread badges: \${totalUnread}, Chats with indicators: \${chatsWithIndicators}\`);
            
            // Determine if there are new messages
            const currentTotal = Math.max(currentDotCount, totalUnread, chatsWithIndicators);
            
            console.log(\`[Gathern Smart Monitor] 📈 Current total: \${currentTotal}, Previous: \${previousTotalUnread}, Baseline set: \${baselineSet}\`);
            
            // Check for new messages
            if (baselineSet && currentTotal > previousTotalUnread) {
              const newMessages = currentTotal - previousTotalUnread;
              console.log(\`[Gathern Smart Monitor] 🔔🔔🔔 NEW MESSAGES DETECTED! (+\${newMessages})\`);
              
              window.postMessage({
                type: 'NEW_NOTIFICATION',
                payload: {
                  accountId: '${account.id}',
                  accountName: '${account.accountName}',
                  platform: '${account.platform}',
                  count: newMessages,
                }
              }, '*');
              
              console.log('[Gathern Smart Monitor] ✅ Notification sent!');
            } else if (!baselineSet) {
              console.log('[Gathern Smart Monitor] 📍 Baseline set - ignoring existing messages');
              baselineSet = true;
            } else if (currentTotal === previousTotalUnread) {
              console.log('[Gathern Smart Monitor] ℹ️ No change in unread count');
            } else if (currentTotal < previousTotalUnread) {
              console.log('[Gathern Smart Monitor] 📉 Unread count decreased (message read)');
            }
            
            previousTotalUnread = currentTotal;
            
          } catch (err) {
            console.error('[Gathern Smart Monitor] ❌ Error checking:', err);
          }
        }
        
        // Initial check after 10 seconds (to set baseline)
        setTimeout(() => {
          console.log('[Gathern Smart Monitor] 📍 Running initial baseline check...');
          checkForNewMessages();
          
          // Then check every 50 seconds
          checkInterval = setInterval(checkForNewMessages, 50000);
          console.log('[Gathern Smart Monitor] ✅ Now monitoring every 50 seconds (+ MutationObserver for instant detection)');
        }, 10000);
        
        // Also use MutationObserver for immediate detection
        const observer = new MutationObserver((mutations) => {
          // Only check if we see purple dot class changes
          const hasPurpleDotChange = mutations.some(m => {
            if (m.type === 'childList') {
              return Array.from(m.addedNodes).some(node => {
                if (node instanceof Element) {
                  return node.classList?.contains('gathern-rtl-19f9myt') ||
                         node.querySelector?.('.gathern-rtl-19f9myt');
                }
                return false;
              });
            }
            return false;
          });
          
          if (hasPurpleDotChange && baselineSet) {
            console.log('[Gathern Smart Monitor] 🔍 Purple dot detected via MutationObserver! Checking...');
            checkForNewMessages();
          }
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
        
        console.log('[Gathern Smart Monitor] 🎯 Setup complete - monitoring DOM changes & polling...');
      })();
    `;
    
    browserWindow.webContents.executeJavaScript(gathernSmartMonitor).catch(err => {
      console.error('[Gathern Smart Monitor] Failed to inject:', err);
    });
    
    return; // Don't use DOM monitoring
  }
  
  // Fallback - old monitoring code (disabled)
  if (false) {
    const gathernSmartMonitor = `
      (function() {
        console.log('[OLD Monitor - DISABLED]');
        let lastUnreadCount = 0;
        
        function countUnreadChats() {
          // Strategy 1: Look for chat list container first
          const chatListSelectors = [
            '[class*="chat-list"]',
            '[class*="conversations"]',
            '[class*="message-list"]',
            'main [class*="MuiBox"]',
            '[role="list"]',
          ];
          
          let chatListContainer = null;
          for (const selector of chatListSelectors) {
            const container = document.querySelector(selector);
            if (container) {
              chatListContainer = container;
              break;
            }
          }
          
          // Strategy 2: Find unread dots within chat list only
          let dotCount = 0;
          
          if (chatListContainer) {
            // Search only within chat list container
            const gathernDots = chatListContainer.querySelectorAll('[class*="gathern-rtl-"]');
            
            gathernDots.forEach(el => {
              const style = window.getComputedStyle(el);
              const display = style.display;
              const visibility = style.visibility;
              const opacity = parseFloat(style.opacity);
              const width = parseFloat(style.width);
              const height = parseFloat(style.height);
              
              // Only count visible small dots (likely unread indicators)
              const isVisible = display !== 'none' && visibility !== 'hidden' && opacity > 0;
              const isSmallDot = width < 20 && height < 20 && width > 5 && height > 5;
              
              if (isVisible && isSmallDot) {
                dotCount++;
              }
            });
            
            console.log('[Gathern Smart Monitor] Found unread dots in chat list:', dotCount);
          } else {
            // Fallback: If can't find chat list, search globally but with strict filtering
            const allDots = document.querySelectorAll('[class*="gathern-rtl-"]');
            
            allDots.forEach(el => {
              const style = window.getComputedStyle(el);
              const display = style.display;
              const visibility = style.visibility;
              const opacity = parseFloat(style.opacity);
              const width = parseFloat(style.width);
              const height = parseFloat(style.height);
              const bgColor = style.backgroundColor;
              const borderRadius = style.borderRadius;
              
              // Very strict filtering: must be small, circular, purple, and visible
              const isVisible = display !== 'none' && visibility !== 'hidden' && opacity > 0;
              const isSmallDot = width < 15 && height < 15 && width > 6 && height > 6;
              const isCircular = borderRadius.includes('50%') || parseFloat(borderRadius) >= width / 2;
              const isPurple = bgColor && (
                bgColor.includes('147, 51, 234') ||
                bgColor.includes('139, 92, 246') ||
                bgColor.includes('168, 85, 247')
              );
              
              if (isVisible && isSmallDot && isCircular && isPurple) {
                dotCount++;
              }
            });
            
            console.log('[Gathern Smart Monitor] Found unread dots (fallback):', dotCount);
          }
          
          return dotCount;
        }
        
        function checkForNewMessages() {
          const currentUnread = countUnreadChats();
          
          if (currentUnread > 0) {
            console.log('[Gathern Smart Monitor] Current unread count:', currentUnread);
          }
          
          // If count decreased, user read some messages - update lastUnreadCount
          if (currentUnread < lastUnreadCount) {
            console.log('[Gathern Smart Monitor] Count decreased (messages read)');
            lastUnreadCount = currentUnread;
            return;
          }
          
          // Only notify if count increased (new messages)
          if (currentUnread > lastUnreadCount && currentUnread > 0) {
            const newMessages = currentUnread - lastUnreadCount;
            console.log('[Gathern Smart Monitor] 🔔 New message detected! +' + newMessages + ' (Total: ' + currentUnread + ')');
            
            window.postMessage({
              type: 'NEW_NOTIFICATION',
              payload: {
                accountId: '${account.id}',
                accountName: '${account.accountName}',
                platform: '${account.platform}',
                count: newMessages,
              }
            }, '*');
            
            lastUnreadCount = currentUnread;
          }
        }
        
        // Check every 5 seconds
        setInterval(checkForNewMessages, 5000);
        
        // Use MutationObserver on body for immediate detection
        const observer = new MutationObserver(() => {
          checkForNewMessages();
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'style']
        });
        
        // Initial check
        setTimeout(checkForNewMessages, 2000);
        
        console.log('[Gathern Smart Monitor] Setup complete');
      })();
    `;
    
    browserWindow.webContents.executeJavaScript(gathernSmartMonitor).catch(err => {
      console.error('[Gathern Smart Monitor] Failed to inject:', err);
    });
    
    return; // Don't use API monitoring or default DOM monitoring
  }
  
  // Fallback - old API monitoring code (keep for reference but won't be used)
  if (false) {
    const gathernAPIMonitor = `
      (function() {
        console.log('[Gathern API Monitor - DISABLED] This code is not being used');
        let lastUnreadCount = 0;
        
        // Intercept fetch API
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
          const response = await originalFetch(...args);
          const url = args[0].toString();
          
          // Log ALL Gathern API calls for debugging
          if (url.includes('gathern.co')) {
            console.log('[Gathern API] Request:', url);
          }
          
          // Monitor ANY chat-related API
          if (url.includes('chat') || url.includes('message') || url.includes('notification')) {
            try {
              const clone = response.clone();
              const data = await clone.json();
              
              console.log('[Gathern API] Chat-related response:', url, data);
              
              // Try to find unread count in various possible structures
              let unreadCount = 0;
              
              // Method 1: Direct array of chats
              if (Array.isArray(data)) {
                unreadCount = data.filter(chat => 
                  chat.unread_count > 0 || 
                  chat.has_unread || 
                  chat.is_unread ||
                  chat.unread
                ).length;
              }
              
              // Method 2: data.chats array
              if (data && data.chats && Array.isArray(data.chats)) {
                unreadCount = data.chats.filter(chat => 
                  chat.unread_count > 0 || 
                  chat.has_unread || 
                  chat.is_unread ||
                  chat.unread
                ).length;
              }
              
              // Method 3: data.data array
              if (data && data.data && Array.isArray(data.data)) {
                unreadCount = data.data.filter(chat => 
                  chat.unread_count > 0 || 
                  chat.has_unread || 
                  chat.is_unread ||
                  chat.unread
                ).length;
              }
              
              // Method 4: Direct unread_count property
              if (data && typeof data.unread_count === 'number') {
                unreadCount = data.unread_count;
              }
              
              // Method 5: Total unread messages
              if (data && typeof data.total_unread === 'number') {
                unreadCount = data.total_unread;
              }
              
              if (unreadCount > 0) {
                console.log('[Gathern API Monitor] Found unread count:', unreadCount);
              }
              
              if (unreadCount > lastUnreadCount && unreadCount > 0) {
                console.log('[Gathern API Monitor] 🔔 New message detected! Count:', unreadCount);
                
                window.postMessage({
                  type: 'NEW_NOTIFICATION',
                  payload: {
                    accountId: '${account.id}',
                    accountName: '${account.accountName}',
                    platform: '${account.platform}',
                    count: unreadCount,
                  }
                }, '*');
                
                lastUnreadCount = unreadCount;
              }
            } catch (err) {
              console.error('[Gathern API Monitor] Error parsing response:', err);
            }
          }
          
          return response;
        };
        
        // Also intercept XMLHttpRequest
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
          this._url = url;
          if (url.includes && url.includes('gathern.co')) {
            console.log('[Gathern API] XHR Request:', url);
          }
          return originalXHROpen.apply(this, [method, url, ...rest]);
        };
        
        XMLHttpRequest.prototype.send = function(...args) {
          this.addEventListener('load', function() {
            if (this._url && this._url.includes && 
                (this._url.includes('chat') || this._url.includes('message') || this._url.includes('notification'))) {
              try {
                const data = JSON.parse(this.responseText);
                console.log('[Gathern API] XHR Chat response:', this._url, data);
                
                let unreadCount = 0;
                
                if (Array.isArray(data)) {
                  unreadCount = data.filter(chat => 
                    chat.unread_count > 0 || chat.has_unread || chat.is_unread
                  ).length;
                } else if (data.chats && Array.isArray(data.chats)) {
                  unreadCount = data.chats.filter(chat => 
                    chat.unread_count > 0 || chat.has_unread || chat.is_unread
                  ).length;
                } else if (data.data && Array.isArray(data.data)) {
                  unreadCount = data.data.filter(chat => 
                    chat.unread_count > 0 || chat.has_unread || chat.is_unread
                  ).length;
                } else if (typeof data.unread_count === 'number') {
                  unreadCount = data.unread_count;
                } else if (typeof data.total_unread === 'number') {
                  unreadCount = data.total_unread;
                }
                
                if (unreadCount > 0) {
                  console.log('[Gathern API Monitor] XHR Found unread:', unreadCount);
                }
                
                if (unreadCount > lastUnreadCount && unreadCount > 0) {
                  console.log('[Gathern API Monitor] 🔔 XHR New message!');
                  
                  window.postMessage({
                    type: 'NEW_NOTIFICATION',
                    payload: {
                      accountId: '${account.id}',
                      accountName: '${account.accountName}',
                      platform: '${account.platform}',
                      count: unreadCount,
                    }
                  }, '*');
                  
                  lastUnreadCount = unreadCount;
                }
              } catch (err) {
                console.error('[Gathern API Monitor] XHR Error:', err);
              }
            }
          });
          return originalXHRSend.apply(this, args);
        };
        
        console.log('[Gathern API Monitor] Setup complete - monitoring API calls');
      })();
    `;
    
    browserWindow.webContents.executeJavaScript(gathernAPIMonitor).catch(err => {
      console.error('[Gathern API Monitor] Failed to inject:', err);
    });
    
    return; // Don't use DOM monitoring for Gathern
  }
  
  // For other platforms (Airbnb, etc.) - use DOM monitoring
  const monitorScript = `
    (function() {
      console.log('[Notification Monitor] Started for ${account.platform} - ${account.accountName}');
      let lastBadgeCount = 0;
      
      function checkNotifications() {
        const selectors = {
          airbnb: [
            '[data-testid="notification-badge"]',
            '.notification-badge',
            '[aria-label*="notification"]',
            '[aria-label*="unread"]',
            '.notification-indicator',
            '[data-notification-count]',
            'button[aria-label*="Notifications"]',
            '[data-testid="main-header-notification-button"]',
          ],
        };
        
        const platformSelectors = selectors['${account.platform}'] || [];
        
        // For Airbnb and other platforms: use text/number count
        for (const selector of platformSelectors) {
          const badges = document.querySelectorAll(selector);
          if (badges.length > 0) {
            badges.forEach(badge => {
              const count = parseInt(badge.textContent?.trim() || badge.getAttribute('data-count') || badge.getAttribute('aria-label')?.match(/\\d+/)?.[0] || '0', 10);
              if (count > lastBadgeCount && count > 0) {
                console.log('[Notification Monitor] New notification detected! Count:', count);
                
                window.postMessage({
                  type: 'NEW_NOTIFICATION',
                  payload: {
                    accountId: '${account.id}',
                    accountName: '${account.accountName}',
                    platform: '${account.platform}',
                    count: count,
                  }
                }, '*');
                
                lastBadgeCount = count;
              }
            });
            break;
          }
        }
        
        // Also check for title changes (common notification pattern)
        const titleMatch = document.title.match(/\\((\\d+)\\)/);
        if (titleMatch) {
          const titleCount = parseInt(titleMatch[1], 10);
          if (titleCount > lastBadgeCount && titleCount > 0) {
            console.log('[Notification Monitor] New notification from title! Count:', titleCount);
            
            window.postMessage({
              type: 'NEW_NOTIFICATION',
              payload: {
                accountId: '${account.id}',
                accountName: '${account.accountName}',
                platform: '${account.platform}',
                count: titleCount,
              }
            }, '*');
            
            lastBadgeCount = titleCount;
          }
        }
      }
      
      // Check every 3 seconds
      setInterval(checkNotifications, 3000);
      
      // Also use MutationObserver for immediate detection
      const observer = new MutationObserver(() => {
        checkNotifications();
      });
      
      observer.observe(document.body, { 
        subtree: true, 
        childList: true, 
        characterData: true,
        attributes: true,
        attributeFilter: ['data-notification-count', 'aria-label', 'class', 'data-count']
      });
      
      // Initial check after page loads
      setTimeout(checkNotifications, 2000);
      
      console.log('[Notification Monitor] Setup complete');
    })();
  `;

  browserWindow.webContents.executeJavaScript(monitorScript).catch(err => {
    console.error('[Notification Monitor] Failed to inject:', err);
  });
}

// Show system notification
function showSystemNotification(title: string, body: string) {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body,
      icon: fs.existsSync(path.join(__dirname, "../build/icon.ico"))
        ? path.join(__dirname, "../build/icon.ico")
        : fs.existsSync(path.join(__dirname, "../public/logo.ico"))
        ? path.join(__dirname, "../public/logo.ico")
        : path.join(__dirname, "../public/logo.png"),
      silent: false,
    });

    notification.on("click", () => {
      mainWindow?.show();
      mainWindow?.focus();
    });

    notification.show();
  }
}

// Play notification sound
function playNotificationSound() {
  mainWindow?.webContents.send("play-notification-sound");
}

// IPC Handlers
ipcMain.handle("get-browser-accounts", () => {
  return Array.from(browserSessions.values()).map((s) => ({
    id: s.id,
    platform: s.platform,
    accountName: s.accountName,
    partition: s.partition,
    isOpen: !!s.window && !s.window.isDestroyed(),
  }));
});

ipcMain.handle("add-browser-account", (_, account: Omit<BrowserAccountSession, "window">) => {
  const accountSession: BrowserAccountSession = {
    ...account,
    window: undefined,
  };
  browserSessions.set(account.id, accountSession);
  saveSessions();
  return { success: true };
});

ipcMain.handle("remove-browser-account", (_, accountId: string) => {
  const account = browserSessions.get(accountId);
  if (account?.window && !account.window.isDestroyed()) {
    account.window.close();
  }
  browserSessions.delete(accountId);
  saveSessions();
  
  // Clear session data
  const partition = `persist:${account?.partition}`;
  session.fromPartition(partition).clearStorageData();
  
  return { success: true };
});

ipcMain.handle("open-browser-account", (_, accountId: string) => {
  const account = browserSessions.get(accountId);
  if (!account) return { success: false, error: "Account not found" };

  // If window exists and not destroyed, focus it
  if (account.window && !account.window.isDestroyed()) {
    account.window.focus();
    notifyTabsChanged();
    return { success: true };
  }

  // Create new window
  account.window = createBrowserWindow(account);
  notifyTabsChanged();
  
  return { success: true };
});

ipcMain.handle("close-browser-account", (_, accountId: string) => {
  const account = browserSessions.get(accountId);
  if (account?.window && !account.window.isDestroyed()) {
    account.window.close();
    account.window = undefined;
  }
  notifyTabsChanged();
  return { success: true };
});

// Browser window controls
ipcMain.handle("browser-go-back", (_, accountId: string) => {
  const account = browserSessions.get(accountId);
  if (account?.window && !account.window.isDestroyed()) {
    account.window.webContents.goBack();
  }
});

ipcMain.handle("browser-go-forward", (_, accountId: string) => {
  const account = browserSessions.get(accountId);
  if (account?.window && !account.window.isDestroyed()) {
    account.window.webContents.goForward();
  }
});

ipcMain.handle("browser-reload", (_, accountId: string) => {
  const account = browserSessions.get(accountId);
  if (account?.window && !account.window.isDestroyed()) {
    account.window.webContents.reload();
  }
});

ipcMain.handle("browser-go-home", (_, accountId: string) => {
  const account = browserSessions.get(accountId);
  if (account?.window && !account.window.isDestroyed()) {
    const platformUrl = account.platform === "airbnb"
      ? "https://www.airbnb.com/hosting/inbox"
      : account.platform === "gathern"
      ? "https://business.gathern.co/app/chat"
      : "https://web.whatsapp.com";
    account.window.webContents.loadURL(platformUrl);
  }
});

ipcMain.on("new-notification-from-webview", (_, data) => {
  console.log("[Main Process] Received notification from webview:", data);
  
  const platformName = data.platform === "airbnb" ? "Airbnb" : "Gathern";
  showSystemNotification(
    `إشعار جديد على ${platformName}`,
    `يوجد إشعار جديد على الحساب: ${data.accountName}`
  );
  playNotificationSound();
  
  console.log("[Main Process] Sending notification to dashboard");
  mainWindow?.webContents.send("browser-notification", data);
});

// Handle database notifications from renderer
ipcMain.on("database-notification", (_, data: { title: string; body: string; id: string }) => {
  console.log("[Main Process] Received database notification:", data);
  
  showSystemNotification(data.title, data.body);
  playNotificationSound();
  
  // Also send to renderer for UI display
  mainWindow?.webContents.send("database-notification", data);
});

// Test notification handler
ipcMain.handle("test-notification", (_, data) => {
  console.log("[Main Process] Test notification triggered:", data);
  mainWindow?.webContents.send("browser-notification", data);
  return { success: true };
});

// Get all open tabs (browser windows)
ipcMain.handle("get-open-tabs", () => {
  const openTabs = Array.from(browserSessions.values())
    .filter((s) => s.window && !s.window.isDestroyed())
    .map((s) => ({
      id: s.id,
      platform: s.platform,
      accountName: s.accountName,
      title: s.window?.getTitle() || `${s.accountName} - ${s.platform}`,
      url: s.window?.webContents.getURL() || "",
      isFocused: s.window?.isFocused() || false,
    }));
  return openTabs;
});

// Focus a specific tab (bring window to front)
ipcMain.handle("focus-tab", (_, accountId: string) => {
  const account = browserSessions.get(accountId);
  if (account?.window && !account.window.isDestroyed()) {
    if (account.window.isMinimized()) {
      account.window.restore();
    }
    account.window.focus();
    account.window.show();
    notifyTabsChanged();
    return { success: true };
  }
  return { success: false, error: "Tab not found or closed" };
});

// App lifecycle
app.whenReady().then(() => {
  const savedSessions = loadSavedSessions();
  savedSessions.forEach((s) => browserSessions.set(s.id, s));

  createMainWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // Don't quit on macOS
});

app.on("before-quit", () => {
  isAppQuitting = true;
  stopNextServer();
  
  // Close all browser windows
  browserSessions.forEach((account) => {
    if (account.window && !account.window.isDestroyed()) {
      account.window.close();
    }
  });
});
