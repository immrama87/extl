var fs = require('fs');
var compressor = require("node-minify");

module.exports = (function(opts){
	var p = {};
	
	function initialize(){
		fs.stat(opts.docroot + "/scriptpacks", function(err, stats){
			if(err){
				if(err.code == "ENOENT"){
					fs.mkdir(opts.docroot + "/scriptpacks");
				}
			}
		});
	}
	
	function makeUpdate(text, start, end, filename, next){
		text = text.substring(0, start) + "<script type=\"application/javascript\" src=\"" + filename + "\"></script>" + text.substring(end + ("</extl:scriptpack>").length);
		next(undefined, text);
	}
	
	p.tag = "scriptpack";
	
	p.minNodeVersion = 0.12;
	
	p.scan = function(text, index){
		return text.indexOf("<extl:scriptpack", index);
	}
	
	p.parse = function(text, req, index, next){
		if(req.scopes.scriptpacks == undefined){
			req.scopes.scriptpacks = {};
			req.scopes.scriptpacks.count = 0;
		}
		else if(req.scopes.scriptpacks.count == undefined){
			req.scopes.scriptpacks.count = 0;
		}
		else {
			req.scopes.scriptpacks.count++;
		}
		
		var manifest;
		var uri = req.originalUrl.replace("/", "");
		if(uri == ""){
			uri = "index";
		}
		
		var manifestName = "scriptpacks:" + uri + ":" + req.scopes.scriptpacks.count;
		opts.memcached.get(manifestName, function(err, cached){
			if(err)
				next(err);
			
			if(cached){
				manifest = JSON.parse(cached);
			}
			else {
				manifest = {};
			}
			
			var endIndex = text.indexOf("</extl:scriptpack>", index);
		
			var startIndex = index;
			var files = [];
			while((startIndex = text.indexOf("<script", startIndex)) > -1){
				if(startIndex > endIndex)
					break;
					
				var srcIndex = text.indexOf("src=\"", startIndex)+("src=\"").length;
				var endSrcIndex = text.indexOf("\"", srcIndex);
				
				var scriptfile = text.substring(srcIndex, endSrcIndex);
				if(scriptfile.charAt(0) != "/"){
					scriptfile = "/" + scriptfile;
				}
				
				if(scriptfile.indexOf(".js") > -1){
					try{
						var fstat = fs.statSync(opts.docroot + scriptfile);
						if(fstat.isFile()){
							files.push({
								filename: 	scriptfile,
								stat:		fstat
							});
						}
					}
					catch(err){}
				}
				
				startIndex = endSrcIndex;
			}
			
			var valid = true;
			
			var filename = "scriptpacks/" + uri + "/" + req.scopes.scriptpacks.count + ".js"
			for(var i=0;i<files.length;i++){
				if(manifest.hasOwnProperty(files[i].filename)){
					if(Date.parse(manifest[files[i].filename]) != files[i].stat.ctime.getTime()){
						valid = false;
						break;
					}
				}
				else {
					valid = false;
					break;
				}
			}
			
			if(!valid){
				manifest = {};
				fileNames = [];
				for(var f=0;f<files.length;f++){
					manifest[files[f].filename] = files[f].stat.ctime;
					fileNames.push(opts.docroot + files[f].filename);
				}
				
				new compressor.minify({
					type:		'gcc',
					fileIn:		fileNames,
					fileOut:	opts.docroot + "/" + filename,
					sync:		true,
					callback:	function(err){
						console.log(err);
					}
				});
				
				opts.memcached.set(manifestName, JSON.stringify(manifest), 86400*30, function(err){
					if(err){
						next(err);
					}
					else {
						makeUpdate(text, index, endIndex, filename, next);
					}
				});
			}
			else {
				makeUpdate(text, index, endIndex, filename, next);
			}
		});
	}
	
	initialize();
	
	return p;
});