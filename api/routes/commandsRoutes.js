'use strict';
module.exports = function(app) {
  var commands = require('../controllers/commandsController');

  // Create new match
  app.route('/match')
    .post(commands.create_match)

  // Get the match info
  app.route('/match/:matchId')
    .get(commands.match_info)

  // Start match if enough players (only creator)
  app.route('/match/:matchId/start')
    .post(commands.start_match)

  // Join match
  app.route('/match/:matchId/join')  
  .post(commands.join_match)

  // Send vote
  app.route('/match/:matchId/vote/:vote')  
    .post(commands.vote)

  // Propose chancelor (only president)
  app.route('/match/:matchId/propose/:chancelor')  
    .post(commands.propose)
  
  // Discard policy (only president or chancelor)
  app.route('/match/:matchId/discard/:policy')
  .post(commands.discard)

};