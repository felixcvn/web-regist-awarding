/*
 * Link-only invitation regressions for security-review.cjs. Every address,
 * credential, and ticket is synthetic. Capturing/stream transports never
 * connect to Gmail; registration tests replace the database and quota store.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');

const invitation = {
  to: 'receiver@example.test',
  name: 'Peserta Uji',
  qrToken: 'FAN26-00000000-0000-4000-8000-000000000001',
  category: 'Mahasiswa Fasilkom',
  batch: '2023',
};
const origin = 'https://event.example.test';
const contextSentence = 'Anda menerima email ini karena telah mendaftar melalui website Fasilkom Awarding Night 2026.';

function capturingMailer(load, environment = {}, deliver) {
  const state = { messages: [], configurations: [], qrCalls: 0, warnings: [] };
  const mailer = load('src/lib/mailer.ts', {
    nodemailer: {
      createTransport(configuration) {
        state.configurations.push(configuration);
        return {
          async sendMail(message) {
            state.messages.push(message);
            return deliver ? deliver(message) : { accepted: [message.to] };
          },
        };
      },
    },
    qrcode: {
      toBuffer() { state.qrCalls++; throw new Error('Email must not generate a QR image.'); },
    },
  }, {
    process: { env: {
      NODE_ENV: 'production', GMAIL_USER: 'sender@example.test', GMAIL_APP_PASSWORD: 'synthetic-only',
      NEXT_PUBLIC_APP_URL: `${origin}/`, ...environment,
    } },
    console: { ...console, warn: (...values) => state.warnings.push(values) },
  });
  return { mailer, state };
}

function assertLinkOnly(message, ticketUrl) {
  assert.equal(message.from, '"Fasilkom Awarding Night 2026" <sender@example.test>');
  assert.equal(message.to, invitation.to);
  assert.equal(message.subject, 'Konfirmasi Pendaftaran — Fasilkom Awarding Night 2026');
  assert.equal((message.attachments || []).length, 0);
  assert.equal(Object.hasOwn(message, 'attachments'), false);
  assert.doesNotMatch(message.html, /<img\b|\bcid:|data:image|\/api\/qr\/|url\s*\(/i);
  assert.ok(message.html.includes('Lihat &amp; Unduh Tiket'));
  assert.ok(message.html.includes(contextSentence));
  assert.ok(message.text.includes(contextSentence));
  assert.ok(message.text.includes(ticketUrl));
  const links = [...message.html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(links.length, 2, 'Keep the main ticket button and its fallback link.');
  assert.ok(links.every((link) => link === ticketUrl));
  for (const detail of ['Secret Garden: Dreams to History', 'Selasa, 1 Desember 2026 • 17:30 WIB', 'Gedung Soetardjo Universitas Jember']) {
    assert.ok(message.html.includes(detail));
    assert.ok(message.text.includes(detail));
  }
  assert.ok(message.html.includes('max-width:560px'));
  assert.ok(message.html.includes('word-break:break-all'));
}

async function checkMailer({ load, outputDirectory }) {
  const cases = [];
  const states = [];
  const ticketUrl = `${origin}/ticket/${invitation.qrToken}`;
  let preview;
  for (const mode of [undefined, 'cid', 'url', 'unknown']) {
    const { mailer, state } = capturingMailer(load, { QR_EMAIL_MODE: mode });
    states.push(state);
    assert.equal((await mailer.sendInvitationEmail(invitation)).sent, true);
    assertLinkOnly(state.messages[0], ticketUrl);
    assert.equal(state.qrCalls, 0);
    assert.equal(state.configurations[0].service, 'gmail');
    assert.equal(state.configurations[0].auth.user, 'sender@example.test');
    assert.equal(state.configurations[0].auth.pass, 'synthetic-only');
    if (preview) {
      assert.equal(state.messages[0].html, preview.html);
      assert.equal(state.messages[0].text, preview.text);
    } else preview = state.messages[0];
    cases.push(`link-only-${mode || 'default'}`);
  }

  const escaped = capturingMailer(load);
  states.push(escaped.state);
  const payload = { ...invitation, name: '<img src=x onerror=alert(1)>&" O\'Connor', category: 'A&B <script>"\'', batch: '20<3', qrToken: 'FAN26-<tag>&"/?#' };
  await escaped.mailer.sendInvitationEmail(payload);
  const escapedMessage = escaped.state.messages[0];
  const encodedUrl = `${origin}/ticket/${encodeURIComponent(payload.qrToken)}`;
  assert.doesNotMatch(escapedMessage.html, /<img\b|<script\b/i);
  assert.ok(escapedMessage.html.includes('&lt;img src=x onerror=alert(1)&gt;&amp;&quot; O&#39;Connor'));
  assert.ok(escapedMessage.html.includes('A&amp;B &lt;script&gt;&quot;&#39;'));
  assert.ok(escapedMessage.html.includes('Angkatan: 20&lt;3'));
  assert.ok(escapedMessage.html.includes(`href="${encodedUrl}"`));
  assert.ok(escapedMessage.text.includes(payload.name));
  assert.ok(escapedMessage.text.includes(encodedUrl));
  cases.push('escaped-html-and-encoded-ticket-path');

  const noBatch = capturingMailer(load);
  await noBatch.mailer.sendInvitationEmail({ ...invitation, batch: '-' });
  assert.doesNotMatch(noBatch.state.messages[0].html, /Angkatan:/);
  assert.doesNotMatch(noBatch.state.messages[0].text, /Angkatan:/);
  cases.push('no-placeholder-batch');

  for (const { label, environment, expectedOrigin } of [
    { label: 'vercel-url-fallback', environment: { NEXT_PUBLIC_APP_URL: '', VERCEL_URL: 'deployment.example.test/' }, expectedOrigin: 'https://deployment.example.test' },
    { label: 'development-url-fallback', environment: { NODE_ENV: 'development', NEXT_PUBLIC_APP_URL: '' }, expectedOrigin: 'http://localhost:3000' },
  ]) {
    const { mailer, state } = capturingMailer(load, environment);
    await mailer.sendInvitationEmail(invitation);
    assertLinkOnly(state.messages[0], `${expectedOrigin}/ticket/${invitation.qrToken}`);
    cases.push(label);
  }

  const cached = capturingMailer(load);
  await cached.mailer.sendInvitationEmail(invitation);
  await cached.mailer.sendInvitationEmail(invitation);
  assert.equal(cached.state.configurations.length, 1);
  assert.equal(cached.state.messages.length, 2);
  cases.push('reuse-gmail-transport');

  for (const environment of [
    { GMAIL_USER: '' }, { GMAIL_APP_PASSWORD: '' }, { GMAIL_USER: '', GMAIL_APP_PASSWORD: '' },
  ]) {
    const { mailer, state } = capturingMailer(load, environment);
    assert.equal((await mailer.sendInvitationEmail(invitation)).sent, false);
    assert.equal(state.configurations.length, 0);
    assert.equal(state.messages.length, 0);
    assert.equal(state.warnings.length, 1);
    cases.push(`skip-missing-${Object.keys(environment).join('-')}`);
  }

  const failure = new Error('Synthetic SMTP rejection');
  const rejected = capturingMailer(load, {}, async () => { throw failure; });
  await assert.rejects(rejected.mailer.sendInvitationEmail(invitation), (error) => error === failure);
  assert.equal(rejected.state.messages.length, 1, 'Do not add automatic SMTP retries.');
  cases.push('smtp-failure-without-retry');

  const stream = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' });
  let mime;
  const streamed = capturingMailer(load, {}, async (message) => { mime = await stream.sendMail(message); return mime; });
  await streamed.mailer.sendInvitationEmail(invitation);
  assert.ok(Buffer.isBuffer(mime.message));
  const rawMime = mime.message.toString('utf8');
  assert.match(rawMime, /^Content-Type: multipart\/alternative;/mi);
  assert.match(rawMime, /^Content-Type: text\/plain; charset=utf-8/mi);
  assert.match(rawMime, /^Content-Type: text\/html; charset=utf-8/mi);
  assert.doesNotMatch(rawMime, /^Content-Type: (?:image\/|multipart\/(?:mixed|related))/mi);
  assert.doesNotMatch(rawMime, /^Content-Disposition:|^Content-ID:/mi);
  cases.push('real-mime-text-and-html-without-attachments');

  const previewFiles = [];
  if (outputDirectory) {
    for (const [name, contents] of [['invitation.html', preview.html], ['invitation.txt', preview.text], ['invitation.eml', mime.message]]) {
      const filename = path.join(outputDirectory, name);
      fs.writeFileSync(filename, contents);
      previewFiles.push(filename);
    }
  }
  return { cases, images: 0, attachments: 0, qrGenerationCalls: states.reduce((total, state) => total + state.qrCalls, 0), mime: 'multipart/alternative', previewFiles, deliveredExternally: false };
}

async function checkRegistrationMailOutcomes({ load }) {
  const cases = [];
  const sample = {
    id: 'TKT-SYNTHETIC', nimNip: '232410101099', name: invitation.name, role: 'Mahasiswa',
    category: invitation.category, batch: invitation.batch, prodi: 'Sistem Informasi',
    email: invitation.to, phone: '080000000000', qrToken: invitation.qrToken,
    isCheckedIn: false, checkedInAt: null, createdAt: '2026-11-10T00:00:00.000Z',
  };
  for (const scenario of [
    { label: 'smtp-accepted', mailSent: true, expectedMailCalls: 1 },
    { label: 'smtp-disabled', mailSent: false, expectedMailCalls: 1 },
    { label: 'smtp-rejected', mailFailure: true, expectedMailCalls: 1 },
    { label: 'quota-exhausted', quotaAllowed: false, expectedMailCalls: 0 },
    { label: 'quota-store-error', quotaFailure: true, expectedMailCalls: 0 },
    { label: 'duplicate-registration', duplicate: true, expectedMailCalls: 0, status: 409 },
    { label: 'invalid-registration', invalid: true, expectedMailCalls: 0, status: 400 },
  ]) {
    const limits = [];
    const mailCalls = [];
    const creations = [];
    const errors = [];
    const route = load('src/app/api/register/route.ts', {
      'next/server': { NextResponse: { json: (value, init) => Response.json(value, init) } },
      '@/lib/db': { createParticipant: async (participant) => {
        creations.push(participant);
        return scenario.duplicate ? { error: 'NIM sudah terdaftar.', status: 409 } : { participant: sample };
      } },
      '@/lib/mailer': { sendInvitationEmail: async (input) => {
        mailCalls.push(input);
        if (scenario.mailFailure) throw new Error('Synthetic SMTP rejection');
        return { sent: !!scenario.mailSent };
      } },
      '@/lib/ratelimit': {
        getClientIp: () => '198.18.0.1',
        rateLimit: async (bucket, maximum, windowMs) => {
          limits.push({ bucket, maximum, windowMs });
          if (bucket.startsWith('register:email:') && scenario.quotaFailure) throw new Error('Synthetic quota-store failure');
          return { allowed: bucket.startsWith('register:email:') ? scenario.quotaAllowed !== false : true };
        },
        rateLimitResponse: () => { throw new Error('Unexpected IP quota failure'); },
      },
    }, { process: { env: { NODE_ENV: 'production' } }, console: { ...console, error: (...values) => errors.push(values) } });
    const request = new Request(`${origin}/api/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sample, nimNip: scenario.invalid ? 'invalid' : sample.nimNip, email: ' Receiver@Example.test ' }),
    });
    const response = await route.POST(request);
    const body = await response.json();
    assert.equal(response.status, scenario.status || 200);
    assert.equal(mailCalls.length, scenario.expectedMailCalls);
    assert.equal(creations.length, scenario.invalid ? 0 : 1);
    assert.deepEqual(limits[0], { bucket: 'register:198.18.0.1', maximum: 5, windowMs: 60_000 });
    if (response.status === 200) {
      assert.equal(body.success, true);
      assert.equal(body.emailSent, !!scenario.mailSent);
      assert.equal(body.ticketUrl, `/ticket/${sample.qrToken}`);
      assert.equal(body.participant.qrToken, sample.qrToken);
      for (const key of ['email', 'phone', 'createdAt', 'checkedInAt']) assert.equal(Object.hasOwn(body.participant, key), false);
      assert.equal(limits.length, 2);
      assert.deepEqual(limits[1], { bucket: `register:email:${invitation.to}`, maximum: 2, windowMs: 3_600_000 });
      assert.equal(creations[0].email, invitation.to);
      if (mailCalls.length) {
        assert.equal(mailCalls[0].to, invitation.to);
        assert.equal(mailCalls[0].qrToken, sample.qrToken);
      }
    } else {
      assert.equal(limits.length, 1, 'Invalid and duplicate registrations must not consume an email attempt.');
      assert.equal(body.success, undefined);
    }
    assert.equal(errors.length, scenario.mailFailure || scenario.quotaFailure ? 1 : 0);
    cases.push({ label: scenario.label, status: response.status, mailCalls: mailCalls.length, ticketIssued: response.status === 200 });
  }
  return { cases, recipientQuota: '2 attempts/address/hour', ipQuota: '5 attempts/IP/minute', realDatabaseOrSmtpContacted: false };
}

module.exports = { checkMailer, checkRegistrationMailOutcomes };
