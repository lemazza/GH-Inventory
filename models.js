'use strict';

const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const ObjectId = mongoose.Schema.Types.ObjectId;

/*
 * Games
 */

const GameListSchema = mongoose.Schema({
  string: {type: String, required: true},
  totalPlayCount: Number,
  totalTableCount: Number,
  playTimes: [Date],
  tableTimes: [Date]
})

const Game = mongoose.model('Movie', GameListSchema);

module.exports = {Game};