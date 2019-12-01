import app from './app';
import logger from './services/logger';
const PORT = process.env.PORT || 3000;

app.listen(PORT, function() {
  logger.info(`KoMaL app listening on port ${PORT}!`);
});
