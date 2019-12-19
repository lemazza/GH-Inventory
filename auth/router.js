
const express = require('express');
const passport = require('passport');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const { User } = require('../models');
const { localStrategy, jwtStrategy } = require('./strategies');

const config = require('../config');

const router = express.Router();

const createAuthToken = (user) => jwt.sign({ user }, config.JWT_SECRET, {
  subject: user.email,
  expiresIn: config.JWT_EXPIRY,
  algorithm: 'HS256',
});


passport.use(localStrategy);
passport.use(jwtStrategy);

const localAuth = passport.authenticate('local', { session: false });

router.use(bodyParser.json());
// The user provides a username and password to login

router.post('/login', localAuth, (req, res) => {
  console.log('login req body', req.body);
  const authToken = createAuthToken(req.body);

  User
    .findOne({ email: req.body.email })
    .then((user) => {
      const name = `${user.firstName} ${user.lastName[0]}.`;
      res.json({ authToken, name });
    });
});

const jwtAuth = passport.authenticate('jwt', { session: false });

// The user exchanges a valid JWT for a new one with a later expiration
router.post('/refresh', jwtAuth, (req, res) => {
  const authToken = createAuthToken(req.user);
  res.json({ authToken });
});

module.exports = { router, createAuthToken };
