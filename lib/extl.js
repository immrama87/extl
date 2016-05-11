var fs = require('fs');
var url = require('url');

exports = module.exports = tagParser;

function tagParser(docroot){
	var parser = {};
	
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
				
				res.status(200).end(file);
			});
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