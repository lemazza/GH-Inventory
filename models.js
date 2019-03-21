'use strict';

const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const ObjectId = mongoose.Schema.Types.ObjectId;

/*
 * Games
 */

const GameListSchema = mongoose.Schema({
  name: {type: String, required: true},
  totalPlayCount: {type: Number, default: 0},
  totalTableCount: {type: Number, default: 0},
  playTimes: [Date],
  tableTimes: [Date]
})

GameListSchema.virtual('totalCount').get( function() {
  return (this.totalPlayCount || 0) + (this.totalTableCount || 0);
})


GameListSchema.methods.serialize = function() {
  return {
    id: this._id,
    name: this.name,
    totalCount: this.totalCount,
    playCount: this.totalPlayCount,
    tableCount: this.totalTableCount
  };
};



const Game = mongoose.model('Game', GameListSchema);

module.exports = {Game};