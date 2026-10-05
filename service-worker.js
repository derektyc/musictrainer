const CACHE_NAME = "dt-music-trainer-v2026.10.05.3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon/icon-192.png",
  "./icon/icon-512.png"
];

const DT_STORE_TOKEN_OLD = `function dtStoreDriveToken(response) {
  if (!response || !response.access_token) return;
  dtGoogleAccessToken = response.access_token;
  const expiresIn = Math.max(60, Number(response.expires_in) || 3600);
  const expiry = Date.now() + expiresIn * 1000 - 60000;
  try {
    sessionStorage.setItem(DT_DRIVE_SESSION_TOKEN_KEY, dtGoogleAccessToken);
    sessionStorage.setItem(DT_DRIVE_SESSION_EXPIRY_KEY, String(expiry));
  } catch (e) {}
}`;

const DT_STORE_TOKEN_NEW = `function dtStoreDriveToken(response) {
  if (!response || !response.access_token) return;
  dtGoogleAccessToken = response.access_token;
  const expiresIn = Math.max(60, Number(response.expires_in) || 3600);
  const expiry = Date.now() + expiresIn * 1000 - 60000;
  try {
    sessionStorage.setItem(DT_DRIVE_SESSION_TOKEN_KEY, dtGoogleAccessToken);
    sessionStorage.setItem(DT_DRIVE_SESSION_EXPIRY_KEY, String(expiry));
  } catch (e) {}

  if (window.__dtDriveRequestRefreshResolve) {
    try { window.__dtDriveRequestRefreshResolve(true); } catch (e) {}
  }

  try { clearTimeout(window.__dtDriveRefreshTimer); } catch (e) {}
  window.__dtDriveRefreshTimer = setTimeout(function () {
    if (!dtGoogleAccessToken || !dtGoogleTokenClient || dtDriveTokenRequestInFlight) return;
    dtDriveTokenRequestInFlight = true;
    window.__dtDriveProactiveRefresh = true;
    dtSetDriveStatus("Google Drive connected ✓ · renewing session…", "ok");
    try {
      dtGoogleTokenClient.requestAccessToken({ prompt: "" });
    } catch (error) {
      dtDriveTokenRequestInFlight = false;
      window.__dtDriveProactiveRefresh = false;
    }
  }, Math.max(10000, expiresIn * 1000 - 300000));
}`;

const DT_DRIVE_FETCH_OLD = `async function dtDriveFetch(url, options = {}) {
  if (!dtGoogleAccessToken) throw new Error("Google Drive is not connected.");
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: "Bearer " + dtGoogleAccessToken,
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 401) {
      dtGoogleAccessToken = "";
      dtClearStoredDriveToken();
      setTimeout(() => dtBackgroundDriveReconnect(), 0);
    }
    throw new Error("Google Drive " + response.status + (detail ? " · " + detail : ""));
  }
  return response;
}`;

const DT_DRIVE_FETCH_NEW = `async function dtRefreshDriveTokenForRequest() {
  if (!localStorage.getItem(DT_DRIVE_CONNECTED_KEY)) return false;

  for (let i = 0; i < 30 && !(window.google && google.accounts && google.accounts.oauth2); i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!dtGoogleTokenClient && !dtInitGoogleTokenClient()) return false;

  if (window.__dtDriveRequestRefreshPromise) {
    return await window.__dtDriveRequestRefreshPromise;
  }

  window.__dtDriveRequestRefreshPromise = new Promise(resolve => {
    let settled = false;
    let timeoutId = null;

    const finish = ok => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      window.__dtDriveRequestRefreshResolve = null;
      resolve(!!ok);
    };

    window.__dtDriveRequestRefreshResolve = finish;

    const requestWhenReady = () => {
      if (settled) return;
      if (dtDriveTokenRequestInFlight) {
        setTimeout(requestWhenReady, 100);
        return;
      }

      dtDriveTokenRequestInFlight = true;
      window.__dtDriveProactiveRefresh = true;
      dtSetDriveStatus("Google Drive connected ✓ · renewing access for this song…", "ok");
      try {
        dtGoogleTokenClient.requestAccessToken({ prompt: "" });
      } catch (error) {
        dtDriveTokenRequestInFlight = false;
        window.__dtDriveProactiveRefresh = false;
        finish(false);
      }
    };

    timeoutId = setTimeout(() => finish(false), 10000);
    requestWhenReady();
  }).finally(() => {
    window.__dtDriveRequestRefreshPromise = null;
  });

  return await window.__dtDriveRequestRefreshPromise;
}

async function dtDriveFetch(url, options = {}) {
  if (!dtGoogleAccessToken) {
    const renewed = await dtRefreshDriveTokenForRequest();
    if (!renewed || !dtGoogleAccessToken) throw new Error("Google Drive is not connected.");
  }

  const doFetch = () => fetch(url, {
    ...options,
    headers: {
      Authorization: "Bearer " + dtGoogleAccessToken,
      ...(options.headers || {})
    }
  });

  let response = await doFetch();

  if (response.status === 401) {
    const renewed = await dtRefreshDriveTokenForRequest();
    if (renewed && dtGoogleAccessToken) {
      response = await doFetch();
      if (response.ok) {
        dtSetDriveStatus("Google Drive connected ✓ · song loaded", "ok");
        return response;
      }
    }
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 401) {
      dtGoogleAccessToken = "";
      dtClearStoredDriveToken();
      if (dtDriveConnectBtn) dtDriveConnectBtn.textContent = "Reconnect Google Drive";
      dtSetDriveStatus("Google Drive session needs reconnecting · click Reconnect Google Drive", "warn");
    }
    throw new Error("Google Drive " + response.status + (detail ? " · " + detail : ""));
  }

  return response;
}`;

