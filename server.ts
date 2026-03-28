import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

console.log("[Server] Starting initialization...");

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize fetch function
  let fetchFn: any;
  try {
    // Force node-fetch v2
    const nodeFetch = await import('node-fetch');
    fetchFn = nodeFetch.default || nodeFetch;
    console.log("[Server] node-fetch v2 loaded successfully.");
  } catch (e) {
    console.warn("[Server] node-fetch load failed, falling back to native fetch:", e);
    fetchFn = fetch;
  }

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Google Apps Script Proxy Route
  app.all("/api/proxy", async (req, res) => {
    const clientUrl = req.query.url as string;
    const scriptUrl = clientUrl || process.env.VITE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyQNcs5g-6p4dZ4qhdKL0GYkem_hudT7PUf0ZhSVmK1dZvHjw_fzurvGqWTztk6xNyBFQ/exec';

    const query = { ...req.query };
    delete query.url;

    // Normalize 'user' to 'username' for Apps Script login compatibility
    if (query.user && !query.username) {
      query.username = query.user;
    }

    const queryParams = new URLSearchParams(query as any).toString();
    const separator = scriptUrl.includes('?') ? '&' : '?';
    const targetUrl = `${scriptUrl}${queryParams ? separator + queryParams : ''}`;

    try {
      if (!fetchFn) {
        return res.status(500).json({ error: 'Fetch function not initialized' });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

      const options: any = {
        method: req.method,
        headers: {
          'Accept': 'application/json',
        },
        redirect: 'follow',
        signal: controller.signal
      };

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        options.headers['Content-Type'] = 'application/json';
        options.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        console.log(`[Proxy] Forwarding POST body to: ${targetUrl}`);
      }

      const response = await fetchFn(targetUrl, options);

      if (response.status === 401 || response.status === 403) {
        return res.status(401).json({
          error: 'Authentication Required',
          details: 'Please set "Who has access" to "Anyone" in your Google Apps Script deployment settings.'
        });
      }

      const contentType = response.headers.get('content-type');
      const text = await response.text();

      if (contentType && contentType.includes('application/json')) {
        try {
          res.json(JSON.parse(text));
        } catch (e) {
          res.status(500).json({ error: 'Invalid JSON response from script', details: text.substring(0, 200) });
        }
      } else {
        if (text.includes('<!DOCTYPE html>') || text.includes('Google Accounts')) {
          res.status(401).json({
            error: 'Script Not Shared Correctly',
            details: 'The script is asking for a Google Login. You MUST deploy it with "Who has access: Anyone".'
          });
        } else {
          // If it's not JSON and not a login page, try to send it as JSON if possible or wrap it
          try {
            res.json({ message: text });
          } catch (e) {
            res.status(500).json({ error: 'Script returned non-JSON content', details: text.substring(0, 200) });
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('[Proxy] Timeout reaching Google Script');
        res.status(504).json({ error: 'Connection Timeout', details: 'Google Script took too long to respond. Please try again.' });
      } else {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: 'Failed to connect to Google Sheets', details: error.message });
      }
    } finally {
      // Cleanup timeout if needed (though AbortController handles it)
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "localhost", () => {
    console.log(`[Server] Listening on http://localhost:${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);

    // Test connectivity
    if (fetchFn) {
      fetchFn('https://www.google.com').then(() => {
        console.log("[Server] Internet connectivity verified.");
      }).catch((e: any) => {
        console.error("[Server] Internet connectivity check failed:", e.message);
      });
    }
  });
}

startServer().catch(err => {
  console.error("[Server] Fatal startup error:", err);
  process.exit(1);
});
