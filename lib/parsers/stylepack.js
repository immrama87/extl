var fs = require('fs');
var compressor = require("node-minify");

module.exports = (function(opts){
	var p = {};
	
	function initialize(){
		fs.stat(opts.docroot + "/stylepacks", function(err, stats){
			if(err){
				if(err.code == "ENOENT"){
					fs.mkdir(opts.docroot + "/stylepacks");
				}
			}
		});
	}
	
	function makeUpdate(text, start, end, filename, next){
		text = text.substring(0, start) + "<link rel=\"stylesheet\" type=\"text/css\" href=\"" +filename + "\"/>" + text.substring(end + ("</extl:stylepack>").length);
		next(undefined, text);
	}
	
	p.tag = "stylepack";
	
	p.minNodeVersion = 0.12;
	
	p.scan = function(text, index){
		return text.indexOf("<extl:stylepack", index);
	}
	
	p.parse = function(text, req, index, next){
		if(req.scopes.stylepacks == undefined){
			req.scopes.stylepacks = {};
			req.scopes.stylepacks.count = 0;
		}
		else if(req.scopes.stylepacks.count == undefined){
			req.scopes.stylepacks.count = 0;
		}
		else {
			req.scopes.stylepacks.count++;
		}
		
		var manifest;
		var uri = req.originalUrl.replace("/", "");
		if(uri == ""){
			uri = "index";
		}
		
		var manifestName = "stylepacks:" + uri + ":" + req.scopes.stylepacks.count;
		opts.memcached.get(manifestName, function(err, cached){
			if(err)
				next(err);
			
			if(cached){
				manifest = JSON.parse(cached);
			}
			else {
				manifest = {};
			}
			
			var endIndex = text.indexOf("</extl:stylepack>", index);
		
			var startIndex = index;
			var files = [];
			while((startIndex = text.indexOf("<link", startIndex)) > -1){
				if(startIndex > endIndex)
					break;
					
				var srcIndex = text.indexOf("href=\"", startIndex)+("href=\"").length;
				var endSrcIndex = text.indexOf("\"", srcIndex);
				
				var stylefile = text.substring(srcIndex, endSrcIndex);
				if(stylefile.charAt(0) != "/"){
					stylefile = "/" + stylefile;
				}
				
				if(stylefile.indexOf(".css") > -1){
					try{
						var fstat = fs.statSync(opts.docroot + stylefile);
						if(fstat.isFile()){
							files.push({
								filename: 	stylefile,
								stat:		fstat
							});
						}
					}
					catch(err){}
				}
				
				startIndex = endSrcIndex;
			}
			
			var valid = true;
			
			var filename = "stylepacks/" + uri + "/" + req.scopes.stylepacks.count + ".css"
			try{
				var fstat = fs.statSync(opts.docroot + "/" + filename);
				valid = fstat.isFile();
			}
			catch(err){
				valid = false;
			}
			
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
					type:		'clean-css',
					fileIn:		fileNames,
					fileOut:	opts.docroot + "/" + filename,
					sync:		true,
					callback:	function(err, data){
						if(err != null){
							next(err);
							return;
						}
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