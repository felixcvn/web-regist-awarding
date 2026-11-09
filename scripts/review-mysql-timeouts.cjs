/*
 * Deadline assertions against the runner's isolated MySQL/MariaDB. A loopback
 * proxy deliberately withholds protocol commands; no production database,
 * credentials, operating-system service, or application configuration is used.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const LOOKUP_SQL = 'SELECT id FROM participants WHERE nim_nip = ? LIMIT 1';
const PREPARE_DELAY_MS = 7000;

async function testDeadline(promise, ms = 25_000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Deadline assertion did not finish in time.')), ms);
    })]);
  } finally { clearTimeout(timer); }
}

async function faultProxy(databaseEnv, phase) {
  const sockets = new Set();
  const timers = new Set();
  const state = { armed: false, connections: 0, withheldCommands: 0, delayedPrepares: 0, queryAttributeCommands: 0 };
  const listener = net.createServer((client) => {
    const upstream = net.createConnection({ host: '127.0.0.1', port: Number(databaseEnv.MYSQL_PORT) });
    const pairTimers = new Set();
    sockets.add(client);
    sockets.add(upstream);
    state.connections++;
    const disconnect = () => {
      for (const timer of pairTimers) { clearTimeout(timer); timers.delete(timer); }
      client.destroy();
      upstream.destroy();
      sockets.delete(client);
      sockets.delete(upstream);
    };
    for (const socket of [client, upstream]) {
      socket.on('error', disconnect);
      socket.on('end', disconnect);
      socket.on('close', disconnect);
    }
    upstream.pipe(client);
    let pending = Buffer.alloc(0);
    client.on('data', (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      while (pending.length >= 4) {
        const length = pending.readUIntLE(0, 3);
        if (pending.length < length + 4) break;
        const packet = pending.subarray(0, length + 4);
        pending = pending.subarray(length + 4);
        const command = packet[4];
        // MySQL 8.0.23+ negotiates CLIENT_QUERY_ATTRIBUTES. For our static
        // queries mysql2 writes parameter_count=0, parameter_set_count=1
        // before SQL; MariaDB uses the older payload without those bytes.
        const queryAttributes = command === 0x03 && packet[5] === 0 && packet[6] === 1;
        const sql = command === 0x03 || command === 0x16 ? packet.subarray(queryAttributes ? 7 : 5).toString('utf8') : '';
        const initialCommand = packet[3] === 0 && state.armed;
        if (initialCommand && queryAttributes) state.queryAttributeCommands++;
        if (initialCommand && phase === 'prepare-execute' && command === 0x16 && sql === LOOKUP_SQL) {
          state.delayedPrepares++;
          const timer = setTimeout(() => {
            timers.delete(timer);
            pairTimers.delete(timer);
            if (!upstream.destroyed) upstream.write(packet);
          }, PREPARE_DELAY_MS);
          timers.add(timer);
          pairTimers.add(timer);
          continue;
        }
        const withhold = initialCommand && (
          (phase === 'prepare' && command === 0x16 && sql === LOOKUP_SQL) ||
          (['execute', 'prepare-execute'].includes(phase) && command === 0x17) ||
          (phase === 'commit' && command === 0x03 && sql === 'COMMIT') ||
          (phase === 'diagnostic' && command === 0x03 && sql.startsWith('SELECT VERSION()'))
        );
        if (withhold) { state.withheldCommands++; continue; }
        upstream.write(packet);
      }
    });
  });
  await new Promise((resolve, reject) => listener.listen(0, '127.0.0.1', resolve).once('error', reject));
  return {
    state, port: listener.address().port,
    async close() {
      for (const timer of timers) clearTimeout(timer);
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
    },
  };
}

function elapsedWithin(started, minimum, maximum) {
  const elapsedMs = Date.now() - started;
  assert.ok(elapsedMs >= minimum && elapsedMs <= maximum, `Unexpected deadline duration: ${elapsedMs} ms`);
  return elapsedMs;
}

async function protocolCase({ databaseEnv, dbClient, load }, phase) {
  const proxy = await faultProxy(databaseEnv, phase);
  const pools = [];
  const messages = [];
  const input = { nimNip: `Deadline-${crypto.randomUUID()}`, name: 'Peserta Deadline Sintetis', role: 'Tamu Undangan',
    category: 'Mahasiswa Fasilkom', batch: '-', prodi: '-', email: 'deadline@example.test', phone: '080000000000' };
  try {
    const db = load(pools, messages, { MYSQL_PORT: String(proxy.port) });
    await testDeadline(db.getAllParticipants());
    proxy.state.armed = true;
    const started = Date.now();
    if (phase === 'commit') {
      const result = await testDeadline(db.createParticipant(input));
      assert.equal(proxy.state.withheldCommands, 1, 'Fault proxy did not withhold COMMIT.');
      assert.equal(result.status, 503);
    } else {
      await assert.rejects(testDeadline(db.isNimRegistered(input.nimNip)), (error) => error.status === 503);
    }
    const elapsedMs = elapsedWithin(started, 14_000, 20_000);
    assert.equal(proxy.state.withheldCommands, 1);
    assert.equal(proxy.state.delayedPrepares, phase === 'prepare-execute' ? 1 : 0);
    assert.ok(messages.some((message) => message.includes('MYSQL_QUERY_TIMEOUT')));
    proxy.state.armed = false;
    assert.equal(await testDeadline(db.isNimRegistered(input.nimNip), 5000), false);
    assert.ok(proxy.state.connections >= 2, 'Expired connection must not be reused.');
    if (phase === 'commit') {
      const stored = await dbClient.query('SELECT COUNT(*) AS count FROM participants WHERE nim_nip = $1', [input.nimNip.toLowerCase()]);
      assert.equal(Number(stored.rows[0].count), 0);
      const retry = await testDeadline(db.createParticipant(input), 5000);
      assert.ok(retry.participant);
      assert.equal(await db.deleteParticipant(retry.participant.id), true);
    }
    return { phase, elapsedMs, deadlineMs: 15_000, discardedConnection: true, recoveredOnNewConnection: true,
      queryAttributesObserved: proxy.state.queryAttributeCommands > 0,
      ...(phase === 'prepare-execute' ? { prepareDelayMs: PREPARE_DELAY_MS, combinedDeadline: true } : {}),
      ...(phase === 'commit' ? { commitNotForwarded: true, uncommittedInsertRolledBack: true, manualRetrySucceeded: true } : {}) };
  } finally {
    await proxy.close();
    await Promise.all(pools.map((pool) => pool.end()));
  }
}

async function acquisitionCase({ load }) {
  const pools = [];
  const messages = [];
  const leases = [];
  let releaseListener;
  try {
    const db = load(pools, messages, {});
    await testDeadline(db.getAllParticipants());
    const pool = pools[0];
    leases.push(...await Promise.all(Array.from({ length: 5 }, () => pool.getConnection())));
    let enqueued = 0;
    pool.on('enqueue', () => enqueued++);
    const started = Date.now();
    await assert.rejects(testDeadline(db.isNimRegistered('deadline-pool-lookup'), 18_000), (error) => error.status === 503);
    const elapsedMs = elapsedWithin(started, 9000, 14_000);
    assert.equal(enqueued, 1);
    assert.ok(messages.some((message) => message.includes('MYSQL_POOL_TIMEOUT')));
    const returned = new Promise((resolve) => { releaseListener = resolve; pool.once('release', releaseListener); });
    leases.shift().release();
    // The late acquisition belongs to the expired request, which must return
    // it to the pool. Four leases stay held while the recovered request runs.
    await testDeadline(returned, 3000);
    assert.equal(await testDeadline(db.isNimRegistered('deadline-pool-lookup'), 3000), false);
    return { phase: 'pool-acquisition', elapsedMs, deadlineMs: 10_000, lateLeaseReturned: true, recovered: true };
  } finally {
    if (releaseListener) pools[0].removeListener('release', releaseListener);
    for (const lease of leases) lease.release();
    await Promise.all(pools.map((pool) => pool.end()));
  }
}

async function diagnosticCase({ source, databaseEnv }) {
  const proxy = await faultProxy(databaseEnv, 'diagnostic');
  let child;
  try {
    proxy.state.armed = true;
    const baseEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|USERPROFILE|APPDATA|LOCALAPPDATA|TEMP|TMP|HOME)$/i.test(key)));
    const started = Date.now();
    child = spawn(process.execPath, [path.join(source, 'scripts/check-mysql.cjs')], {
      cwd: source, env: { ...baseEnv, ...databaseEnv, MYSQL_PORT: String(proxy.port) }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    const code = await testDeadline(new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); }));
    assert.equal(proxy.state.withheldCommands, 1, 'Fault proxy did not withhold the diagnostic query.');
    const elapsedMs = elapsedWithin(started, 14_000, 20_000);
    const result = JSON.parse(stderr);
    assert.equal(code, 1);
    assert.equal(stdout, '');
    assert.equal(result.connected, false);
    assert.equal(result.readOnly, true);
    assert.equal(result.code, 'PROTOCOL_SEQUENCE_TIMEOUT');
    assert.equal(proxy.state.withheldCommands, 1);
    assert.equal(stderr.includes(databaseEnv.MYSQL_PASSWORD), false);
    return { phase: 'read-only-diagnostic', elapsedMs, deadlineMs: 15_000, exitedAfterTimeout: true, passwordInOutput: false,
      queryAttributesObserved: proxy.state.queryAttributeCommands > 0 };
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      const closed = new Promise((resolve) => child.once('close', resolve));
      child.kill();
      await closed;
    }
    await proxy.close();
  }
}

async function checkMysqlTimeouts(context) {
  const phases = ['prepare', 'execute', 'prepare-execute', 'commit', 'pool-acquisition', 'read-only-diagnostic'];
  const results = await Promise.allSettled([
    ...phases.slice(0, 4).map((phase) => protocolCase(context, phase)), acquisitionCase(context), diagnosticCase(context),
  ]);
  for (let index = 0; index < results.length; index++) {
    if (results[index].status === 'rejected') throw new Error(`${phases[index]}: ${results[index].reason.message}`);
  }
  return { transport: 'loopback protocol fault proxy to isolated database', checks: results.map((result) => result.value),
    productionDatabaseContacted: false, automaticWriteRetries: false };
}

module.exports = { checkMysqlTimeouts };
