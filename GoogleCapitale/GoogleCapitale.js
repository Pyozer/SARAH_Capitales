var ScribeSpeak;
var token;
var TIME_ELAPSED;
var FULL_RECO;
var PARTIAL_RECO;
var TIMEOUT_SEC = 10000;

exports.init = function () {
    info('[ GoogleCapitale ] is initializing ...');
}

exports.action = function(data, callback){
	
	ScribeSpeak = SARAH.ScribeSpeak;

	FULL_RECO = SARAH.context.scribe.FULL_RECO;
	PARTIAL_RECO = SARAH.context.scribe.PARTIAL_RECO;
	TIME_ELAPSED = SARAH.context.scribe.TIME_ELAPSED;

	SARAH.context.scribe.activePlugin('GoogleCapitale');

	var util = require('util');
	console.log("GoogleCapitale call log: " + util.inspect(data, { showHidden: true, depth: null }));

	SARAH.context.scribe.hook = function(event) {
		checkScribe(event, data.action, callback); 
	};
	
	token = setTimeout(function(){
		SARAH.context.scribe.hook("TIME_ELAPSED");
	}, TIMEOUT_SEC);

}

function checkScribe(event, action, callback) {

	if (event == FULL_RECO) {
		clearTimeout(token);
		SARAH.context.scribe.hook = undefined;
		// aurait-on trouvé ?
		decodeScribe(SARAH.context.scribe.lastReco, callback);

	} else if(event == TIME_ELAPSED) {
		// timeout !
		SARAH.context.scribe.hook = undefined;
		// aurait-on compris autre chose ?
		if (SARAH.context.scribe.lastPartialConfidence >= 0.7 && SARAH.context.scribe.compteurPartial > SARAH.context.scribe.compteur) {
			decodeScribe(SARAH.context.scribe.lastPartial, callback);
		} else {
			SARAH.context.scribe.activePlugin('Aucun (GoogleCapitale)');
			//ScribeSpeak("Désolé je n'ai pas compris. Merci de réessayer.", true);
			return callback({ 'tts': "" });
		}
		
	} else {
		// pas traité
	}
}

function decodeScribe(search, callback) {

	console.log ("Search: " + search);
	var rgxp = /capitale( de la| des| de| du| aux| au| en)? (l')?(.+)/i;

	var match = search.match(rgxp);
	if (!match || match.length <= 1){
		SARAH.context.scribe.activePlugin('Aucun (GoogleCapitale)');
		//ScribeSpeak("Désolé je n'ai pas compris.", true);
		return callback({ 'tts': "Désolé je n'ai pas compris." });
	}
	search = match[3].trim();
	var determinant = match[1].trim();
	return capitalegoogle(callback, search, determinant);
}

function capitalegoogle(callback, pays, determinant) {
	// On vérifie si on n'a pas déjà enregistré la capitale
	var fs = require("fs");
	var path = require('path');
 	var filePath = __dirname + "/CapitalesSave.json";
	var file_content;

	file_content = fs.readFileSync(filePath, 'utf8');
	file_content = JSON.parse(file_content);

	if(typeof file_content[pays] != 'undefined' && file_content[pays] != "") {
		var infos = file_content[pays];
		console.log("Informations: " + infos);
		//ScribeSpeak(infos);
		callback({ 'tts': infos });
		return;
	} else {
		search = "capitale " + pays;
	}

	var url = "https://www.google.fr/search?q=" + encodeURI(search) + "&btnG=Rechercher&gbv=1";
	console.log('Url Request: ' + url);

	var request = require('request');
	var cheerio = require('cheerio');

	var options = {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.87 Safari/537.36',
		'Accept-Charset': 'utf-8'
	};
	
	request({ 'uri': url, 'headers': options }, function(error, response, html) {

    	if (error || response.statusCode != 200) {
    		//ScribeSpeak("La requête vers Google a échoué. Erreur " + response.statusCode);
			callback({ 'tts': "La requête vers Google a échoué. Erreur " + response.statusCode });
			return;
	    }
        var $ = cheerio.load(html);

        var capitale = $('.g #_vBb span._m3b').text().trim();
        var infosget = $('.g #_vBb div._eGc').text().trim();
		var paysget = infosget.split(',')[0].trim();

        if(capitale == "" || infosget == "") {
        	console.log("Impossible de récupérer les informations sur Google");
        	//ScribeSpeak("Désolé, je n'ai pas réussi à récupérer d'informations");
			callback({ 'tts': "Désolé, je n'ai pas réussi à récupérer d'informations" });
        } else {
        	console.log("Capitale " + pays + ": " + capitale);

			var reponse = "La capitale " + determinant + " " + paysget + " est " + capitale + "."; // Réponse à dire

			// On sauvegarde sa date de naissance
			file_content[pays] = reponse;
        	chaine = JSON.stringify(file_content, null, '\t');
			fs.writeFile(filePath, chaine, function (err) {
				console.log("[ GoogleCapitale ] Informations enregistrés");
			});

        	//ScribeSpeak(reponse);
			callback({ 'tts': reponse });
        }
	    return;
    });
}