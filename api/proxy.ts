import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Common CORS setup for Vercel serverless functions
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const clientUrl = req.query.url as string;
    // Default URL if nothing provided
    const scriptUrl = clientUrl || process.env.VITE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyQNcs5g-6p4dZ4qhdKL0GYkem_hudT7PUf0ZhSVmK1dZvHjw_fzurvGqWTztk6xNyBFQ/exec';

    // Remove url from query params before forwarding
    const query = { ...req.query };
    delete query.url;

    // IMPORTANT: Apps Script "login" expects 'username' but some logic might send 'user'.
    // Let's normalize it here to be safe.
    if (query.user && !query.username) {
        query.username = query.user;
    }

    const queryParams = new URLSearchParams(query as any).toString();
    const separator = scriptUrl.includes('?') ? '&' : '?';
    const targetUrl = `${scriptUrl}${queryParams ? separator + queryParams : ''}`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

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
        }

        const response = await fetch(targetUrl, options);
        const text = await response.text();
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            try {
                res.status(200).json(JSON.parse(text));
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
                try {
                    res.status(200).json({ message: text });
                } catch (e) {
                    res.status(500).json({ error: 'Script returned non-JSON content', details: text.substring(0, 200) });
                }
            }
        }
    } catch (error: any) {
        if (error.name === 'AbortError') {
            res.status(504).json({ error: 'Connection Timeout', details: 'Google Script took too long to respond.' });
        } else {
            res.status(500).json({ error: 'Failed to connect to Google Sheets', details: error.message });
        }
    }
}
