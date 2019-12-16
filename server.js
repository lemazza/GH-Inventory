const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const request = require('request-promise-native');
const cheerio = require('cheerio');
const passport = require('passport');
const { parseString } = require('xml2js');
const schedule = require('node-schedule');
require('dotenv').config();

const { Game, UpdateLog, User } = require('./models');
const { DATABASE_URL, PORT } = require('./config');
const { checkBGGCollectionForNewGames } = require('./utils/bgg-updaters');
const { Shelves } = require('./utils/shelf-locations');
const { router: authRouter, localStrategy, jwtStrategy } = require('./auth');
const usersRouter = require('./usersRouter');

const app = express();

const job1 = schedule.scheduleJob({ hour: 2, minute: 0 }, (event) => {
  request('https://api.geekdo.com/xmlapi2/collection?username=gamehauscafe&own=1&stats=1')
    .then((body) => {
      let gamesObj;
      const newEntries = [];
      parseString(body, (err, result) => {
        gamesObj = result.items.item;

        for (const game in gamesObj) {
          const ugYear = (gamesObj[game].yearpublished && gamesObj[game].yearpublished[0])
            ? gamesObj[game].yearpublished[0] : 'n/a';

          const ugMinPlayers = (gamesObj[game].stats[0] && gamesObj[game].stats[0].$.minplayers)
            ? gamesObj[game].stats[0].$.minplayers : 'n/a';

          const ugMaxPlayers = (gamesObj[game].stats[0] && gamesObj[game].stats[0].$.maxplayers)
            ? gamesObj[game].stats[0].$.maxplayers : 'n/a';

          const ugPlayTime = (gamesObj[game].stats[0] && gamesObj[game].stats[0].$.playingtime)
            ? gamesObj[game].stats[0].$.playingtime : 'n/a';

          const ugImage = (gamesObj[game].image && gamesObj[game].image[0])
            ? gamesObj[game].image[0] : 'n/a';

          const ugLastModified = (gamesObj[game].status && gamesObj[game].status[0].$ && gamesObj[game].status[0].$.lastmodified)
            ? gamesObj[game].status[0].$.lastmodified : Date.now().toString('yyyy-MM-dd hh:mm:ss');


          const upsertGame = {
            updateOne: {
              filter: { bggId: gamesObj[game].$.objectid },
              update: {
                $set: {
                  bggId: gamesObj[game].$.objectid,
                  name: gamesObj[game].name[0]._,
                  image: ugImage,
                  year: ugYear,
                  minPlayers: ugMinPlayers,
                  maxPlayers: ugMaxPlayers,
                  playTime: ugPlayTime,
                  lastModified: ugLastModified,
                },
                $setOnInsert: {
                  dateAdded: Date.now(),
                },
              },
              upsert: true,
            },
          };

          newEntries.push(upsertGame);
        }
      });
      return newEntries;
    })
    .then((newEntries) => {
      try {
        Game
          .bulkWrite(newEntries)
          .then((successObj) => {
            try {
              UpdateLog
                .create(
                  {
                    type: 'collectionData',
                    date: Date.now(),
                    updateObj: successObj,
                  },
                );
            } catch (e) {
              console.log('updatelog error', e);
            }
          });
      } catch (e) {
        console.log('total error', e);
      }
    });
});

