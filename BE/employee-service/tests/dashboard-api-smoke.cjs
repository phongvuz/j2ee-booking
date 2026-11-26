const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { createServer } = require('node:http');
const { join } = require('node:path');

const admin = process.env.EMPLOYEE_TEST_ADMIN_TOKEN;
const staff = process.env.EMPLOYEE_TEST_STAFF_TOKEN;
const client = process.env.EMPLOYEE_TEST_CLIENT_TOKEN;
const java = process.env.JAVA_HOME
    ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
    : 'java';
const jar = join(__dirname, '..', 'target', 'employee-service-0.0.1-SNAPSHOT.jar');

async function withBackend(urls, verify) {
    const backend = spawn(java, ['-jar', jar], {
        env: { ...process.env, SERVER_PORT: '0', SERVER_ADDRESS: '127.0.0.1', ...urls }, windowsHide: true,
    });
    const closed = new Promise((resolve) => backend.once('close', resolve));
    try {
        const baseUrl = await new Promise((resolve, reject) => {
            let log = '';
            const timeout = setTimeout(() => reject(new Error(`Backend chưa khởi động.\n${log}`)), 40000);
            backend.once('error', reject);
            backend.once('close', (code) => reject(new Error(`Backend thoát với mã ${code}.\n${log}`)));
            backend.stderr.on('data', (chunk) => { log += chunk; });
            backend.stdout.on('data', (chunk) => {
                log += chunk;
                const port = log.match(/Tomcat started on port (\d+)/)?.[1];
                if (port && log.includes('Started EmployeeServiceApplication')) {
                    clearTimeout(timeout);
                    resolve(`http://127.0.0.1:${port}`);
                }
            });
            closed.then(() => clearTimeout(timeout));
        });
        await verify(baseUrl);
    } finally {
        backend.kill();
        await closed;
    }
}

async function read(baseUrl, path, status, token = admin) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch(baseUrl + path, { headers, signal: AbortSignal.timeout(12000) });
    assert.equal(response.status, status, path);
    return response.text().then((body) => body ? JSON.parse(body) : null);
}

async function main() {
    assert(admin && staff && client, 'Cần ba JWT thử từ postman-jwt-fixture.cjs.');
    assert(/^jdbc:postgresql:\/\/(127\.0\.0\.1|localhost)[:/]/.test(process.env.SPRING_DATASOURCE_URL),
        'Cần PostgreSQL thử trên máy local.');
    let mode = 'normal';
    let ordersQuery;
    let redirects = 0;
    const mock = createServer((request, response) => {
        const url = new URL(request.url, 'http://localhost');
        if (url.pathname === '/redirect-target') redirects++;
        if (request.method !== 'GET' || request.headers.authorization !== `Bearer ${admin}`) {
            return response.writeHead(401).end();
        }
        if (url.pathname === '/orders/stats') {
            ordersQuery = Object.fromEntries(url.searchParams);
            if (mode === 'orders-error') return response.writeHead(500).end();
            if (mode === 'timeout') return;
            if (mode === 'redirect') return response.writeHead(302, { Location: '/redirect-target' }).end();
            const payload = mode === 'empty' ? { revenueVnd: 0, ticketsSold: 0 }
                : { revenueVnd: 600000, ticketsSold: mode === 'fractional' ? 2.5 : 2 };
            return response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(payload));
        }
        if (url.pathname === '/buses/stats') {
            if (mode === 'buses-error') return response.writeHead(503).end();
            const payload = mode === 'malformed' ? {} : { activeBuses: mode === 'empty' ? 0 : 3 };
            return response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(payload));
        }
        response.writeHead(404).end();
    }).listen(0, '127.0.0.1');
    try {
        await once(mock, 'listening');
        const origin = `http://127.0.0.1:${mock.address().port}`;
        await withBackend({ DASHBOARD_ORDERS_STATS_URL: `${origin}/orders/stats`,
            DASHBOARD_BUSES_STATS_URL: `${origin}/buses/stats` }, async (backend) => {
            const path = '/dashboard/stats';
            await read(backend, path, 401, '');
            await read(backend, path, 403, staff);
            await read(backend, path, 403, client);
            await read(backend, `${path}?from=2026-11-26`, 400);
            await read(backend, `${path}?from=2026-11-27&to=2026-11-26`, 400);
            assert.equal(ordersQuery, undefined);

            const rows = await read(backend, '/employees', 200);
            const count = (status) => rows.filter((row) => row.status === status).length;
            const stats = await read(backend, `${path}?from=2026-11-26&to=2026-11-27`, 200);
            assert.deepEqual(ordersQuery, { fromInclusive: '2026-11-25T17:00:00Z', toExclusive: '2026-11-27T17:00:00Z' });
            assert.deepEqual(stats, { from: '2026-11-26', to: '2026-11-27', revenueVnd: 600000, ticketsSold: 2,
                activeBuses: 3, employees: { current: count('WORKING') + count('ON_LEAVE'), working: count('WORKING'),
                    onLeave: count('ON_LEAVE'), resigned: count('RESIGNED') } });

            mode = 'empty';
            const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh',
                year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
            const before = today();
            const empty = await read(backend, path, 200);
            assert([before, today()].includes(empty.from));
            assert.equal(empty.from, empty.to);
            assert.deepEqual([empty.revenueVnd, empty.ticketsSold, empty.activeBuses], [0, 0, 0]);

            for (mode of ['orders-error', 'buses-error', 'fractional', 'malformed', 'redirect', 'timeout']) {
                const problem = await read(backend, path, 503);
                const source = ['buses-error', 'malformed'].includes(mode) ? 'Buses' : 'Orders';
                assert.match(problem.detail, new RegExp(source));
            }
            assert.equal(redirects, 0);
            await read(backend, '/employees', 200);
        });
        await withBackend({ DASHBOARD_ORDERS_STATS_URL: '', DASHBOARD_BUSES_STATS_URL: '' }, async (backend) => {
            await read(backend, '/dashboard/stats', 503);
            await read(backend, '/employees', 200);
            await new Promise((resolve, reject) => {
                const smoke = spawn('pwsh', ['-NoProfile', '-File', join(__dirname, 'employee-api-smoke.ps1'),
                    '-BaseUrl', backend], { stdio: 'inherit', windowsHide: true });
                smoke.once('error', reject);
                smoke.once('close', (code) => code === 0 ? resolve() : reject(new Error(`Employees smoke failed: ${code}`)));
            });
        });
        console.log('Dashboard API smoke test passed.');
    } finally {
        mock.closeAllConnections();
        mock.close();
    }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
