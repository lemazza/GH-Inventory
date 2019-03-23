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




app.get('/update/', function (req, res, next) {
  // get game Id's from user collection
  request('https://api.geekdo.com/xmlapi2/collection?username=gamehauscafe&own=1')
  .then(body=> {
    const idArray = [];
    parseString(body, function(err, result) {
      let gamesObj = result.items.item;
      for( var game in gamesObj) {
        idArray.push(gamesObj[game]["$"].objectid)
      }
    })
    return idArray;
  })
  .then(idArray => {
    // use Id's to get full game data for each item
    let requestPath = 'https://api.geekdo.com/xmlapi2/thing?id=' + idArray.join(',')
    request(requestPath)
    .then(body => {
      parseString(body, function(err, result) {
        console.dir(result);
        res.send(result)
      })  
    })
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