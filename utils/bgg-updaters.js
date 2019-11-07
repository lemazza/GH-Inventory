'use strict';
var {parseString} = require('xml2js');
const request = require('request-promise-native');

async function checkBGGCollectionForNewGames() {
  request('https://api.geekdo.com/xmlapi2/collection?username=gamehauscafe&own=1&stats=1')
  .then(body=> {
    let gamesObj
    let newEntries = []
    parseString(body, function(err, result) {
      //parse XML for game info
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

        //create object to to updateDB, and append to list for eventual bulk write
        let upsertGame = {
          updateOne: {
            filter: {"bggId": gamesObj[game]["$"].objectid},
            update: { 
              $set: {
                bggId: gamesObj[game]["$"].objectid,
                name: gamesObj[game].name[0]["_"],
                image: ugImage,
                year: ugYear,
                minPlayers: ugMinPlayers,
                maxPlayers: ugMaxPlayers,
                playTime: ugPlayTime,
                lastModified: ugLastModified,
                },
              $setOnInsert: {
                dateAdded: Date.now()
              }
            },
            upsert: true
          }
        };

        newEntries.push(upsertGame)
      }
    })
    console.log('got here');
    console.log('first entry', newEntries[0])
    return newEntries;
  })
}



module.exports = { checkBGGCollectionForNewGames };
