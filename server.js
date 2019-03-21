const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const {Game} = require('./models');
const config = require('./config');
const request = require('request')


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
  const list = ['Hi', 'Hello', 'Bonjour', 'Hey', 'Buenas Dias']

  console.log('about to request')

  request('https://api.geekdo.com/xmlapi2/collection?username=gamehauscafe&own=1', function (error, response, body) {
    console.log('requesting')
    console.log('error:', error); // Print the error if one occurred
    console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
    console.log('body:', body); // Print the HTML for the Google homepage.

    res.send(body);
  });

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