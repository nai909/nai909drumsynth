import { app, BrowserWindow, session, shell } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

// Security: Disable navigation to external URLs
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',  // Dev server
  'file://'                 // Production build
]);

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,                    // Security: Disable webview
      allowRunningInsecureContent: false,   // Security: Block mixed content
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#1a1a1a',
    titleBarStyle: 'hiddenInset',
  });

  // Security: Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const origin = `${parsedUrl.protocol}//${parsedUrl.host}`;

    if (!ALLOWED_ORIGINS.has(origin) && !navigationUrl.startsWith('file://')) {
      event.preventDefault();
      console.warn(`Blocked navigation to: ${navigationUrl}`);
    }
  });

  // Security: Prevent new window creation, open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Allow no new windows - open external links in default browser if needed
    if (url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Security: Block permission requests (camera, mic, etc.)
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    // Only allow media (audio) for the synth
    const allowedPermissions = ['media'];
    callback(allowedPermissions.includes(permission));
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    // Security: Ensure devTools are closed in production
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.whenReady().then(() => {
  // Security: Set strict Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self'",
            "script-src 'self'",                    // No eval, no inline scripts
            "style-src 'self' 'unsafe-inline'",     // Required for inline styles (React)
            "media-src 'self' blob:",               // Audio blobs needed for Tone.js
            "worker-src 'self' blob:",              // Web workers for audio processing
            "img-src 'self' data:",                 // Allow data URIs for images
            "font-src 'self'",                      // Restrict fonts to self
            "connect-src 'self'",                   // No external connections
            "frame-src 'none'",                     // No iframes
            "frame-ancestors 'none'",               // Prevent embedding in iframes
            "object-src 'none'",                    // No plugins (Flash, Java, etc.)
            "base-uri 'self'",                      // Restrict base tag
            "form-action 'self'",                   // Restrict form submissions
            "upgrade-insecure-requests",            // Upgrade HTTP to HTTPS
          ].join('; ')
        ],
        // Additional security headers
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
        'X-XSS-Protection': ['1; mode=block'],
        'Referrer-Policy': ['strict-origin-when-cross-origin'],
        'Permissions-Policy': ['camera=(), microphone=(), geolocation=(), payment=()'],
      }
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent creating additional renderers
app.on('web-contents-created', (event, contents) => {
  // Block navigation in any webcontents
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const origin = `${parsedUrl.protocol}//${parsedUrl.host}`;

    if (!ALLOWED_ORIGINS.has(origin) && !navigationUrl.startsWith('file://')) {
      event.preventDefault();
    }
  });

  // Block new window creation
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
