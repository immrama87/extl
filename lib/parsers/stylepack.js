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
	
	p.tag = "stylepack";
	
	p.minNodeVersion = 0.12;
	
	p.scan = function(text, req){
		var scanIndex = 0;
		var scanCount = 0;
		
		while((scanIndex = text.indexOf("<extl:stylepack", scanIndex)) > -1){
			try{
				var packDirStat = fs.statSync(opts.docroot + "/stylepacks/" + req.originalUrl.replace("/", "") + scanCount);
			}
			catch(err){
				if(err.code == "ENOENT"){
					fs.mkdirSync(opts.docroot + "/stylepacks/" + req.originalUrl.replace("/", "") + scanCount);
				}
			}
			
			var manifest;
			try{
				manifest = fs.readFileSync(opts.docroot + "/stylepacks/" + req.originalUrl.replace("/", "") + scanCount + "/manifest.mf", "utf8");
				if(manifest == ""){
					manifest = "{}";
				}
			}
			catch(err){
				if(err.code == "ENOENT"){
					fs.openSync(opts.docroot + "/stylepacks/" + req.originalUrl.replace("/", "") + scanCount + "/manifest.mf", "a+");
					manifest = "{}";
				}
			}
			
			manifest = JSON.parse(manifest);
			
			
			var endScanIndex = text.indexOf("</extl:stylepack>", scanIndex);
			
			var startIndex = scanIndex;
			var files = [];
			while((startIndex = text.indexOf("<link", startIndex)) > -1){
				if(startIndex > endScanIndex)
					break;
					
				var srcIndex = text.indexOf("href=\"", startIndex)+("href=\"").length;
				var endSrcIndex = text.indexOf("\"", srcIndex);
				
				var cssfile = text.substring(srcIndex, endSrcIndex);
				if(cssfile.charAt(0) != "/"){
					cssfile = "/" + cssfile;
				}
				
				if(cssfile.indexOf(".css") > -1){
					try{
						var fstat = fs.statSync(opts.docroot + cssfile);
						if(fstat.isFile()){
							files.push({
								filename: 	cssfile,
								stat:		fstat
							});
						}
					}
					catch(err){}
				}
				
				startIndex = endSrcIndex;
			}
			
			var valid = true;
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
				
				console.log(fileNames);
				
				new compressor.minify({
					type:		'clean-css',
					fileIn:		fileNames,
					fileOut:	opts.docroot + "/stylepacks/" + req.originalUrl.replace("/", "") + scanCount + "/pack.css",
					sync:		true,
					callback:	function(err){
						console.log(err);
					}
				});
				
				fs.writeFileSync(opts.docroot + "/stylepacks/" + req.originalUrl.replace("/", "") + scanCount + "/manifest.mf", JSON.stringify(manifest), {encoding: "utf8"});
			}
			
			text = text.substring(0, scanIndex) + "<link rel=\"stylesheet\" type=\"text/css\" href=\"stylepacks/" + req.originalUrl.replace("/","") + scanCount + "/pack.css\">" + text.substring(endScanIndex + ("</extl:stylepack>").length);
			scanCount ++;
		}
		
		return text;
	}
	
	initialize();
	
	return p;
});