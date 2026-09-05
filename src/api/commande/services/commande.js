'use strict';

const { createHash, createHmac } = require('node:crypto');
const { createCoreService } = require('@strapi/strapi').factories;

const algorithm = 'AWS4-HMAC-SHA256';
const region = 'auto';
const service = 's3';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
const encode = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

const getR2Config = () => {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_PRIVATE_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) throw new Error('Le stockage privé R2 n’est pas configuré.');
  return { accountId, accessKeyId, secretAccessKey, bucket, host: `${accountId}.r2.cloudflarestorage.com` };
};

const signingKey = (secretAccessKey, dateStamp) => {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, 'aws4_request');
};

const createDownloadUrl = (key) => {
  const r2 = getR2Config();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const path = `/${encode(r2.bucket)}/${key.split('/').map(encode).join('/')}`;
  const headers = { host: r2.host };
  const signedHeaders = 'host';
  const parameters = [
    ['X-Amz-Algorithm', algorithm],
    ['X-Amz-Credential', `${r2.accessKeyId}/${credentialScope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', '300'],
    ['X-Amz-SignedHeaders', signedHeaders],
  ];
  const canonicalQuery = parameters.sort(([first], [second]) => first.localeCompare(second)).map(([name, value]) => `${encode(name)}=${encode(value)}`).join('&');
  const canonicalRequest = ['GET', path, canonicalQuery, `host:${headers.host}\n`, signedHeaders, 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = [algorithm, amzDate, credentialScope, sha256(canonicalRequest)].join('\n');
  const signature = createHmac('sha256', signingKey(r2.secretAccessKey, dateStamp)).update(stringToSign).digest('hex');
  return `https://${r2.host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
};

module.exports = createCoreService('api::commande.commande', ({ strapi }) => ({
  async getPrivatePhotoUrl(documentId) {
    const order = await strapi.documents('api::commande.commande').findOne({
      documentId,
      fields: ['photo_privee'],
    });
    const photo = Array.isArray(order?.photo_privee)
      ? order.photo_privee[0]
      : order?.photo_privee;
    const key = photo?.key;
    if (!key || !/^commandes\/(?:pending|payees\/c[a-f0-9]{32})\/[a-f0-9-]{36}\.[a-z0-9]{1,12}$/.test(key)) return null;
    return createDownloadUrl(key);
  },
}));
