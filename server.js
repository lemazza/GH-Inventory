


















          mongoose.disconnect();
          reject(err);
          return reject(err);
        $inc: {totalPlayCount: 1},
        $inc: {totalTableCount: 1},
        $push: {playTimes: date}
        $push: {tableTimes: date}
        .on('error', err => {
        console.log(`Your app is listening on port ${port}`);
        if (err) {
        resolve();
        resolve();
        return b.playCount - a.playCount
        return b.totalCount - a.totalCount
        return reject(err);
        }
        });
      console.log('Closing server');
      if (a.totalCount === b.totalCount) {
      if (err) {
      server = http.listen(port, () => {
      server.close(err => {
      {
      {
      {"name": gameName},
      {"name": gameName},
      {upsert: true}
      {upsert: true}
      }
      }
      } else {
      })
      });
      },
      },
    ).then(gameRet => console.log(gameRet))
    ).then(gameRet => console.log(gameRet))
    .findOneAndUpdate(
    .findOneAndUpdate(
    //sort games by totalCount followed by playCount
    console.log(gameName, 'is a table game')
    const serializedGames = allGames.map(game => game.serialize());
    Game
    Game
    mongoose.connect(databaseUrl,{ useNewUrlParser: true }, err => {
    res.status(200).json(serializedGames);
    res.status(400).send(err);
    return new Promise((resolve, reject) => {
    serializedGames.sort((a, b) => {
    })
    });
    });
  * RUNSERVER
  */
  .catch(err => {
  .find()
  .then(allGames => {
  Game
  let {date, playedGames, tableGames} = req.body;
  playedGames.forEach(gameName=>{
  res.send('Hellloooo from Board Game List thing');
  res.status(201).send("posted")
  return mongoose.disconnect().then(() => {
  return new Promise((resolve, reject) => {
  runServer(DATABASE_URL).catch(err => console.error(err));
  tableGames.forEach(gameName=>{
  })
  })
  })
  })
  });
  });
 /*
app.get('/', function (req, res, next) {
app.get('/games', function (req, res, next) {
app.post('/games', function (req, res, next) {
app.use(bodyParser.json());
app.use(morgan('common'));
const app = express();
const bodyParser = require('body-parser');
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const { DATABASE_URL, PORT } = require('./config');
const {Game} = require('./models');
function closeServer() {
function runServer(databaseUrl, port = PORT) {
if (require.main === module) {
module.exports = { runServer, app, closeServer };
var http = require('http').Server(app);
}
}
}
})
})
});