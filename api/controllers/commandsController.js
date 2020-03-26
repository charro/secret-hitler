uuid = require('uuid')
fs = require('fs');

MIN_PLAYERS = 4;
MAX_PLAYERS = 6;

// MATCH STATUS
MATCHMAKING = 'MATCHMAKE';
ONGOING = 'ONGOING';
FINISHED = 'FINISHED';

// GAME STAGES
PROPOSING_CHANCELOR = 'PROPOSING_CHANCELOR';
VOTING_CHANCELOR = 'VOTING_CHANCELOR';
PRESIDENT_DISCARD = 'PRESIDENT_DISCARD';
CHANCELOR_DISCARD = 'CHANCELOR_DISCARD';

// Create a new match and return its ID
exports.create_match = function(req, res) {

    let new_match = {   id : uuid.v4(),
                        status : MATCHMAKING,
                        players : [{
                                name: req.body.player,
                                pass: req.body.pass,
                                role: '',
                                charge: '',
                                creator: true
                            }],
                        game_state : {
                            round : 0,
                            stage : '',
                            votes : {},
                            policy_cards: []
                        },
                        last_voting : {}
                    };

    store_match(new_match.id, new_match);

    res.json(new_match);
};

exports.join_match =  function(req, res) {
    let matchId = req.params.matchId;
    let player_name = req.body.player;
    let player_pass = req.body.pass;
    let match = get_match(matchId);

    if(match.status !== MATCHMAKING){
        res.status(403).send("Match already started");
        return;
    }

    if(match.players.length >= MAX_PLAYERS){
        res.status(403).send("Match is Full");
        return;
    }

    let existing_player_with_name = get_player(match, player_name);
    if(existing_player_with_name.length > 0){
        res.status(403).send("Duplicated player name");
        return;
    }

    let new_player = {
        name: player_name,
        pass: player_pass,
        role: '',
        charge: '',
        creator: false
    };

    match.players.push(new_player);
    store_match(matchId, match);
    res.send("OK");
}

exports.start_match = function(req, res) {

    let matchId = req.params.matchId;
    let player_name = req.body.player;
    let match = get_match(matchId);

    if(correct_player_credentials(match, req)){
        let player = get_player(match, player_name);
        if(!player.creator){
            res.status(401).send("Only match creator can start the match");
            return;
        }
        else{
            if(match.players.length < MIN_PLAYERS){
                res.status(403).send("You need at least " + MIN_PLAYERS + " to start");
                return;
            }
            else{
                match.status = ONGOING;
                match.game_state.stage = PROPOSING_CHANCELOR;
                match.game_state.round = 1;
                store_match(matchId, match);
                res.send("OK");
            } 
        }
    }
}

exports.match_info = function(req, res) {
    let matchId = req.params.matchId;
    let match = get_match(matchId);
    res.json(match);
};

exports.vote = function(req, res) {
    let matchId = req.params.matchId;
    let player_name = req.body.player;
    let match = get_match(matchId);

    if(correct_player_credentials(match, req)){
        let vote = req.params.vote.toLowerCase();
        if(vote !== 'ja' && vote !== 'nein'){
            res.send("Error: Incorrect vote. Only 'ja' or 'nein' allowed");
            return;
        }

        let player = get_player(match, player_name);
        let game_state = match.game_state;
        
        game_state.votes[player.name] = vote;
        store_match(matchId, match);
        res.send("OK");
    }
    else{
        res.status(401).send("Error: Wrong player credentials");
        return;
    }
};

exports.propose = function(req, res) {
    
};

exports.discard = function(req, res) {
    
};

// PRIVATE FUNCTIONS
function correct_player_credentials(match, req){
    if(!req.body || !req.body.player || !req.body.pass){
        return false;
    }

    let player_name = req.body.player;
    let player_pass = req.body.pass;

    let player = get_player(match, player_name);
    return (player.pass === player_pass);
}

function get_player(match, player_name){
    return match.players.filter(p => p.name === player_name)[0];
}

function store_match(matchId, content){
    fs.writeFileSync('matches/' + matchId + '.match', JSON.stringify(content));
}

function get_match(matchId){
    return JSON.parse(fs.readFileSync('matches/' + matchId + '.match', 'utf8'));
}