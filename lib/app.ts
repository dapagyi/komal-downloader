import express = require('express');
import path from 'path';
import fs from 'fs';
import logger from './services/logger';
import komal from './komal';
import bodyparser from 'body-parser';

const env = process.env.NODE_ENV || 'development';
var envFile;
if (fs.existsSync(path.join(__dirname, `../.env.${env}`))) {
  envFile = path.join(__dirname, `../.env.${env}`);
} else {
  logger.error(`Missing environment file! You must have an .env.${env} file in root directory!`);
  throw Error('Missing environment file!');
}
require('dotenv').config({ path: envFile });

const app = express();

app.use(bodyparser.urlencoded({ extended: true }));

app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'assets', 'index.html'));
});

app.post('/', (req, res) => {
  komal(
    req.body.name,
    req.body.email,
    req.body.password,
    req.body.files.split(', ').map(file => {
      return file.split(' ');
    }),
    parseInt(req.body.date.split('-')[0]),
    parseInt(req.body.date.split('-')[1]),
    'Természeten s törvényein az éj sötétje ült.<br>Isten szólt: - Legyen Newton! - s mindenre fény derült.',
    req.body.recipents.split(', '),
    (msg: string) => {
      logger.info(msg);
    },
  )
    .then(() => {
      res.send('A kért fájlok hamarosan megérkeznek a megadott email címekre.');
    })
    .catch(e => {
      logger.warn(e.message);
      res.send(e.message);
    });
});

export default app;