const DT_CALLBACK_ERROR_OLD = `      if (!response || response.error || !response.access_token) {
        dtGoogleAccessToken = "";
        dtClearStoredDriveToken();
        if (dtDriveConnectBtn) dtDriveConnectBtn.textContent = "Connect Google Drive";
        dtSetDriveStatus("Google Drive sign-in was not completed · local browser library remains available", "warn");
        return;
      }
      dtStoreDriveToken(response);`;

const DT_CALLBACK_ERROR_NEW = `      if (!response || response.error || !response.access_token) {
        if (window.__dtDriveProactiveRefresh && dtGoogleAccessToken) {
          window.__dtDriveProactiveRefresh = false;
          dtDriveTokenRequestInFlight = false;
          dtSetDriveStatus("Google Drive connected ✓ · silent renewal will retry if needed", "ok");
          return;
        }
        dtGoogleAccessToken = "";
        dtClearStoredDriveToken();
        if (dtDriveConnectBtn) dtDriveConnectBtn.textContent = "Connect Google Drive";
        dtSetDriveStatus("Google Drive sign-in was not completed · local browser library remains available", "warn");
        return;
      }
      window.__dtDriveProactiveRefresh = false;
      dtStoreDriveToken(response);`;

const DT_ERROR_CALLBACK_OLD = `    error_callback: () => {
      dtDriveTokenRequestInFlight = false;
      dtGoogleAccessToken = "";
      dtClearStoredDriveToken();
      if (dtDriveConnectBtn) dtDriveConnectBtn.textContent = "Connect Google Drive";
      dtSetDriveStatus("Google Drive reconnect required · click Connect Google Drive", "warn");
    }`;

const DT_ERROR_CALLBACK_NEW = `    error_callback: () => {
      dtDriveTokenRequestInFlight = false;
      if (window.__dtDriveProactiveRefresh && dtGoogleAccessToken) {
        window.__dtDriveProactiveRefresh = false;
        dtSetDriveStatus("Google Drive connected ✓ · silent renewal will retry if needed", "ok");
        return;
      }
      dtGoogleAccessToken = "";
      dtClearStoredDriveToken();
      if (dtDriveConnectBtn) dtDriveConnectBtn.textContent = "Connect Google Drive";
      dtSetDriveStatus("Google Drive reconnect required · click Connect Google Drive", "warn");
    }`;

function patchTrainerHtml(html) {
  let out = html;
  out = out.replace(DT_STORE_TOKEN_OLD, DT_STORE_TOKEN_NEW);
  out = out.replace(DT_DRIVE_FETCH_OLD, DT_DRIVE_FETCH_NEW);
  out = out.replace(DT_CALLBACK_ERROR_OLD, DT_CALLBACK_ERROR_NEW);
  out = out.replace(DT_ERROR_CALLBACK_OLD, DT_ERROR_CALLBACK_NEW);
  return out;
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isTrainerPage = event.request.mode === "navigate" || /\/index\.html$/.test(url.pathname);

  if (isTrainerPage) {
    event.respondWith(
      fetch(event.request)
        .then(async response => {
          if (!response.ok) return response;
          const html = await response.text();
          const patched = patchTrainerHtml(html);
          return new Response(patched, {
            status: response.status,
            statusText: response.statusText,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-cache"
            }
          });
        })
        .catch(async () => {
          const cached = await caches.match("./index.html");
          if (!cached) throw new Error("Offline trainer page is unavailable.");
          const html = await cached.text();
          return new Response(patchTrainerHtml(html), {
            headers: { "Content-Type": "text/html; charset=utf-8" }
          });
        })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
