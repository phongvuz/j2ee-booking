const { generateKeyPairSync, randomUUID, sign } = require('node:crypto');
const { createServer } = require('node:http');

const host = '127.0.0.1';
const port = 8091;
const issuer = `http://${host}:${port}`;
const kid = randomUUID();
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwks = JSON.stringify({
    keys: [{ ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' }],
});

function encode(value) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
}

createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/jwks.json') {
        response.writeHead(404).end();
        return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(jwks);
}).listen(port, host, () => {
    const header = encode({ alg: 'RS256', typ: 'JWT', kid });
    const exp = Math.floor(Date.now() / 1000) + 30 * 60;
    console.log(`Local test JWKS: ${issuer}/jwks.json`);
    for (const role of ['ADMIN', 'STAFF', 'CLIENT']) {
        const payload = encode({ iss: issuer, aud: 'employee-service', sub: `postman-${role}`, exp, role });
        const data = `${header}.${payload}`;
        const signature = sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url');
        console.log(`${role}_TOKEN=${data}.${signature}`);
    }
});
