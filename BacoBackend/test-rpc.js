const https = require('https');

const rpcs = [
  'https://polygon-amoy.blockpi.network/v1/rpc/public',
  'https://1rpc.io/amoy',
  'https://rpc.ankr.com/polygon_amoy',
  'https://amoy.drpc.org',
];

async function test(url) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 });
    const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve('CONNECTION FAILED'));
    req.write(body);
    req.end();
  });
}

(async () => {
  for (const url of rpcs) {
    const result = await test(url);
    console.log(url);
    console.log('  → ' + result.trim().substring(0, 80));
    console.log();
  }
})();