const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const {Game} = require('./models');
const config = require('./config');
const request = require('request-promise-native');
var {parseString} = require('xml2js');


const { DATABASE_URL, PORT } = require('./config');

const app = express();
var http = require('http').Server(app);

app.use(morgan('common'));
app.use(bodyParser.json());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", '*');
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Authorization, Content-Type, Accept");
  res.header("Access-Control-Allow-Credentials", true);
  next();
});




app.get('/', function (req, res, next) {
  const list = ['Hi', 'Hello', 'Bonjour', 'Hey', 'Buenas Dias']

  res.send(list);
});




app.get('/check-collection/', function (req, res, next) {
  // get game Id's from user collection
  let gamesObj
  let newEntries = []
  request('https://api.geekdo.com/xmlapi2/collection?username=gamehauscafe&own=1&stats=1')
  .then(body=> {
    const idArray = [];
    parseString(body, function(err, result) {
      gamesObj = result.items.item;
      for( var game in gamesObj) {
        idArray.push(gamesObj[game]["$"].objectid)
        

        let ngYear = (gamesObj[game].yearpublished && gamesObj[game].yearpublished[0])
          ? gamesObj[game].yearpublished[0] : 'n/a';
        
        let ngMinPlayers = (gamesObj[game].stats[0] && gamesObj[game].stats[0]["$"].minplayers)
          ? gamesObj[game].stats[0]["$"].minplayers : 'n/a';

        let ngMaxPlayers = (gamesObj[game].stats[0] && gamesObj[game].stats[0]["$"].maxplayers)
          ? gamesObj[game].stats[0]["$"].maxplayers : 'n/a';

        let ngPlayTime = (gamesObj[game].stats[0] && gamesObj[game].stats[0]["$"].playingtime)
          ? gamesObj[game].stats[0]["$"].playingtime : 'n/a';


        let newGame = {
          bggId: gamesObj[game]["$"].objectid,
          name: gamesObj[game].name[0]["_"],
          image: gamesObj[game].image[0],
          year: ngYear,
          minplayers: ngMinPlayers,
          maxplayers: ngMaxPlayers,
          playTime: ngPlayTime,
        }

        newEntries.push(newGame)
      }
    })
    return idArray;
  })
  .then(idArray => {
    // use Id's to get full game data for each item
   

        /*Game
        .insertMany(newEntries)
        .then(insResult =>
          res.send(insResult)
        ).catch(err=>
          res.status(500).send(err)
        )*/
  })
});




app.get('/update-all-db', function(req, res, next) {
  //using mlab data, check for new info/ further info from bgg

  //first get data from Game, make array of id's
  let updateArray = [];

   Game
  .find()
  .then(gameArray=> {
    let idArray = gameArray.map(game=> Number(game.bggId));

    let testArray = idArray.slice(0,3);
    const gameRequestOptions = {
      uri: `https://www.boardgamegeek.com/xmlapi2/thing?id=` + testArray.join(','),
    }

    request(gameRequestOptions)
    .then(body => {
      parseString(body, function(err, result) {
        console.log('error', err);

        parsedRes = result.items.item;

        for( var item in parsedRes) {
          let game = parsedRes[item];

          let updateGame = {
            bggId: game["$"] && game["$"].id ? game["$"].id : 'n/a',
            description: game.description? game.description[0] : 'n/a',
            minPlayers: game.minplayers && game.minplayers[0] ? game.minplayers[0]["$"].value : 'n/a',
            maxPlayers: game.maxplayers && game.maxplayers[0] ? game.maxplayers[0]["$"].value : 'n/a',
            minAge: game.minage && game.minage[0] ? game.minage[0]["$"].value : 'n/a',
          }
          updateArray.push(updateGame);
        } 

        res.send(updateArray);
      })
    })
  //then call bgg thing info progromattically (600 at a time?)

  //update each entry with new info
  })
});













function runServer(databaseUrl, port = PORT) {
  return new Promise((resolve, reject) => {
    mongoose.connect(databaseUrl, err => {
      if (err) {
        return reject(err);
      }
      server = http.listen(port, () => {
        console.log(`Your app is listening on port ${port}`);
        resolve();
      })
        .on('error', err => {
          mongoose.disconnect();
          reject(err);
        });
    });
  });
}


function closeServer() {
  return mongoose.disconnect().then(() => {
    return new Promise((resolve, reject) => {
      console.log('Closing server');
      server.close(err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  });
}


if (require.main === module) {
  runServer(DATABASE_URL).catch(err => console.error(err));
}


module.exports = { runServer, app, closeServer };