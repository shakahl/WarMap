//to be run on node REPL
//for converting the round on https://docs.google.com/spreadsheets/d/1qcOQ5XtHYM2DvT-_YClxSi5fx7Hbizox1czpGWm1aTA/edit#gid=30197188
//convert the tsv of the match data into the following schema

//tile
//bastion_fighter
//bastion_comic_link
//pyre_fighter
//pyre_comic_link
//winner

//then require in that file, and this one, pass in the new round file into this adapt_fighters

//bastion_fighter
//bastion_comic_link
//pyre_fighter
//pyre_comic_link


// import { assert } from 'console';
const fs = require('fs')
const axios = require('axios')
const fighters = require('../allfighters.json')
// const round = require('../empty-map-schema.js')

const checkForNonSubmission = function(url){
    if(url === "[no submission]") return "na"
    return url
}

console.log('Loaded, use adapt_fighters(round number, round_json, bool-pyre-attacking')
console.log('or use the gb loader adapt_grand_battle(round_num, round_data, tile_location, context)')
console.log(`Duels must be processed and accepted first! `)
console.log('consume_survey(survey_data) requires the local server is running')

const upsert_fighter = function(match, fighter_map, faction, lastId, round_num, context = 'duel'){
    
    let curFighter = null

    for (const value of fighter_map.values()) {
        if(value.name.trim().toLowerCase() === match[`${faction}_fighter`].trim().toLowerCase()){
            curFighter = value
            // console.log(`adding to ${value.name} 's entry`)
            break
        }
    }

    //var curFighter = fighter_map.find(f => f.name.toLowerCase() === match[`${faction}_fighter`].toLowerCase())
    var link = checkForNonSubmission(match[`${faction}_comic_link`])
    link = derive_cubari_link(link)

    var fighterId = curFighter != null ? curFighter.id : -1
    if(fighterId === -1){
        fighter_map.set(lastId+1, {
            id: lastId + 1,
            name: match[`${faction}_fighter`],
            rounds: [round_num],
            link: [link],
            context: [context],
            faction: [faction],
            artists: {},
            backstory: "",
            verified: false  //new fighters need to be audited
        })
        console.log(`New Fighter ${fighter_map.get(lastId+1).name} fighter id : ${lastId+1}`)
        return lastId + 1
    }

    var fighter = fighter_map.get(fighterId)
    fighter.rounds.push(round_num)
    fighter.context.push(context)
    fighter.faction.push(faction)
    fighter.link.push(link)
    return fighter.id
    
}

const derive_cubari_link = function(link){
    //https://cubari.moe/read/imgur/2t0kUUs/1/1/

    const cubariLinkFormat = /^https:\/\/cubari\.moe\/read\/imgur\/......./i
    if(!cubariLinkFormat.test(link))
        return link
    const imgurId = /\/\w\w\w\w\w\w\w/i
    var index = link.match(imgurId)[0].slice(1)
    return `https://imgur.com/a/${index}`
}

const determine_tile_owner = function(tile){
    //the arbitrary nature of GB's mean those have to be flipped manually, unfortuanately
    if(!tile.contest) return tile.owner
    if(tile.outcome.pyre === "win") return "pyre"
    if(tile.outcome.bastion === "win") return "bastion"
    return "na"
}

exports.precheck_round = function(round_data){
    round_data.forEach(rd => {
        const winner = rd.winner.trim().toLowerCase()
        if(!(rd.bastion_fighter.trim().toLowerCase() ===winner || rd.pyre_fighter.trim().toLowerCase() === winner )){
            console.log(`${rd.bastion_fighter} v ${rd.pyre_fighter} does not resolve`)
        }
        if(rd.tile.length > 3){
            console.log(`Something is up with ${rd.tile}`)
        }
    })
}

//load the grand battle info
//context 
exports.adapt_grand_battle = function(round_num, round_data, tile_location, context){
    var map_round = require(`./round-${round_num}.json`)
    var lastId = 0
    
    var fighterIter = Object.values(fighters)
    var fighter_map = new Map()
    for (const fighter of fighterIter) {
        fighter_map.set(fighter.id, fighter) //apparantly you need this in order to be iterable
        lastId = lastId < fighter.id ? fighter.id : lastId
    }

    var tile = map_round[tile_location.toLowerCase()]
    tile.grandBattle = true


    round_data.forEach((match, i) => {
        //bastion
        if(match.bastion_fighter !== ""){
            var bastionfighterId = upsert_fighter(match, fighter_map, 'bastion', lastId, round_num, context)
            lastId = bastionfighterId > lastId ? bastionfighterId : lastId
            tile.fighters.bastion.push(bastionfighterId)
        }

        //pyre
        if(match.pyre_fighter !== ""){
            var pyrefighterId = upsert_fighter(match, fighter_map, 'pyre', lastId, round_num, context)
            lastId = pyrefighterId > lastId ? pyrefighterId : lastId
            tile.fighters.pyre.push(pyrefighterId)
        }
    })

    var flatmap = {}
    fighter_map.forEach((v,k) => flatmap[`${k}`] = v)

    //output the round and the new fighters
    var fighter_data = JSON.stringify(flatmap, null, 2)
    fs.writeFileSync('./new_allfighters.json', fighter_data)

    var round_data = JSON.stringify(map_round, null, 2)
    fs.writeFileSync(`./new_round-${round_num}.json`, round_data)

}

