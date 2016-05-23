var fs = require('fs');
var url = require('url');
var mime = require('mime');

exports = module.exports = tagParser;

function tagParser(docroot){
	var parser = {};
	
	var testforcommit = {};
	
	if(docroot != undefined){
		docroot = docroot.replace(/\//g, "\\");
		
		var dotindex = 0;
		while((dotindex = docroot.indexOf("..")) > -1){
			var start = docroot.lastIndexOf("\\", docroot.lastIndexOf("\\", dotindex));
			docroot = docroot.substring(0, start) + docroot.substring(dotindex+2);
		}
		
		var parserOpts = {
			docroot:	docroot
		};
		
		parser.parsers = [];
		
		parser.useParser = function(parserlib){
			addParserLib(parser, parserlib, parserOpts);
		}
		
		parser.useParser("./parsers/scriptpack");
		parser.useParser("./parsers/stylepack");
		
		return function serveParsed(req, res, next){
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
				fs.readFile(docroot + path, "utf8", function(err, file){
					if(err){
						console.log(err);
						return;
					}
					
					for(var i=0;i<parser.parsers.length;i++){
						if(file.indexOf("extl:" + parser.parsers[i].tag) > -1){
							file = parser.parsers[i].parser.scan(file, req);
						}
					}
					
					res.setHeader("Content-Type", mimetype);
					res.status(200).send(file);
				});
			}
			else {
				fs.readFile(docroot + path, function(err, file){
					if(err){
						console.log(err);
						return;
					}
					
					res.setHeader("Content-Type", mimetype);
					res.status(200).send(file);
				});
			}
		}
	}
}


function addParserLib(parser, parserlib, opts){
	var p = require(parserlib)(opts);;
	if(p.hasOwnProperty("scan") && p.hasOwnProperty("tag")){
		parser.parsers.push({
			tag:	p.tag,
			parser:	p
		});
	}
}