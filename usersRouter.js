const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const passport = require('passport');
const { createAuthToken, jwtStrategy } = require('./auth');

mongoose.Promise = global.Promise;

const router = express.Router();

const { User } = require('./models');


passport.use(jwtStrategy);
const jwtAuth = passport.authenticate('jwt', { session: false });


router.use(bodyParser.json());

function attachBearer(req, res, next) {
  if (!(req.headers.authorization)) {
    req.headers.authorization = `Bearer ${req.cookies.authToken}`;
  }

  next();
}

/*
router.get('/', (req, res) => {
  User
    .find()
    .then(users => {
      res.json({
        users: users.map(user => user.serialize())
      });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'Something went wrong.  Be sure your request is properly formatted.' });
    });
});
*/


router.get('/:id', jwtAuth, (req, res) => {
  User
    .findById(req.params.id)
    .then((user) => {
      res.json(user.serialize());
    })
    .catch((err) => {
      res.status(500).json({ error: 'Something went wrong.  Be sure your request is properly formatted.' });
    });
});

router.post('/', (req, res) => {
  const requiredFields = ['email', 'firstName', 'password', 'initials', 'active', 'admin'];
  const missingField = requiredFields.find((field) => !(field in req.body));
  if (missingField) {
    return res.status(422).json({
      code: 422,
      reason: 'ValidationError',
      message: 'Missing field',
      location: missingField,
    });
  }

  const stringFields = ['firstName', 'lastName', 'password', 'email', 'initials'];
  const nonStringField = stringFields.find(
    (field) => field in req.body && typeof req.body[field] !== 'string',
  );

  if (nonStringField) {
    return res.status(422).json({
      code: 422,
      reason: 'ValidationError',
      message: 'Incorrect field type: expected string',
      location: nonStringField,
    });
  }

  const boolFields = ['admin', 'active'];
  const nonBoolField = boolFields.find(
    (field) => field in req.body && typeof req.body[field] !== 'boolean',
  );

  if (nonBoolField) {
    return res.status(422).json({
      code: 422,
      reason: 'ValidationError',
      message: 'Incorrect field type: expected boolean',
      location: nonStringField,
    });
  }

  // If the username and password aren't trimmed we give an error.  Users might
  // expect that these will work without trimming (i.e. they want the password
  // "foobar ", including the space at the end).  We need to reject such values
  // explicitly so the users know what's happening, rather than silently
  // trimming them and expecting the user to understand.
  // We'll silently trim the other fields, because they aren't credentials used
  // to log in, so it's less of a problem.
  const explicityTrimmedFields = ['firstName', 'lastName', 'password'];
  const nonTrimmedField = explicityTrimmedFields.find(
    (field) => req.body[field].trim() !== req.body[field],
  );

  if (nonTrimmedField) {
    return res.status(422).json({
      code: 422,
      reason: 'ValidationError',
      message: 'Cannot start or end with whitespace',
      location: nonTrimmedField,
    });
  }

  const sizedFields = {
    firstName: {
      min: 1,
    },
    password: {
      min: 8,
      // bcrypt truncates after 72 characters, so let's not give the illusion
      // of security by storing extra (unused) info
      max: 72,
    },
    initials: {
      min: 2,
      max: 3,
    },
  };
  const tooSmallField = Object.keys(sizedFields).find(
    (field) => 'min' in sizedFields[field]
            && req.body[field].trim().length < sizedFields[field].min,
  );
  const tooLargeField = Object.keys(sizedFields).find(
    (field) => 'max' in sizedFields[field]
            && req.body[field].trim().length > sizedFields[field].max,
  );

  if (tooSmallField || tooLargeField) {
    return res.status(422).json({
      code: 422,
      reason: 'ValidationError',
      message: tooSmallField
        ? `Must be at least ${sizedFields[tooSmallField]
          .min} characters long`
        : `Must be at most ${sizedFields[tooLargeField]
          .max} characters long`,
      location: tooSmallField || tooLargeField,
    });
  }

  let {
    firstName, lastName, email, password, initials, active, admin,
  } = req.body;
  // Username and password come in pre-trimmed, otherwise we throw an error
  // before this
  initials = initials.trim();


  return User.find({ email })
    .count()
    .then((count) => {
      if (count > 0) {
        // There is an existing user with the same username
        return Promise.reject(new Error({
          code: 422,
          reason: 'ValidationError',
          message: 'a user with this email already exists',
          location: 'email',
        }));
      }
      // If there is no existing user, hash the password
      return User.hashPassword(password);
    })
    .then((hash) => User.create({
      firstName,
      lastName,
      email,
      initials,
      active,
      admin,
      password: hash,
    }))
    .then((user) => {
      const output = user.serialize();
      output.authToken = createAuthToken(req.body);
      return res.status(201).json(output);
    })
    .catch((err) => {
      // Forward validation errors on to the client, otherwise give a 500
      // error because something unexpected has happened
      if (err.reason === 'ValidationError') {
        return res.status(err.code).json(err);
      }
      res.status(500).json({ code: 500, message: 'Internal server error' });
    });
});

router.put('/:id', jwtAuth, async (req, res) => {
  if (!(req.params.id && req.body.id && req.params.id === req.body.id)) {
    res.status(400).json({
      error: 'Request path id and request body id values must match',
    });
  }
  const updated = {};
  const updateableFields = ['email', 'firstName', 'lastName', 'password', 'initials', 'active', 'admin'];
  updateableFields.forEach((field) => {
    if (field in req.body) {
      updated[field] = req.body[field];
    }
  });
  if (updated.password) {
    updated.password = await User.hashPassword(req.body.password);
  }

  console.log(updated);
  User
    .findByIdAndUpdate(req.params.id, { $set: updated }, { new: true })
    .then((updatedUser) => res.status(200).json(updatedUser.serialize()))
    .catch((err) => res.status(500).json({ err, message: 'Something went wrong' }));
});


router.delete('/:id', attachBearer, jwtAuth, (req, res) => {
  User
    .findByIdAndRemove(req.params.id)
    .then(() => res.status(204).end())
    .catch((err) => {
      res.status(500).json({ err, error: 'something went terribly wrong' });
    });
});


router.use('*', (req, res) => {
  res.status(404).json({ message: 'Not Found' });
});


module.exports = router;