const job2 = schedule.scheduleJob({ hour: 2, minute: 15 }, (event) => {
  function createBulkWriteItem(item) {
    return {
      updateOne: {
        filter: { bggId: item.bggId },
        update: { $set: { ...item } },
      },
    };
  }
  // using mlab data, check for new info/ further info from bgg
  // first get data from Game, make array of id's

  Game
    .find()
    .then((gameArray) => {
      const idArray = gameArray.map((game) => Number(game.bggId));

      // break idArray into smaller chunks and then promise.all
      async function getAllBggInfo(arr, uri, chunkSize) {
        const chunks = [];
        const updateArray = [];
        let i = 0;
        const n = arr.length;

        while (i < n) {
        // request a smaller chunk of the total inventory and parse it from xml to obj
          const reqFunc = await request({ uri: uri + arr.slice(i, i += chunkSize).join(',') });
          parseString(reqFunc, (err, result) => {
            parsedRes = result.items.item;
            // iterate through chunk and create gameUpdate objects
            for (const item in parsedRes) {
              const game = parsedRes[item];
              // reduce would be faster than filter-map, but i keep getting errors
              const designerArray = game.link.filter((elem) => {
                if (elem.$ && elem.$.type == 'boardgamedesigner') {
                  return elem;
                }
              }).map((elem) => elem.$.value);

              const stats = game.statistics && game.statistics[0] && game.statistics[0].ratings && game.statistics[0].ratings[0];
              const bayesAvg = stats && stats.bayesaverage[0] && stats.bayesaverage[0].$.value;
              const rankArray = stats && stats.ranks && stats.ranks[0] && stats.ranks[0].rank;
              const gRank = rankArray && rankArray.find((g) => g.$.name === 'boardgame');


              const updateGame = {
                bggId: game.$.id,
                description: game.description ? game.description[0] : 'n/a',
                minPlayers: game.minplayers && game.minplayers[0] ? game.minplayers[0].$.value : 'n/a',
                maxPlayers: game.maxplayers && game.maxplayers[0] ? game.maxplayers[0].$.value : 'n/a',
                minAge: game.minage && game.minage[0] ? game.minage[0].$.value : 'n/a',
                designer: designerArray || [],
                bggBayesAvg: bayesAvg || 'n/a',
                bggRank: gRank.$.value || 'n/a',
              };
              updateArray.push(createBulkWriteItem(updateGame));
            }
          });
        }
        return updateArray;
      }


      async function createUpdateObjectsForDB() {
        const upArr = await getAllBggInfo(idArray, 'https://www.boardgamegeek.com/xmlapi2/thing?stats=1&id=', 400);
        try {
          Game
            .bulkWrite(upArr)
            .then((successObj) => {
              try {
                UpdateLog
                  .create(
                    {
                      type: 'updateEachGame',
                      date: Date.now(),
                      updateObj: successObj,
                    },
                  ).then((logSuccessful) => console.log(logSuccessful));
              } catch (e) {
                console.log('updatelog error', e);
              }
            });
        } catch (e) {
          console.log('total error', e);
        }
      }

      createUpdateObjectsForDB();
    });
});

app.use(morgan('common'));
app.use(bodyParser.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Authorization, Content-Type, Accept');
  res.header('Access-Control-Allow-Credentials', true);
  next();
});

passport.use(localStrategy);
passport.use(jwtStrategy);
const jwtAuth = passport.authenticate('jwt', { session: false });
app.use('/auth', authRouter);
app.use('/users', usersRouter);

app.get('/', (req, res, next) => {
  const list = ['Hi', 'Hello', 'Bonjour', 'Hey', 'Buenas Dias'];

  res.send(list);
});


