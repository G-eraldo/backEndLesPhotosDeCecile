const { test } = require('node:test');
const assert = require('node:assert/strict');
const provider = require('../providers/email-resend');

test('email provider sends defaults and reports provider refusals', async () => {
  const previous = global.fetch;
  try {
    const mail = provider.init({ apiKey: 'fake' }, { defaultFrom: 'sender@example.org' });
    global.fetch = async (url, request) => {
      assert.equal(JSON.parse(request.body).from, 'sender@example.org');
      return { ok: true, json: async () => ({ id: 'simulated' }) };
    };
    assert.equal((await mail.send({ to: 'recipient@example.org', text: 'Test' })).id, 'simulated');
    global.fetch = async () => ({ ok: false, status: 403, json: async () => ({ message: 'refused' }) });
    await assert.rejects(mail.send({ to: 'recipient@example.org', text: 'Test' }), /rejected/);
  } finally { global.fetch = previous; }
});
