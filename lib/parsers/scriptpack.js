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
	
	p.tag = "scriptpack";
	
	p.minNodeVersion = 0.12;
	
	p.scan = function(text, req){
		var scanIndex = 0;
		var scanCount = 0;
		
		while((scanIndex = text.indexOf("<extl:scriptpack", scanIndex)) > -1){
			try{
				var packDirStat = fs.statSync(opts.docroot + "/scriptpacks/" + req.originalUrl.replace("/", "") + scanCount);
			}
			catch(err){
				if(err.code == "ENOENT"){
					fs.mkdirSync(opts.docroot + "/scriptpacks/" + req.originalUrl.replace("/", "") + scanCount);
				}
			}
			
			var manifest;
			try{
				manifest = fs.readFileSync(opts.docroot + "/scriptpacks/" + req.originalUrl.replace("/", "") + scanCount + "/manifest.mf", "utf8");
				if(manifest == ""){
					manifest = "{}";
				}
			}
			catch(err){
				if(err.code == "ENOENT"){
					fs.openSync(opts.docroot + "/scriptpacks/" + req.originalUrl.replace("/", "") + scanCount + "/manifest.mf", "a+");
					manifest = "{}";
				}
			}
			
			manifest = JSON.parse(manifest);
			
			
			var endScanIndex = text.indexOf("</extl:scriptpack>", scanIndex);
			
			var startIndex = scanIndex;
			var files = [];
			while((startIndex = text.indexOf("<script", startIndex)) > -1){
				if(startIndex > endScanIndex)
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
					fileOut:	opts.docroot + "/scriptpacks/" + req.originalUrl.replace("/", "") + scanCount + "/pack.js",
					sync:		true,
					callback:	function(err){
						console.log(err);
					}
				});
				
				fs.writeFileSync(opts.docroot + "/scriptpacks/" + req.originalUrl.replace("/", "") + scanCount + "/manifest.mf", JSON.stringify(manifest), {encoding: "utf8"});
			}
			
			text = text.substring(0, scanIndex) + "<script type=\"application/javascript\" src=\"scriptpacks/" + req.originalUrl.replace("/","") + scanCount + "/pack.js\"></script>" + text.substring(endScanIndex + ("</extl:scriptpack>").length);
			scanCount ++;
		}
		
		return text;
	}
	
	initialize();
	
	return p;
});