app.get('/update-all-db', jwtAuth, (req, res, next) => {
  function createBulkWriteItem(item) {
    return {
      updateOne: {
        filter: { bggId: item.bggId },
        update: { $set: { ...item } },
      },
    };
  }
  // using mlab data, check for new info/ further info from bgg
  // first get data from Game, make array of id's

  Game
    .find()
    .then((gameArray) => {
      const idArray = gameArray.map((game) => Number(game.bggId));

      // break idArray into smaller chunks and then promise.all
      async function getAllBggInfo(arr, uri, chunkSize) {
        const chunks = [];
        const updateArray = [];
        let i = 0;
        const n = arr.length;

        while (i < n) {
        // request a smaller chunk of the total inventory and parse it from xml to obj
          const reqFunc = await request({ uri: uri + arr.slice(i, i += chunkSize).join(',') });
          parseString(reqFunc, (err, result) => {
            parsedRes = result.items.item;
            // iterate through chunk and create gameUpdate objects
            for (const item in parsedRes) {
              const game = parsedRes[item];
              // reduce would be faster than filter-map, but i keep getting errors
              const designerArray = game.link.filter((elem) => {
                if (elem.$ && elem.$.type == 'boardgamedesigner') {
                  return elem;
                }
              }).map((elem) => elem.$.value);

              const stats = game.statistics && game.statistics[0] && game.statistics[0].ratings && game.statistics[0].ratings[0];
              const bayesAvg = stats && stats.bayesaverage[0] && stats.bayesaverage[0].$.value;
              const rankArray = stats && stats.ranks && stats.ranks[0] && stats.ranks[0].rank;
              const gRank = rankArray && rankArray.find((g) => g.$.name === 'boardgame');


              const updateGame = {
                bggId: game.$.id,
                description: game.description ? game.description[0] : 'n/a',
                minPlayers: game.minplayers && game.minplayers[0] ? game.minplayers[0].$.value : 'n/a',
                maxPlayers: game.maxplayers && game.maxplayers[0] ? game.maxplayers[0].$.value : 'n/a',
                minAge: game.minage && game.minage[0] ? game.minage[0].$.value : 'n/a',
                designer: designerArray || [],
                bggBayesAvg: bayesAvg || 'n/a',
                bggRank: gRank.$.value || 'n/a',
              };
              updateArray.push(createBulkWriteItem(updateGame));
            }
          });
        }
        return updateArray;
      }


      async function createUpdateObjectsForDB() {
        const upArr = await getAllBggInfo(idArray, 'https://www.boardgamegeek.com/xmlapi2/thing?stats=1&id=', 400);
        try {
          Game
            .bulkWrite(upArr)
            .then((successObj) => res.json(successObj));
        } catch (e) {
          res.status(500).send(e);
        }
      }

      createUpdateObjectsForDB();
    });
});


