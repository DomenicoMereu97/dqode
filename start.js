const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Spotify Top 50 Italy Cache
let spotifyTop50Italy = [];
let lastFetchTime = 0;

// Fallback list based on recent data
const fallbackChart = [
    { rank: 1, name: "OSSESSIONE", artist: "Samurai Jay" },
    { rank: 2, name: "TU MI PIACI TANTO", artist: "Sayf" },
    { rank: 3, name: "Che fastidio!", artist: "Ditonellapiaga" },
    { rank: 4, name: "Per sempre sì", artist: "Sal Da Vinci" },
    { rank: 5, name: "Poesie Clandestine", artist: "LDA & Aka 7even" }
];

async function updateSpotifyChart() {
    console.log('[SPOTIFY] Fetching Top 50 Italy from Kworb...');
    return new Promise((resolve) => {
        // We use a user-agent to avoid being blocked
        const options = {
            hostname: 'kworb.net',
            path: '/spotify/country/it_daily.html',
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };

        const req = https.get(options, (res) => {
            if (res.statusCode !== 200) {
                console.error(`[SPOTIFY] Failed request: ${res.statusCode}`);
                if (!spotifyTop50Italy.length) spotifyTop50Italy = fallbackChart;
                return resolve();
            }

            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const results = [];
                    const rowRegex = /<td class="text[^>]*>(.*?)<\/td>/g;
                    let match;
                    let rank = 1;
                    while ((match = rowRegex.exec(body)) !== null && rank <= 50) {
                        const tdContent = match[1];

                        const trackMatch = tdContent.match(/track\/[^"]+\.html">([^<]+)<\/a>/);
                        const artistMatches = [...tdContent.matchAll(/artist\/[^"]+\.html">([^<]+)<\/a>/g)];

                        if (trackMatch && artistMatches.length > 0) {
                            const trackTitle = trackMatch[1].replace(/&amp;/g, '&');
                            const artistNames = artistMatches.map(m => m[1].replace(/&amp;/g, '&')).join(' & ');

                            results.push({
                                rank: rank++,
                                artist: artistNames,
                                name: trackTitle
                            });
                        }
                    }

                    if (results.length > 0) {
                        spotifyTop50Italy = results;
                        lastFetchTime = Date.now();
                        console.log(`[SPOTIFY] Updated! Top 1: ${results[0].name} by ${results[0].artist}`);
                    } else {
                        console.warn('[SPOTIFY] No songs found in HTML pattern. Using fallback.');
                        if (!spotifyTop50Italy.length) spotifyTop50Italy = fallbackChart;
                    }
                    resolve();
                } catch (e) {
                    console.error('[SPOTIFY] Scrape Error:', e.message);
                    if (!spotifyTop50Italy.length) spotifyTop50Italy = fallbackChart;
                    resolve();
                }
            });
        });

        req.on('error', (e) => {
            console.error('[SPOTIFY] Fetch Error:', e.message);
            if (!spotifyTop50Italy.length) spotifyTop50Italy = fallbackChart;
            resolve();
        });

        req.setTimeout(10000, () => {
            req.destroy();
            console.warn('[SPOTIFY] Request timed out');
            if (!spotifyTop50Italy.length) spotifyTop50Italy = fallbackChart;
            resolve();
        });
    });
}

// Update every 4 hours
setInterval(updateSpotifyChart, 4 * 3600000);
updateSpotifyChart();

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

        // GET -  poll for signal
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

    // 1d. SPOTIFY TOP CHART API
    if (pathName === '/api/spotify-top') {
        const pos = parseInt(query.get('pos') || '1');
        const songToFind = spotifyTop50Italy.find(s => s.rank === pos);

        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });

        if (songToFind) {
            res.end(JSON.stringify({
                status: 'ok',
                rank: pos,
                query: `${songToFind.name} ${songToFind.artist}`,
                name: songToFind.name,
                artist: songToFind.artist
            }));
        } else {
            res.end(JSON.stringify({ status: 'error', message: 'Position not found' }));
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

// IMPORTANT : Listen on 0.0.0.0 to be accessible on the public internet (Railway/Heroku/etc)
server.listen(PORT, '0.0.0.0', () => {
    console.log(`-----------------------------------------`);
    console.log(`DEQODE SERVER ONLINE ON PORT ${PORT}`);
    console.log(`-----------------------------------------`);

    // Log target status periodically for monitoring
    setInterval(() => {
        console.log(`[MONITOR] Current QR Target: ${currentTargetUrl}`);
    }, 5000);
});
