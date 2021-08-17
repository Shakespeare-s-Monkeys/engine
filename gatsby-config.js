module.exports = {
  flags: {
    DEV_SSR: true,
    DEV_WEBPACK_CACHE: true,
  },
  siteMetadata: {
    siteUrl: "https://www.yourdomain.tld",
    title: "s-markdown-example",
  },
  plugins: [
    "gatsby-transformer-remark",
    {
      resolve: "gatsby-source-filesystem",
      options: {
        name: "pages",
        path: "./src/pages/",
      },
      __key: "pages",
    },
  ],
};
