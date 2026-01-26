const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;
let currentTargetUrl = 'https://google.com'; // Default

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // LOGICA DI REDIRECT (Quello che vede il telefono)
    if (url.pathname === '/r') {
        res.writeHead(302, { 'Location': currentTargetUrl });
        res.end();
        return;
    }

    // API PER IMPOSTARE IL TARGET (Quello che invia il PC)
    if (url.pathname === '/api/set-target') {
        const newUrl = url.searchParams.get('url');
        if (newUrl) {
            currentTargetUrl = newUrl;
            console.log(`\x1b[33m[DYNAMIC]\x1b[0m Target aggiornato a: ${currentTargetUrl}`);
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ status: 'ok', target: currentTargetUrl }));
            return;
        }
    }

    // SERVIZIO FILE STATICI (L'interfaccia dell'app)
    let filePath = '.' + url.pathname;
    if (filePath === './' || filePath === '.') filePath = './index.html';

    // Se stiamo cercando di caricare index.html ma c'è ?r=1 (vecchio metodo), facciamo redirect 
    if (url.searchParams.get('r') === '1') {
        res.writeHead(302, { 'Location': currentTargetUrl });
        res.end();
        return;
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
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

const getLocalIp = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
};

const localIp = getLocalIp();

server.listen(PORT, '0.0.0.0', () => {
    console.log('\x1b[36m%s\x1b[0m', '---------------------------------------------------');
    console.log('\x1b[1m%s\x1b[0m', '  DEQODE ENGINE V2 - ONLINE');
    console.log('\x1b[36m%s\x1b[0m', '---------------------------------------------------');
    console.log('  PC Dashboard:   \x1b[32mhttp://' + localIp + ':' + PORT + '\x1b[0m');
    console.log('  DYNAMIC QR:     \x1b[33mAccedi al link sopra dal PC per generare il QR\x1b[0m');
    console.log('\x1b[36m%s\x1b[0m', '---------------------------------------------------');
});
