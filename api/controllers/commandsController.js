uuid = require('uuid')
fs = require('fs');

// Create a new match and return its ID
exports.create_match = function(req, res) {
    let match_data = req.body;

    let new_match = {   "id" : uuid.v4(),
                        "name" : match_data.name };

    write_match_file(new_match.id, new_match);

    res.json(new_match);
};

exports.info = function(req, res) {
    let matchId = req.params.matchId;
    res.json(read_match_file(matchId));
};

exports.send_command = function(req, res) {
    
};

exports.update_match = function(req, res) {
    
};

function write_match_file(name, content){
    fs.writeFileSync(name + '.match', JSON.stringify(content));
}

function read_match_file(name){
    return fs.readFileSync(name + '.match', 'utf8');
}