exports.consume_survey = async function(survey_data){
    // console.log(survey_data)
    for (const fighter of survey_data) {
        //console.log(fighter)
        if(isNaN(fighter.fighter_id)){
            console.log(`skipped ${fighter.fighter_id} : ${fighter.combatant_name}`)
            continue
        }

        //first, rename fighter
        axios.post(`http://localhost:8080/server/fightername/${fighter.fighter_id}`, {
            name: fighter.combatant_name
        }).catch(err => {
            console.error(`rename failed for ${fighter.fighter_id} : ${fighter.combatant_name} : ${err}`)
        })

        //insert backstory
        axios.post(`http://localhost:8080/server/backstory/${fighter.fighter_id}`, {
            backstory: fighter.background
        }).catch(err => {
            console.error(`background failed for ${fighter.fighter_id} : ${fighter.combatant_name} : ${err}`)
        })

        const regCreator = /^Both/
        var artistRole = fighter.role
        artistRole = regCreator.test(artistRole) ? "Creator" : artistRole

        //insert artist
        await axios.post(`http://localhost:8080/server/artist/${fighter.fighter_id}`, {
            artistname: fighter.artist_name,
            role:artistRole,
            twitter:fighter.artist_twitter,
            instagram:fighter.artist_instagram,
            pw1:fighter.artist_pw1,
            pw2:fighter.artist_pw2,

        }).catch(err => {
            console.error(`primary failed for ${fighter.fighter_id} : ${fighter.combatant_name} : ${err}`)
        })

        const regNocollab = /^I didn't have a collaborator/i

        if(!regNocollab.test(fighter.collab_status))
        {
            //insert artist
            await axios.post(`http://localhost:8080/server/artist/${fighter.fighter_id}`, {
                artistname: fighter.collab_name,
                role:fighter.collab_status,
                twitter:fighter.collab_twitter,
                instagram:fighter.collab_instagram,
                pw1:fighter.collab_pw1,
                pw2:fighter.collab_pw2,

            }).catch(err => {
                console.error(`collab failed for ${fighter.fighter_id} : ${fighter.combatant_name} : ${err}`)
            })
        }

    }

}

exports.adapt_fighters = function(round_num, round_data, pyre_attacking, gb_zone_array){
    var map_round = {}
    var lastId = 0

    var fighterIter = Object.values(fighters)
    var fighter_map = new Map()
    for (const fighter of fighterIter) {
        fighter_map.set(fighter.id, fighter) //apparantly you need this in order to be iterable
        lastId = lastId < fighter.id ? fighter.id : lastId
    }

    //initialize round schema:
    var round = require(`./round-${round_num-1}.json`)
    Object.keys(round).forEach(t => {
        var ownership = determine_tile_owner(round[t])
        // console.log(ownership)
        map_round[t] = {
            location: t,
            contest: false,
            attacker: 'na',
            owner: ownership,
            grandBattle: false,
            clash: false,
            items: [],
            fighters: {
                pyre: [],
                bastion: []
            },
            outcome: {
                pyre: "",
                bastion: ""
            },
            events:[]
       }
    })

    map_round['grandbattle'] = {zones:gb_zone_array}

    // console.log(map_round)

    round_data.forEach((match,i) => {
        
        //bastion
        var bastionfighterId = upsert_fighter(match, fighter_map, 'bastion', lastId, round_num)
        lastId = bastionfighterId > lastId ? bastionfighterId : lastId

        //pyre
        var pyrefighterId = upsert_fighter(match, fighter_map, 'pyre', lastId, round_num)
        lastId = pyrefighterId > lastId ? pyrefighterId : lastId

        let winnerId = -1
        // console.log(`${pyrefighterId}: ${fighter_map}`)

        if(fighter_map.get(bastionfighterId).name.trim().toLowerCase() === match.winner.trim().toLowerCase()){
            winnerId = bastionfighterId
        }else if (fighter_map.get(pyrefighterId).name.trim().toLowerCase() === match.winner.trim().toLowerCase()){
            winnerId = pyrefighterId
        }
        assert(winnerId !== -1, `Could not find the winner of match for ${match.tile}, could not find ${match.winner}`)

        //do the round def
        // console.log(`|${match.tile.toLowerCase()}|`)
        var tile = map_round[match.tile.toLowerCase()]
        tile.contest = true
        tile.attacker = (pyre_attacking && i < round_data.length/2) || (!pyre_attacking && i > round_data.length/2) ? 'pyre' : 'bastion'
        tile.fighters.bastion = [bastionfighterId]
        tile.fighters.pyre = [pyrefighterId]
        tile.outcome.bastion = winnerId === bastionfighterId ? "win" : "lose"
        tile.outcome.pyre = winnerId === bastionfighterId ? "lose" : "win"

    });

    var flatmap = {}
    fighter_map.forEach((v,k) => flatmap[`${k}`] = v)

    //output the round and the new fighters
    var fighter_data = JSON.stringify(flatmap, null, 2)
    fs.writeFileSync('./new_allfighters.json', fighter_data)

    var round_data = JSON.stringify(map_round, null, 2)
    fs.writeFileSync(`./new_round-${round_num}.json`, round_data)
}
