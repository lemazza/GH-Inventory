'use strict';

const mongoose = require('mongoose');
mongoose.Promise = global.Promise;


/*
 * GameInventory
 */

//setting year as Number for simplicity
const GameInventorySchema = mongoose.Schema({
  bggId: Number,
  name: {type: String, required: true},
  totalViewCount: {type: Number, default: 0},
  thumbnail: String,
  description: String,
  year: Number,
  minPlayers: Number,
  maxPlayers: Number,
  playTime: Number,
  minAge: Number,
  designer: [String],
  location: String,
})


GameInventorySchema.methods.serialize = function() {
  return {
    id: this._id,
    name: this.name,
    thumbnail: this.thumbnail,
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