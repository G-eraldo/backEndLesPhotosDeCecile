'use strict';

// Strapi email provider using the current Resend HTTP API and native fetch.
module.exports = {
  init({ apiKey }, { defaultFrom, defaultReplyTo } = {}) {
    return {
      async send({ from, to, cc, bcc, replyTo, subject, text, html, attachments, headers }) {
        if (!apiKey || !(from || defaultFrom)) throw new Error('Resend email provider is not configured.');
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: from || defaultFrom, to, cc, bcc, reply_to: replyTo || defaultReplyTo, subject, text, html, attachments, headers }),
          signal: AbortSignal.timeout(15000),
        });
        const result = await response.json();
        if (!response.ok || !result.id) throw new Error(`Email delivery rejected (${response.status}).`);
        return result;
      },
    };
  },
};
