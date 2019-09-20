const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const {Game} = require('./models');
const config = require('./config');
const request = require('request-promise-native');
var {parseString} = require('xml2js');
const {Shelves} = require('./utils/shelf-locations');


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
  function createBulkWriteItem(item){
    return {
      updateOne: {
        filter: {"bggId": item.bggId},
        update: { $set: {...item}}
      }
    }
  }
  //using mlab data, check for new info/ further info from bgg
  //first get data from Game, make array of id's

   Game
  .find()
  .then(gameArray=> {
    let idArray = gameArray.map(game=> Number(game.bggId));

    // break idArray into smaller chunks and then promise.all
    async function getAllBggInfo(arr, uri, chunkSize) {
      const chunks = [];
      let updateArray = [];
      let i = 0;
      let n = arr.length;

      while (i<n) {
        //request a smaller chunk of the total inventory and parse it from xml to obj
        let reqFunc = await request({uri: uri + arr.slice(i, i+= chunkSize).join(',')})
        parseString(reqFunc, function(err, result) {
          parsedRes = result.items.item;
          // iterate through chunk and create gameUpdate objects
          for( var item in parsedRes) {
            let game = parsedRes[item];
            // reduce would be faster than filter-map, but i keep getting errors
            let designerArray = game.link.filter(elem => {
              if( elem["$"] && elem["$"].type == "boardgamedesigner") {
                return elem
              } 
            }).map( elem => elem["$"].value)

            let stats = game.statistics && game.statistics[0] && game.statistics[0].ratings && game.statistics[0].ratings[0]
            let bayesAvg = stats && stats.bayesaverage[0] && stats.bayesaverage[0]["$"].value;
            let rankArray = stats && stats.ranks && stats.ranks[0] && stats.ranks[0].rank;
            let gRank = rankArray && rankArray.find(g => g["$"].name === "boardgame");


            let updateGame = {
              bggId: game["$"].id,
              description: game.description? game.description[0] : 'n/a',
              minPlayers: game.minplayers && game.minplayers[0] ? game.minplayers[0]["$"].value : 'n/a',
              maxPlayers: game.maxplayers && game.maxplayers[0] ? game.maxplayers[0]["$"].value : 'n/a',
              minAge: game.minage && game.minage[0] ? game.minage[0]["$"].value : 'n/a',
              designer: designerArray || [],
              bggBayesAvg: bayesAvg || 'n/a',
              bggRank: gRank["$"].value || 'n/a'
            }
            updateArray.push(createBulkWriteItem(updateGame));
          }
        })
      }
      return updateArray;
    };


    async function createUpdateObjectsForDB() {
      const upArr = await getAllBggInfo(idArray, "https://www.boardgamegeek.com/xmlapi2/thing?stats=1&id=", 400);
      try{
        Game
        .bulkWrite(upArr)
        .then(successObj => res.json(successObj))
      } catch(e){
        res.error(e);
      }
    }

    createUpdateObjectsForDB();
  })
});




app.get('/add-locations', function(req, res, next) {
  const shelfLocations = Object.keys(Shelves);

  function randomItemFromArray(arr) {
    const randomItemIndex = Math.floor(Math.random() * arr.length);
    return arr[randomItemIndex]
  }

  function createUpdateObj (id) {
    let shelf = randomItemFromArray(shelfLocations)
    let shelfName = randomItemFromArray(Shelves[shelf])
    return {
      updateOne: {
        filter: {"bggId": id},
        update: { $set: {"ghEdit.ghShelf": shelf, "ghEdit.ghLocationName": shelfName}
        }
      } 
    }
  }
  // get Id's from collection
  Game
  .find({}, {bggId: true})
  .then(idArray=> {
    const updateArray = idArray.map(item => createUpdateObj(item.bggId));

    try {
      Game
      .bulkWrite(updateArray)
      .then(successObj=> res.json(successObj))
    } catch(e) {
    res.error(e);
    } 
  }) 
})




app.get('/refresh-all-db', function(req, res, next) {
  request('https://api.geekdo.com/xmlapi2/collection?username=gamehauscafe&own=1&stats=1')
  .then(body=> {
    let gamesObj
    let newEntries = []
    parseString(body, function(err, result) {
      gamesObj = result.items.item;

      for( var game in gamesObj) {
        let ugYear = (gamesObj[game].yearpublished && gamesObj[game].yearpublished[0])
          ? gamesObj[game].yearpublished[0] : 'n/a';
        
        let ugMinPlayers = (gamesObj[game].stats[0] && gamesObj[game].stats[0]["$"].minplayers)
          ? gamesObj[game].stats[0]["$"].minplayers : 'n/a';

        let ugMaxPlayers = (gamesObj[game].stats[0] && gamesObj[game].stats[0]["$"].maxplayers)
          ? gamesObj[game].stats[0]["$"].maxplayers : 'n/a';

        let ugPlayTime = (gamesObj[game].stats[0] && gamesObj[game].stats[0]["$"].playingtime)
          ? gamesObj[game].stats[0]["$"].playingtime : 'n/a';

        let ugImage = (gamesObj[game].image && gamesObj[game].image[0]) 
          ? gamesObj[game].image[0] : 'n/a';

        let ugLastModified = (gamesObj[game].status && gamesObj[game].status[0]["$"] && gamesObj[game].status[0]["$"].lastmodified)
          ? gamesObj[game].status[0]["$"].lastmodified : Date.now().toString("yyyy-MM-dd hh:mm:ss");


        let upsertGame = {
          updateOne: {
            filter: {"bggId": gamesObj[game]["$"].objectid},
            update: { $set: {
              bggId: gamesObj[game]["$"].objectid,
              name: gamesObj[game].name[0]["_"],
              image: ugImage,
              year: ugYear,
              minPlayers: ugMinPlayers,
              maxPlayers: ugMaxPlayers,
              playTime: ugPlayTime,
              lastModified: ugLastModified,
              }
            },
            upsert: true
          }
        };

        newEntries.push(upsertGame)
      }
    })
    return newEntries;
  })
  .then(newEntries => {
    Game
    .bulkWrite(newEntries)
    .then(successObj=> res.json(successObj))
  })
})

app.put('/games/:bggId', function(req, res, next) {
  const {ghName, ghImage, ghLocation} = req.body;

  const updated = {};
  const updateableFields = ['ghName', 'ghImage', 'ghLocation'];
  updateableFields.forEach(field => {
    if (field in req.body) {
      const fieldName = 'ghEdit.' + field;
      updated[fieldName] = req.body[field];
    }
  });

  Game
  .findOneAndUpdate(
    {"bggId": req.params.bggId},
    {$set: updated},
    {returnNewDocument: true}
  )
  .then(doc=> {
    res.json(doc);
  })
})

app.delete('/games/:bggId', function (req, res, next) {
  Game
  .findOneAndDelete({"bggId": req.params.bggId})
  .then(doc => {
    console.log('deleted', doc);
    res.status(204).end();
  })
  .catch(err => {
    console.error(err);
    res.status(500).json({ error: 'failed to delete', err});
  });
});

//don't know why this didn't work
app.get('/remove-min-max', function(req, res, next) {
  Game
  .updateMany(
    {}, 
    {$unset: {minplayers: 1, maxplayers: 1}}, 
  )
  .then(doc=> {
    res.json(doc);
  })
})


app.get('/games', function(req, res, next) {
  console.log('/games endpoint hit');
  Game
  .find()
  .then(gameArray=> {
    console.log(gameArray);
    res.json(gameArray.map(game=>game.serialize()));
  })
})








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