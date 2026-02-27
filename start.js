const http = require('http');
const fs = require('fs');
const path = require('path');

// Railway assigns the port dynamically via the PORT environment variable
const PORT = process.env.PORT || 3000;
let currentTargetUrl = 'https://google.com';
let receiverSignal = null; // { url: string, timestamp: number }

const server = http.createServer((req, res) => {
    // Robust parsing for production
    const [rawPath, rawQuery] = req.url.split('?');
    const query = new URLSearchParams(rawQuery || '');
    const pathName = rawPath.endsWith('/') && rawPath.length > 1 ? rawPath.slice(0, -1) : rawPath;

    // 1. RECEIVER PAGE at /r
    if (pathName === '/r') {
        fs.readFile('./receiver.html', (err, content) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Receiver page not found');
            } else {
                res.writeHead(200, {
                    'Content-Type': 'text/html',
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                });
                res.end(content, 'utf-8');
            }
        });
        return;
    }

    // 1b. RECEIVER SIGNAL API
    if (pathName === '/api/receiver-signal') {
        // CORS headers for all receiver-signal requests
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        };

        if (req.method === 'OPTIONS') {
            res.writeHead(204, corsHeaders);
            res.end();
            return;
        }

        if (req.method === 'DELETE') {
            receiverSignal = null;
            console.log('[RECEIVER] Signal reset');
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'reset' }));
            return;
        }

        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data.url) {
                        receiverSignal = { url: data.url, timestamp: Date.now() };
                        console.log(`[RECEIVER] Signal set: ${data.url}`);
                        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'ok', url: data.url }));
                    } else {
                        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'error', message: 'Missing url' }));
                    }
                } catch (e) {
                    res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON' }));
                }
            });
            return;
        }

        // GET - poll for signal
        if (receiverSignal) {
            const signal = receiverSignal;
            receiverSignal = null; // consume the signal
            console.log(`[RECEIVER] Signal consumed: ${signal.url}`);
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'redirect', url: signal.url }));
        } else {
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'waiting' }));
        }
        return;
    }



    // 2. TARGET MANAGEMENT API
    if (pathName === '/api/set-target') {
        const newUrl = query.get('url');
        if (newUrl) {
            currentTargetUrl = newUrl;
            console.log(`[SERVER] New Target Set: ${currentTargetUrl}`);
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ status: 'ok', target: currentTargetUrl }));
            return;
        }
    }

    // 3. STATIC FILE SERVING
    let filePath = '.' + pathName;
    if (filePath === './' || filePath === '.') filePath = './index.html';

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.ico': 'image/x-icon'
    };
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            // Fallback to index.html for SPA-like behavior or error handling
            fs.readFile('./index.html', (err, cont) => {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(cont, 'utf-8');
            });
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// IMPORTANT: Listen on 0.0.0.0 to be accessible on the public internet (Railway/Heroku/etc)
server.listen(PORT, '0.0.0.0', () => {
    console.log(`-----------------------------------------`);
    console.log(`DEQODE SERVER ONLINE ON PORT ${PORT}`);
    console.log(`-----------------------------------------`);

    // Log target status periodically for monitoring
    setInterval(() => {
        console.log(`[MONITOR] Current QR Target: ${currentTargetUrl}`);
    }, 5000);
});
