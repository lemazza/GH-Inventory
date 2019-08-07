
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
  location: String,
  bggRank: String,
  bggBayesAvg: String,
  lastModified: Date,
  ghEdit: {
    ghName: String,
    ghImage: String,
    ghLocation: String,
  }
})


GameInventorySchema.methods.serialize = function() {
  return {
    id: this._id,
    name: this.name,
    image: this.image,
    description: this.description,
    year: this.year,
    minPlayers: this.minPlayers,
    maxPlayers: this.maxPlayers,
    playTime: this.playTime,
    minAge: this.minAge,
    designer: this.designer,
    location: this.location
  };
};



const Game = mongoose.model('Game', GameInventorySchema);

module.exports = {Game};