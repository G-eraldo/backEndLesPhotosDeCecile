const path = require("node:path");

module.exports = ({ env }) => ({
  upload: {
    config: {
      provider: "@strapi/provider-upload-aws-s3",
      providerOptions: {
        s3Options: {
          credentials: {
            accessKeyId: env("R2_ACCESS_KEY_ID"),
            secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
          },
          region: "auto",
          endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
          params: {
            Bucket: env("R2_PUBLIC_BUCKET"),
          },
          forcePathStyle: true,
        },
        baseUrl: env("R2_PUBLIC_URL"),
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },
  email: {
    config: {
      provider: path.resolve(__dirname, "../providers/email-resend"),
      providerOptions: {
        apiKey: env("RESEND_API_KEY"), // Required
      },
      settings: {
        defaultFrom: env("RESEND_FROM_EMAIL"),
        defaultReplyTo: env("RESEND_REPLY_TO_EMAIL"),
      },
    },
  },
  "users-permissions": {
    config: {
      jwtManagement: "refresh",
      sessions: {
        httpOnly: true,
      },
    },
  },
});
