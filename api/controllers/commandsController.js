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
LIBERALS_WON = 'LIBERALS_WON';
FASCISTS_WON = 'FASCISTS_WON';

// ROLES
LIBERAL = 'LIBERAL';
FASCIST = 'FASCIST';
HITLER = 'HITLER';

// CHARGES
PRESIDENT = 'PRESIDENT';
CHANCELOR = 'CHANCELOR';

// [LIBERALS, FASCISTS, HITLERS]
let ROLE_SHARE_FOR_PLAYER_NUM = {
    4 : [LIBERAL,LIBERAL,FASCIST,HITLER],
    5 : [LIBERAL,LIBERAL,LIBERAL,FASCIST,HITLER],
    6 : [LIBERAL,LIBERAL,LIBERAL,LIBERAL,FASCIST,HITLER],
    7 : [LIBERAL,LIBERAL,LIBERAL,LIBERAL,FASCIST,FASCIST,HITLER],
    8 : [LIBERAL,LIBERAL,LIBERAL,LIBERAL,LIBERAL,FASCIST,FASCIST,HITLER],
    9 : [LIBERAL,LIBERAL,LIBERAL,LIBERAL,LIBERAL,FASCIST,FASCIST,FASCIST,HITLER],
    10: [LIBERAL,LIBERAL,LIBERAL,LIBERAL,LIBERAL,LIBERAL,FASCIST,FASCIST,FASCIST,HITLER]
}


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
                            chancelor_proposed: '',
                            votes : {},
                            policy_cards: []
                        },
                        last_voting : {},
                        liberal_policies_approved : 0,
                        fascist_policies_approved : 0

                    };

    store_match(new_match.id, new_match);

    res.json(new_match);
};

