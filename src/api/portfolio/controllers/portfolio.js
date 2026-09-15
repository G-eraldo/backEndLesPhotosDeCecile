'use strict';

const PAGE_SIZE = 100;

const findAllDocuments = async (uid, params) => {
  const documents = strapi.documents(uid);
  const results = [];

  for (let start = 0; ; start += PAGE_SIZE) {
    const batch = await documents.findMany({
      ...params,
      start,
      limit: PAGE_SIZE,
    });

    results.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return results;
};

const isCloudinaryUrl = (url) => {
  try {
    return /(^|\.)cloudinary\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

module.exports = {
  async find(ctx) {
    const folders = await findAllDocuments('plugin::upload.folder', {
      fields: ['name', 'path', 'pathId'],
      sort: ['pathId:asc'],
    });

    const portfolioPaths = folders
      .filter((folder) => String(folder.name || '').trim().toLowerCase() === 'portfolio')
      .map((folder) => String(folder.path || '').replace(/\/$/, ''))
      .filter(Boolean);

    if (!portfolioPaths.length) {
      ctx.body = { data: [] };
      return;
    }

    const files = await findAllDocuments('plugin::upload.file', {
      fields: [
        'name',
        'alternativeText',
        'caption',
        'width',
        'height',
        'hash',
        'ext',
        'mime',
        'size',
        'url',
        'provider',
        'folderPath',
      ],
      filters: {
        mime: { $startsWith: 'image/' },
        $or: portfolioPaths.flatMap((path) => [
          { folderPath: path },
          { folderPath: { $startsWith: `${path}/` } },
        ]),
      },
      sort: ['id:asc'],
    });

    ctx.body = {
      data: files.filter((file) => file.url && !isCloudinaryUrl(file.url)),
    };
  },
};
