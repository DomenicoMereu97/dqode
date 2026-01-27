const http = require('http');
const fs = require('fs');
const path = require('path');

// Railway assigns the port dynamically via the PORT environment variable
const PORT = process.env.PORT || 3000;
let currentTargetUrl = 'https://google.com';

const server = http.createServer((req, res) => {
    // Robust parsing for production
    const [rawPath, rawQuery] = req.url.split('?');
    const query = new URLSearchParams(rawQuery || '');
    const pathName = rawPath.endsWith('/') && rawPath.length > 1 ? rawPath.slice(0, -1) : rawPath;

    // 1. DYNAMIC REDIRECT LOGIC
    if (pathName === '/r') {
        console.log(`[PHONE] Redirecting to: ${currentTargetUrl}`);
        res.writeHead(302, {
            'Location': currentTargetUrl,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.end();
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
