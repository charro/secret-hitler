'use strict';
module.exports = function(app) {
  var commands = require('../controllers/commandsController');

  // commands Routes
  app.route('/match')
    .post(commands.create_match)

  app.route('/match/:matchId')
    .get(commands.info)
    .post(commands.send_command)
    .put(commands.update_match);

};