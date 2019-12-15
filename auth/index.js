const { router, createAuthToken } = require('./router');
const { localStrategy, jwtStrategy } = require('./strategies');

module.exports = {
  router, localStrategy, jwtStrategy, createAuthToken,
};
