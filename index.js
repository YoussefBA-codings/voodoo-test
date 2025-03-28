const express = require('express');
const bodyParser = require('body-parser');
const Sequelize = require('sequelize');
const db = require('./models');

const app = express();

app.use(bodyParser.json());
app.use(express.static(`${__dirname}/static`));

const { Op } = Sequelize;

const top100gamesUrl = (brand) => `https://interview-marketing-eng-dev.s3.eu-west-1.amazonaws.com/${brand}.top100.json`;

const getAllGames = (res) => db.Game.findAll()
  .then(games => res.send(games))
  .catch((err) => {
    console.log('There was an error querying games', JSON.stringify(err));
    return res.send(err);
  });

app.get('/api/games', (req, res) => getAllGames(res));

app.post('/api/games', (req, res) => {
  const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
  return db.Game.create({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
    .then(game => res.send(game))
    .catch((err) => {
      console.log('***There was an error creating a game', JSON.stringify(err));
      return res.status(400).send(err);
    });
});

app.post('/api/games/search', (req, res) => {
  const { name, platform } = req.body;

  if (!name && !platform) {
    return getAllGames(res);
  }

  const where = {
    name: {
      [Op.like]: `%${name}%`,
    },
  };

  if (platform) {
    where.platform = platform;
  }

  return db.Game.findAll({ where })
    .then(games => res.send(games))
    .catch((err) => {
      console.log(
        `There was an error querying games with name ${name} in ${platform ? 'platform' : 'all platforms'}`,
        JSON.stringify(err),
      );
      return res.send(err);
    });
});

app.delete('/api/games/:id', (req, res) => {
  // eslint-disable-next-line radix
  const id = parseInt(req.params.id);
  return db.Game.findByPk(id)
    .then(game => game.destroy({ force: true }))
    .then(() => res.send({ id }))
    .catch((err) => {
      console.log('***Error deleting game', JSON.stringify(err));
      res.status(400).send(err);
    });
});

app.put('/api/games/:id', (req, res) => {
  // eslint-disable-next-line radix
  const id = parseInt(req.params.id);
  return db.Game.findByPk(id)
    .then((game) => {
      const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
      return game.update({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
        .then(() => res.send(game))
        .catch((err) => {
          console.log('***Error updating game', JSON.stringify(err));
          res.status(400).send(err);
        });
    });
});

app.post('/api/games/populate', async (req, res) => {
  const [top100android, top100ios] = await Promise.all([
    fetch(top100gamesUrl('android')).then((response) => response.json()),
    fetch(top100gamesUrl('ios')).then((response) => response.json()),
  ]);

  const mappedTop100Games = [...(top100android).flat(), ...(top100ios).flat()].map((game) => ({
    publisherId: game.publisherId,
    name: game.name,
    platform: game.os,
    storeId: game.appId,
    bundleId: game.bundle_id,
    appVersion: game.version,
    isPublished: true,
  }));

  await db.Game.bulkCreate(mappedTop100Games)
    .catch((err) => {
      console.log('Error populating db with top 100 games in all platforms', JSON.stringify(err));
      return res.status(400).send(err);
    });

  return res.send('ok');
});

app.listen(3000, () => {
  console.log('Server is up on port 3000');
});

module.exports = app;
