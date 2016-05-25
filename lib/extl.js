var fs = require('fs');
var url = require('url');
var Memcached = require('memcached');
var mime = require('mime');

exports = module.exports = tagParser;

function tagParser(config){
	var parser = {};
	var parserOpts = {};
	
	if(config.docroot != undefined){
		var docroot = config.docroot.replace(/\//g, "\\");
		
		var dotindex = 0;
		while((dotindex = docroot.indexOf("..")) > -1){
			var start = docroot.lastIndexOf("\\", docroot.lastIndexOf("\\", dotindex));
			docroot = docroot.substring(0, start) + docroot.substring(dotindex+2);
		}
		
		parserOpts.docroot = docroot;
	}
	else {
		throw "Could not start Express Tag Library parser. A docroot value is required in the config object";
	}
	
	if(config.memcached != undefined){
		var serverList = [];
		if(config.memcached.server != undefined){
			var server = config.memcached.server;
			if(config.memcached.port != undefined){
				server += ":" + config.memcached.port;
			}
			else {
				//Default port number for memcached
				server += ":11211";
			}
			
			serverList.push(server);
		}
		else if(config.memcached.servers != undefined){
			serverList = config.memcached.servers;
		}
		
		if(serverList.length > 0){
			var memopts = {};
			if(config.memcached.options != undefined){
				memopts = config.memcached.options;
			}
			
			parserOpts.memcached = new Memcached(serverList, memopts);
		}
		else {
			throw "Could not start Express Tag Library parser. At least one memcached server must be present in the config.memcached object.";
		}
	}
	else {
		throw "Could not start Express Tag Library parser. A memcached object is required in the config object";
	}
	
	parser.parsers = {};
		
	parser.useParser = function(parserlib){
		addParserLib(parser, parserlib, parserOpts);
	}
	
	parser.useParser("./parsers/scriptpack");
	parser.useParser("./parsers/stylepack");
	
	parser.static = function(req, res, next){
		if(req.method !== 'GET' && req.method !== 'HEAD'){
			res.statusCode = 405
			res.setHeader('Allow', 'GET, HEAD')
			res.setHeader('Content-Length', '0')
			res.end()
			return 
		}
		
		var path = url.parse(req.originalUrl).pathname;
		if(path == "/" || path == ""){
			path = "/index.html";
		}
		
		var mimetype = mime.lookup(path);
		
		if(mimetype == "text/html"){
			fs.readFile(parserOpts.docroot + path, "utf8", function(err, file){
				if(err){
					console.log(err);
					return;
				}
				
				parserProcess = new ParserProcess(file, req, parser.parsers)
					.complete(function(err, data){
						if(err)
							throw err;
							
						res.setHeader("Content-Type", mimetype);
						res.status(200).send(data);					
					});
				
			});
		}
		else {
			fs.readFile(parserOpts.docroot + path, function(err, file){
				if(err){
					console.log(err);
					return;
				}
				
				res.setHeader("Content-Type", mimetype);
				res.status(200).send(file);
			});
		}
	}
	
	return parser;
}

function addParserLib(parser, parserlib, opts){
	var p = require(parserlib)(opts);
	if(p.hasOwnProperty("scan") && p.hasOwnProperty("tag") && p.hasOwnProperty("parse")){
		if(p.hasOwnProperty("minNodeVersion") && p.minNodeVersion > process.version){
			return;
		}
		
		parser.parsers[p.tag] = p;
	}
}

var ParserProcess = (function(file, req, parsers){
	var pp = {};
	
	req.scopes = {};
	
	var index = 0;
	
	var complete;
	
	function scan(text){
		var scanIndex = text.length;
		var parser;
		for(var i in parsers){
			var parserIndex = parsers[i].scan(text, index);
			if(parserIndex > -1 && parserIndex < scanIndex){
				parser = parsers[i];
				scanIndex = parserIndex;
			}
		}
		
		if(parser == undefined){
			if(complete != undefined){
				complete(undefined, text);
			}
		}
		else {
			parser.parse(text, req, scanIndex, function(err, data){
				if(err){
					complete(err);
				}
				else {
					scan(data);
				}
			});
		}
	}
	
	pp.complete = function(fin){
		if(fin && typeof fin == "function"){
			complete = fin;
		}
	}
	
	scan(file);
	
	return pp;
});