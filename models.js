const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

mongoose.Promise = global.Promise;
/*
 * GameInventory
 */
// setting year as Number for simplicity
const GameInventorySchema = mongoose.Schema({
  bggId: { type: Number, required: true },
  name: { type: String, required: true },
  totalViewCount: { type: Number, default: 0 },
  image: String,
  description: String,
  year: String,
  minPlayers: String,
  maxPlayers: String,
  playTime: String,
  minAge: String,
  designer: [String],
  bggRank: String,
  bggBayesAvg: String,
  lastModified: Date,
  dateAdded: Date,
  ghEdit: {
    ghName: String,
    ghImage: String,
    ghShelf: String,
    ghLocationName: String,
    ghComment: String,
  },
});


GameInventorySchema.methods.serialize = function serialize() {
  return {
    bggId: this.bggId,
    name: this.name,
    image: this.image,
    description: this.description,
    year: this.year,
    minPlayers: this.minPlayers,
    maxPlayers: this.maxPlayers,
    playTime: this.playTime,
    minAge: this.minAge,
    designer: this.designer,
    bggBayesAvg: this.bggBayesAvg,
    lastModified: this.lastModified,
    shelf: this.ghEdit.ghShelf,
    locationName: this.ghEdit.ghLocationName,
    dateAdded: this.dateAdded,
  };
};

/*
 * Update Log
 */

const UpdateLogSchema = mongoose.Schema({
  type: { type: String, required: true },
  date: { type: Date, required: true },
  updateObj: Object,
});

/*
 * Users
 */

const UserSchema = mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String },
  initials: {
    type: String, required: true, unique: true, minlength: 2, maxlength: 3,
  },
  active: Boolean,
  admin: Boolean,
});

UserSchema.methods.serialize = function serialize() {
  return {
    id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    email: this.email,
    initials: this.initials,
    active: this.active,
    admin: this.admin,
  };
};


UserSchema.methods.validatePassword = function validatePassword(password) {
  return bcrypt.compare(password, this.password);
};

UserSchema.statics.hashPassword = (password) => bcrypt.hash(password, 10);


const Game = mongoose.model('Game', GameInventorySchema);
const User = mongoose.model('User', UserSchema);
const UpdateLog = mongoose.model('UpdateLog', UpdateLogSchema);

module.exports = { Game, UpdateLog, User };