app.get('/add-dates', jwtAuth, (req, res, next) => {
  // use Cheerio and Request-promise to scrape date and bggId, then update DB
  // request settings, setup with the page to scrape and cheerio settings
  const bggPermaLink = 'https://boardgamegeek.com/collection/user/GameHausCafe?rankobjecttype=subtype&rankobjectid=1&columns=title%7Cstatus%7Cversion%7Cpostdate%7Crating%7Cbggrating%7Cplays%7Ccomment%7Ccommands&geekranks=%0A%09%09%09%09%09%09%09%09%09Board%20Game%20Rank%0A%09%09%09%09%09%09%09%09&own=1&objecttype=thing&ff=1&subtype=boardgame';
  const bggPermaLink2 = 'https://boardgamegeek.com/collection/user/GameHausCafe?rankobjecttype=subtype&rankobjectid=1&columns=title%7Cstatus%7Cversion%7Cpostdate%7Crating%7Cbggrating%7Cplays%7Ccomment%7Ccommands&geekranks=%0A%09%09%09%09%09%09%09%09%09Board%20Game%20Rank%0A%09%09%09%09%09%09%09%09&own=1&objecttype=thing&ff=1&pageID=2&subtype=boardgame';
  const bggPermaLink3 = 'https://boardgamegeek.com/collection/user/GameHausCafe?rankobjecttype=subtype&rankobjectid=1&columns=title%7Cstatus%7Cversion%7Cpostdate%7Crating%7Cbggrating%7Cplays%7Ccomment%7Ccommands&geekranks=%0A%09%09%09%09%09%09%09%09%09Board%20Game%20Rank%0A%09%09%09%09%09%09%09%09&own=1&objecttype=thing&ff=1&pageID=3&subtype=boardgame';
  const bggPermaLink4 = 'https://boardgamegeek.com/collection/user/GameHausCafe?rankobjecttype=subtype&rankobjectid=1&columns=title%7Cstatus%7Cversion%7Cpostdate%7Crating%7Cbggrating%7Cplays%7Ccomment%7Ccommands&geekranks=%0A%09%09%09%09%09%09%09%09%09Board%20Game%20Rank%0A%09%09%09%09%09%09%09%09&own=1&objecttype=thing&ff=1&pageID=4&subtype=boardgame';
  const bggPermaLink5 = 'https://boardgamegeek.com/collection/user/GameHausCafe?rankobjecttype=subtype&rankobjectid=1&columns=title%7Cstatus%7Cversion%7Cpostdate%7Crating%7Cbggrating%7Cplays%7Ccomment%7Ccommands&geekranks=%0A%09%09%09%09%09%09%09%09%09Board%20Game%20Rank%0A%09%09%09%09%09%09%09%09&own=1&objecttype=thing&ff=1&pageID=5&subtype=boardgame';
  const bggPermaLink6 = 'https://boardgamegeek.com/collection/user/GameHausCafe?rankobjecttype=subtype&rankobjectid=1&columns=title%7Cstatus%7Cversion%7Cpostdate%7Crating%7Cbggrating%7Cplays%7Ccomment%7Ccommands&geekranks=%0A%09%09%09%09%09%09%09%09%09Board%20Game%20Rank%0A%09%09%09%09%09%09%09%09&own=1&objecttype=thing&ff=1&pageID=6&subtype=boardgame';


  const options = {
    uri: bggPermaLink6,
    transform(body) {
      return cheerio.load(body);
    },
  };

  request(options)
    .then(($) => {
      const updateArray = $('.collection_objectname a', '.collection_table tr').map(function (index, elem) {
        // get bggId
        const hrefValue = $(this).attr('href');
        const firstIndex = (hrefValue.search('expansion') === -1) ? 11 : 20;
        const lastIndex = hrefValue.lastIndexOf('/');
        const bggId = Number(hrefValue.substring(firstIndex, lastIndex));
        // get dateAdded
        const stringDate = $(this).closest('td').siblings('.collection_postdate').text()
          .substr(4, 10);
        const dateAdded = new Date(stringDate);
        return {
          updateOne: {
            filter: { bggId },
            update: { $set: { dateAdded } },
          },
        };
      }).get();

      try {
        Game
          .bulkWrite(updateArray)
          .then((successObj) => res.json(successObj));
      } catch (e) {
        res.status(500).send(e);
      }
    })
    .catch((err) => {
      // Crawling failed or Cheerio choked...
      console.log('something went wrong', err);
    });
});


app.get('/add-locations', (req, res, next) => {
  const shelfLocations = Object.keys(Shelves);

  function randomItemFromArray(arr) {
    const randomItemIndex = Math.floor(Math.random() * arr.length);
    return arr[randomItemIndex];
  }

  function createUpdateObj(id) {
    const shelf = randomItemFromArray(shelfLocations);
    const shelfName = randomItemFromArray(Shelves[shelf]);
    return {
      updateOne: {
        filter: { bggId: id },
        update: { $set: { 'ghEdit.ghShelf': shelf, 'ghEdit.ghLocationName': shelfName } },
      },
    };
  }
  // get Id's from collection
  Game
    .find({}, { bggId: true })
    .then((idArray) => {
      const updateArray = idArray.map((item) => createUpdateObj(item.bggId));

      try {
        Game
          .bulkWrite(updateArray)
          .then((successObj) => res.json(successObj));
      } catch (e) {
        res.status(500).send(e);
      }
    });
});


