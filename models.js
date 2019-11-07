'use strict';

const mongoose = require('mongoose');
mongoose.Promise = global.Promise;


/*
 * GameInventory
 */

//setting year as Number for simplicity
const GameInventorySchema = mongoose.Schema({
  bggId: {type: Number, required: true},
  name: {type: String, required: true},
  totalViewCount: {type: Number, default: 0},
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
  }
})


GameInventorySchema.methods.serialize = function() {
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
    dateAdded: this.dateAdded
  };
};


const UpdateLogSchema = mongoose.Schema({
  type: {type: String, required: true},
  date: {type: Date, required: true},
  updateObj: Object
})


const Game = mongoose.model('Game', GameInventorySchema);

const UpdateLog = mongoose.model('UpdateLog', UpdateLogSchema);

module.exports = {Game, UpdateLog};