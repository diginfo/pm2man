#!/usr/bin/env node

function jsonParse(data){
  try {return JSON.parse(data)} 
  catch(e){
    console.error(e);
    process.exit(2);
  }
}

function jsonString(data){
  try {return JSON.stringify(data,null,2)}
  catch(e){return e} 
}

var cl = console.log;
function cj(obj){console.log(jsonString(obj))}

var pm2 = require('pm2');
var fs = require('fs');
var path = __dirname+'/json';

String.prototype.endsWith = function(suffix) {
   return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

function write(siteid,data){
  var jsdata = JSON.stringify({apps:[data.puremfg,data.vwlt]},null,2);
  fs.writeFileSync('json/'+siteid+'.json',jsdata, 'utf8');  
}

function connect(cb){
  pm2.connect(false,function(err) {
    if (err) {
      pm2.disconnect();
      cj({"error":true,"msg":err});
      process.exit(2);
    } else cb({"error":false,"msg":"success."})
  }) 
}

function maxport(){
  var mport=3000, sport=800;
  var sites = module.exports.getAll();
  for(var i in sites){
    var site = sites[i];
    if(site.appid=='puremfg') if(site.env.PORT > mport) mport=parseInt(site.env.PORT);
  }
  mport += 1; sport += (mport-3000);
  return({'mport':mport,'sport':sport});
}

module.exports = {
  
  dbconor:{
    host: "localhost",
    user:"root",
    pwd:"bukit8002",
    engine: "MYSQL",
    pooling: true,
    acquireTimeout: 30,
  },
  
  defaults: {
    max_restarts:3,
    min_uptime: '1m'
  },

  conf: require('./config.json'),
  data: null,

  addSite: function(siteid,args){
    
    if(args){
      args.split(/,| /).map(function(e){
        var bits = e.split('=');
        cl(bits);
        module.exports.conf.vars[bits[0]] = bits[1];
      })
    }
    
    var ports = maxport();
    module.exports.conf.vars['port'] = parseInt(ports.mport);
    module.exports.conf.vars['vwport'] = parseInt(ports.sport);
    module.exports.conf.vars['siteid'] = siteid;
    module.exports.conf.vars['dbname'] = siteid.toUpperCase();
    
    var jstr = JSON.stringify(module.exports.conf.apps,null,1);
    for(var x in module.exports.conf.vars){
      var val = module.exports.conf.vars[x];
      jstr = jstr.replace(new RegExp('%'+x+'%','g'),val);
    }
    module.exports.data = JSON.parse(jstr);
    cl(module.exports.data);
    write(siteid,module.exports.data);   
    
  },

  kill: function(){
    connect(function(res) {
      pm2.killDaemon(function(err) {
        pm2.disconnect();
        if(err) cj(err);
        else cj({"error":false,"msg":"success."}) 
      })
    })  
  },

  /* startup all enabled engines */
  start: function(site){
    connect(function(res) {
      
      if(site) var sites = module.exports.getSite(site);
      else var sites = module.exports.getAll(); 
      
      pm2.start(sites,function(err,res) {
        pm2.disconnect();
        if (err) {
          cj(err);
          process.exit(2);
        }
        
        res.map(function(a){
          cj(a.pm2_env.pm_id+' - '+a.pm2_env.name+' > '+a.pm2_env.status);
        })
      })
    });
  },
  
  /* write file to path */
  putFile: function(fname,data){
    try {
      fs.writeFileSync(path+'/'+fname, jsonString(jsonParse(data)), 'utf8');
      return ({error:false});
    } catch(err){
      return ({error:true,msg:err});
    }
  },

  /* retrieve a file by FILENAME, returns array.*/
  getFile: function(file){
    if(file.endsWith('.json')) {
      var app = jsonParse(fs.readFileSync(path+'/'+file, 'utf8'));
      if(app.apps && Array.isArray(app.apps)) return app.apps;
      else return [app];
    } else return [];    
  },
  
  /* get by SITEID, returns array */
  getSite: function(siteid){
    var site=[]; module.exports.getAll().map(function(e){
      if(e.env.SITEID==siteid) site.push(e);  
    });
    return site;  
  },

  /* get by GROUP, returns array */
  getGroup: function(grpid){
    var group=[]; module.exports.getAll().map(function(e){
      if(e.env.GRPID==grpid) group.push(e);  
    });
    return group;      
  },

  /* get by HOSTNAME, returns object */
  getHost: function(host){
    return module.exports.getAll(true)[host] || {}; 
  },

  /* get all from json FOLDER, array or object */
  getAll: function(asobj){
    if(asobj) var apps={}; else var apps=[];
    
    function add(a,file){
      a._filename = file;
      if(a.name != 'template' && !a.disabled) {
        for(var key in module.exports.defaults){
          a[key] = module.exports.defaults[key]; 
        }
        // if(a.env.DBSA) a.env.DBSA.host = "localhost";
        if(asobj) apps[a.name]=a;
        else apps.push(a);
      }    
    }
    
    fs.readdirSync(path).forEach(function(file) {
      module.exports.getFile(file).map(function(e){
        add(e,file);
      })   
    });
    return apps;    
  }  
}

// compatability.
module.exports.getall = module.exports.getAll;

/* 
  DEBUG COMMAND LINE
  getAll
  getHost www.puremfg.net
  getGroup oms
  start
  kill
*/

if(require.main === module){
	var args = process.argv.slice(2);
	var me = module.exports;
	if(args.length && me[args[0]]){
    if(args.length==2) cj(me[args[0]](args[1]));
    else if(args.length==3) cj(me[args[0]](args[1],args[2]));
    else cj(me[args[0]]());  	
	} else console.log('Bad command:' + args[0]);
}