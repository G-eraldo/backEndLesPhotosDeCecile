const allowedMediaTypes = [
  "image/*",
  "video/*",
  "audio/*",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.*",
  "text/plain",
  "text/csv",
];

const deniedTypes = [
  "image/svg+xml",
  "application/vnd.microsoft.portable-executable",
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-executable",
  "application/x-dosexec",
  "application/x-sh",
  "text/x-shellscript",
  "application/x-mach-binary",
];

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
      provider: "strapi-provider-email-resend",
      providerOptions: {
        apiKey: env("RESEND_API_KEY"), // Required
      },
      settings: {
        defaultFrom: "contact@lafabriqueducode.fr",
        defaultReplyTo: "contact@lafabriqueducode.fr",
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
