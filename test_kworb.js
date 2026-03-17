const https = require('https');
const options = {
    hostname: 'kworb.net',
    path: '/spotify/country/it_daily.html',
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0' }
};
https.get(options, res => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
        const results = [];
        const regex = /<td class="text[^>]*>(.*?)<\/td>/g;
        let match;
        let rank = 1;
        while ((match = regex.exec(body)) !== null && rank <= 10) {
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
        console.log(results);
    });
});
