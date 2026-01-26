const http = require('http');
const fs = require('fs');
const path = require('path');

// Railway assigns the port dynamically via the PORT environment variable
const PORT = process.env.PORT || 3000;
let currentTargetUrl = 'https://google.com';

const server = http.createServer((req, res) => {
    // We use the host header to construct the URL correctly in a cloud environment
    const url = new URL(req.url, `http://${req.headers.host}`);

    // DYNAMIC REDIRECT LOGIC (What the phone sees)
    if (url.pathname === '/r') {
        console.log(`[REDIRECT] Sending user to: ${currentTargetUrl}`);
        res.writeHead(302, { 'Location': currentTargetUrl });
        res.end();
        return;
    }

    // TARGET MANAGEMENT API (What the PC sends)
    if (url.pathname === '/api/set-target') {
        const newUrl = url.searchParams.get('url');
        if (newUrl) {
            currentTargetUrl = newUrl;
            console.log(`[SERVER] Target updated to: ${currentTargetUrl}`);
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ status: 'ok', target: currentTargetUrl }));
            return;
        }
    }

    // STATIC FILE SERVING
    let filePath = '.' + url.pathname;
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
});