exports.join_match =  function(req, res) {
    let matchId = req.params.matchId;
    if(!match_exists(matchId)){ 
        res.status(404).send("No match with id " + matchId + " was found"); 
        return;
    }
    let player_name = req.body.player;
    let player_pass = req.body.pass;

    let match = get_match(matchId);

    if(match.status !== MATCHMAKING){
        res.status(403).send("ERROR: Match already started");
        return;
    }

    if(match.players.length >= MAX_PLAYERS){
        res.status(403).send("ERROR: Match is Full");
        return;
    }

    let existing_player_with_name = get_player(match, player_name);
    if(existing_player_with_name){
        res.status(403).send("ERROR: Duplicated player name");
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
    if(!match_exists(matchId)){ 
        res.status(404).send("No match with id " + matchId + " was found"); 
        return;
    }
    let match = get_match(matchId);

    if(are_correct_player_credentials(match, req)){
        let player = get_player(match, player_name);
        if(!player.creator){
            res.status(401).send("Only match creator can start the match");
            return;
        };
        
        if(match.players.length < MIN_PLAYERS){
            res.status(403).send("You need at least " + MIN_PLAYERS + " players to start");
            return;
        };
        
        if(match.status !== MATCHMAKING){
            res.status(403).send("The match is already started.");
            return;
        };

        setup_match(match);
        store_match(matchId, match);
        res.send("OK"); 
    }
    else{
        res.status(401).send("Error: Wrong player credentials");
        return;
    }}

exports.match_info = function(req, res) {
    let matchId = req.params.matchId;
    let player_name = req.body.player;
    if(!match_exists(matchId)){ 
        res.status(404).send("No match with id " + matchId + " was found"); 
        return;
    }
    let match = get_match(matchId);

    if(are_correct_player_credentials(match, req)){
        // Hide info you should't see
        match.players.forEach(p => delete p.pass);
        
        if(match.status !== FINISHED){
            let player = get_player(match, player_name);
            match.your_role=player.role;
            
            if(player.role === LIBERAL){
                let players = match.players;
                players.forEach(p => p.role = "HIDDEN");
            }
            if(!is_my_turn_to_discard(match, player)){
                let cards = match.game_state.policy_cards;
                match.game_state.policy_cards = cards.map(p => "HIDDEN"); 
            }
            Object.keys(match.game_state.votes).map(function(key, index) {
                match.game_state.votes[key] = "HIDDEN";
              });
        }    
    }
    else{
        res.status(401).send("Error: Wrong player credentials");
        return;
    }

    res.json(match);
};

exports.vote = function(req, res) {
    let matchId = req.params.matchId;
    let player_name = req.body.player;
    if(!match_exists(matchId)){ 
        res.status(404).send("No match with id " + matchId + " was found"); 
        return;
    }
    let match = get_match(matchId);

    if(are_correct_player_credentials(match, req)){
        if(match.game_state.stage !== VOTING_CHANCELOR){
            res.status(401).send("Error: There isn't any current voting in progress");
            return;
        }

        let vote = req.params.vote.toLowerCase();
        if(vote !== 'ja' && vote !== 'nein'){
            res.send("Error: Incorrect vote. Only 'ja' or 'nein' allowed");
            return;
        }

        let player = get_player(match, player_name);
        let game_state = match.game_state;
        
        game_state.votes[player.name] = vote;

        // If voting is completed, apply the consequences
        if(Object.keys(game_state.votes).length === match.players.length){
            let jaCount = 0;
            let neinCount = 0;
            let votes = game_state.votes;
            let vote_keys = Object.keys(votes);                
            vote_keys.forEach(k => {
                let vote = votes[k];
                if(vote === "ja"){
                    jaCount++;
                }
                else{
                    neinCount++;
                }
            });

            // Voting succeded
            if(jaCount > neinCount){
                match.game_state.stage = PRESIDENT_DISCARD;
                let new_chancelor_name = match.game_state.chancelor_proposed;
                let new_chancelor_player = get_player(match, new_chancelor_name);
                new_chancelor_player.charge = CHANCELOR;
            }
            // Voting Failed
            else{
                match.game_state.stage = PROPOSING_CHANCELOR;
                set_next_president(match);
            }

            match.last_voting = { proposed_chancelor: match.game_state.chancelor_proposed,
                votes: votes };
            match.game_state.chancelor_proposed = "";
            match.game_state.votes = {};
        }

        store_match(matchId, match);
        res.send("OK");
    }
    else{
        res.status(401).send("Error: Wrong player credentials");
        return;
    }
};

exports.propose_chancelor = function(req, res) {
    let matchId = req.params.matchId;
    let player_name = req.body.player;
    if(!match_exists(matchId)){ 
        res.status(404).send("No match with id " + matchId + " was found"); 
        return;
    }
    let match = get_match(matchId);

    if(are_correct_player_credentials(match, req)){
        let player = get_player(match, player_name);
        if(match.game_state.stage !== PROPOSING_CHANCELOR){
            res.status(401).send("Error: Not in proposing Chancelor stage");
            return;
        }

        if(match.game_state.chancelor_proposed){
            res.status(401).send("Error: There's already a proposed Chancelor: " + match.game_state.chancelor_proposed);
            return;
        }

        if(player.charge !== PRESIDENT){
            res.status(401).send("Error: Only President can propose a new Chancelor");
            return;
        }

        let proposed_player_name = req.params.chancelor;
        let proposed_player = match.players.find(p => p.name === proposed_player_name);
        if(!proposed_player){
            res.status(401).send("Error: Proposed Player doesn't exist: " + proposed_player_name);
            return;
        }
        if(proposed_player.charge === PRESIDENT){
            res.status(401).send("Error: President cannot propose himself as chancelor");
            return;
        }

        match.game_state.chancelor_proposed = proposed_player_name;
        match.game_state.stage = VOTING_CHANCELOR;
        store_match(matchId, match);
        res.send("OK");
    }
    else{
        res.status(401).send("Error: Wrong player credentials");
        return;
    }
};

exports.discard_policy = function(req, res) {
    let matchId = req.params.matchId;
    let player_name = req.body.player;
    let policy = req.params.policy;
    if(!match_exists(matchId)){ 
        res.status(404).send("No match with id " + matchId + " was found"); 
        return;
    }
    let match = get_match(matchId);

    if(are_correct_player_credentials(match, req)){
        let player = get_player(match, player_name);

        if(is_my_turn_to_discard(match, player)){
            if(policy.toUpperCase() !== LIBERAL && policy.toUpperCase() !== FASCIST){
                res.status(403).send("Policy cards can only be of type LIBERAL or FASCIST"); 
                return;
            }

            let policy_cards = match.game_state.policy_cards;
            if(!policy_cards.includes(policy.toUpperCase())){
                res.status(403).send("No remaining cards of type " + policy); 
                return;
            }

            var first_index = policy_cards.findIndex(p => p === policy.toUpperCase());
            policy_cards.splice(first_index,1);

            // If there are still 2 cards, pass them to the Chancelor
            if(match.game_state.stage === PRESIDENT_DISCARD){
                match.game_state.stage = CHANCELOR_DISCARD;
            }
            // If there's just one card, approve the policy
            else if(match.game_state.stage === CHANCELOR_DISCARD){
                let chosen_policy = policy_cards[0];
                if(chosen_policy === LIBERAL){
                    match.liberal_policies_approved++;
                }
                else{
                    match.fascist_policies_approved++;
                }

                if(!match_ends(match)){
                    new_turn(match);
                }
                else{
                    res.send("THE MATCH HAS FINISHED. THANKS FOR PLAYING");        
                }
            }

            store_match(matchId, match);
            res.send("OK");
        }
        else{
            res.status(403).send("You need to be President or Chancelor to discard and they must be elected first." + 
                "If you're chancelor you have to wait for President to discard first. If you're president you can only discard one card."); 
            return;
        }

    } else{
        res.status(401).send("Error: Wrong player credentials");
        return;
    }
};

// PRIVATE FUNCTIONS
function match_ends(match){
    if(match.liberal_policies_approved > 4){
        match.status = FINISHED;
        match.game_state.stage = LIBERALS_WON;
        store_match(match);
        return true;
    }

    if(match.fascist_policies_approved > 5){
        match.status = FINISHED;
        match.game_state.stage = FASCISTS_WON;
        store_match(match);
        return true;
    }

    return false;
}

function are_correct_player_credentials(match, req){
    if(!req.body || !req.body.player || !req.body.pass){
        return false;
    }

    let player_name = req.body.player;
    let player_pass = req.body.pass;

    let player = get_player(match, player_name);
    return (player && player.pass === player_pass);
}

function get_player(match, player_name){
    return match.players.filter(p => p.name === player_name)[0];
}

function store_match(matchId, content){
    fs.writeFileSync('matches/' + matchId + '.match', JSON.stringify(content));
}

function match_exists(matchId){
    return fs.existsSync('matches/' + matchId + '.match');
}

function get_match(matchId){
    return JSON.parse(fs.readFileSync('matches/' + matchId + '.match', 'utf8'));
}

function setup_match(match){
    match.status = ONGOING;
    new_turn(match);

    // Share the different roles between players
    let players = match.players;
    let number_of_players = players.length;
    let roles_for_match = ROLE_SHARE_FOR_PLAYER_NUM[number_of_players];

    // Decide a Random President
    players[getRandomInt(number_of_players)].charge = PRESIDENT;

    // Shuffle the player list and give the roles
    players = shuffle_array(players);

    for(let i=0; i<number_of_players; i++){
        players[i].role = roles_for_match[i];
    }

    // Shuffle again so we cant deduct the roles by the sorting
    players = shuffle_array(players);
}

function is_my_turn_to_discard(match, player){
    return player.charge === PRESIDENT && match.game_state.stage === PRESIDENT_DISCARD || 
        player.charge === CHANCELOR && match.game_state.stage === CHANCELOR_DISCARD;
}

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
  }

/**
 * Shuffles array in place. ES6 version
 * @param {Array} a items An array containing the shuffle items.
 */
function shuffle_array(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function set_next_president(match){
    let players = match.players;
    let current_president_index = -1;
    for(let i=0; i<players.length; i++){
        if(players[i].charge === PRESIDENT){
           current_president_index = i; 
        }
    }

    // Match haven't started yet, choose the first player as president
    let new_president_index = 0;
    if(current_president_index !== -1){
        // Start from the beginning if president is last player. Go for the next one, otherwise
        new_president_index = 
            (current_president_index === players.length - 1 ? 0 : current_president_index + 1);
    }

    // Reset charges of all players and set the new President
    players.forEach(p => p.charge = "");
    players[new_president_index].charge = PRESIDENT;
}

function new_turn(match){
    match.game_state.stage = PROPOSING_CHANCELOR;
    match.game_state.round++;
    shuffle_three_cards(match);
    set_next_president(match);
}

function shuffle_three_cards(match){
    let cards = [];
    for(let i=0; i<3; i++){
        let policy = getRandomInt(100) > 65 ? LIBERAL : FASCIST;
        cards.push(policy);
    }
    match.game_state.policy_cards = cards;
}