app.get('/refresh-all-db', jwtAuth, (req, res, next) => {
  request('https://api.geekdo.com/xmlapi2/collection?username=gamehauscafe&own=1&stats=1')
    .then((body) => {
      let gamesObj;
      const newEntries = [];
      parseString(body, (err, result) => {
        gamesObj = result.items.item;

        for (const game in gamesObj) {
          const ugYear = (gamesObj[game].yearpublished && gamesObj[game].yearpublished[0])
            ? gamesObj[game].yearpublished[0] : 'n/a';

          const ugMinPlayers = (gamesObj[game].stats[0] && gamesObj[game].stats[0].$.minplayers)
            ? gamesObj[game].stats[0].$.minplayers : 'n/a';

          const ugMaxPlayers = (gamesObj[game].stats[0] && gamesObj[game].stats[0].$.maxplayers)
            ? gamesObj[game].stats[0].$.maxplayers : 'n/a';

          const ugPlayTime = (gamesObj[game].stats[0] && gamesObj[game].stats[0].$.playingtime)
            ? gamesObj[game].stats[0].$.playingtime : 'n/a';

          const ugImage = (gamesObj[game].image && gamesObj[game].image[0])
            ? gamesObj[game].image[0] : 'n/a';

          const ugLastModified = (gamesObj[game].status && gamesObj[game].status[0].$ && gamesObj[game].status[0].$.lastmodified)
            ? gamesObj[game].status[0].$.lastmodified : Date.now().toString('yyyy-MM-dd hh:mm:ss');


          const upsertGame = {
            updateOne: {
              filter: { bggId: gamesObj[game].$.objectid },
              update: {
                $set: {
                  bggId: gamesObj[game].$.objectid,
                  name: gamesObj[game].name[0]._,
                  image: ugImage,
                  year: ugYear,
                  minPlayers: ugMinPlayers,
                  maxPlayers: ugMaxPlayers,
                  playTime: ugPlayTime,
                  lastModified: ugLastModified,
                },
                $setOnInsert: {
                  dateAdded: Date.now(),
                },
              },
              upsert: true,
            },
          };

          newEntries.push(upsertGame);
        }
      });
      return newEntries;
    })
    .then((newEntries) => {
      Game
        .bulkWrite(newEntries)
        .then((successObj) => res.json(successObj));
    });
});


app.put('/games/:bggId', jwtAuth, (req, res, next) => {
  const updated = {};
  const updateableFields = ['ghName', 'ghImage', 'ghShelf', 'ghLocationName', 'ghComment'];
  updateableFields.forEach((field) => {
    if (field in req.body) {
      const fieldName = `ghEdit.${field}`;
      updated[fieldName] = req.body[field];
    }
  });

  Game
    .findOneAndUpdate(
      { bggId: req.params.bggId },
      { $set: updated },
      { returnNewDocument: true },
    )
    .then((doc) => {
      res.json(doc);
    });
});

app.delete('/games/:bggId', jwtAuth, (req, res, next) => {
  Game
    .findOneAndDelete({ bggId: req.params.bggId })
    .then((doc) => {
      console.log('deleted', doc);
      res.status(204).end();
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'failed to delete', err });
    });
});

// don't know why this didn't work
app.get('/remove-min-max', (req, res, next) => {
  Game
    .updateMany(
      {},
      { $unset: { minplayers: 1, maxplayers: 1 } },
    )
    .then((doc) => {
      res.json(doc);
    });
});


app.get('/games', (req, res, next) => {
  Game
    .find()
    .then((gameArray) => {
      res.json(gameArray.map((game) => game.serialize()));
    });
});


function runServer(databaseUrl, port = PORT) {
  return new Promise((resolve, reject) => {
    mongoose.connect(databaseUrl, (err) => {
      if (err) {
        return reject(err);
      }
      server = app.listen(port, () => {
        console.log(`Your app is listening on port ${port}`);
        resolve();
      })
        .on('error', (err) => {
          mongoose.disconnect();
          reject(err);
        });
    });
  });
}


function closeServer() {
  return mongoose.disconnect().then(() => new Promise((resolve, reject) => {
    console.log('Closing server');
    server.close((err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  }));
}


if (require.main === module) {
  runServer(DATABASE_URL).catch((err) => console.error(err));
}


module.exports = { runServer, app, closeServer };
