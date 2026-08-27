export default () => ({
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '1d',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID
  },
  database:{
    url: process.env.DATABASE_URL
  }
});