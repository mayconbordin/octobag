//     Octobag.js 0.1
//     (c) 2013 Maycon Bordin
//     Octobag.js may be freely distributed under the MIT license.
//     
//     Based on Github.js 0.7.0
//     (c) 2012 Michael Aufreiter, Development Seed

(function(){
  var API_URL = 'https://api.github.com';
  
  var Octobag = window.Octobag = function(options) {
    var repo = options.repo;
    var user = options.user;
    var branch = "master";
    var repoPath = "/repos/" + user + "/" + repo;
    var currentTree = {
      branch: null,
      sha: null
    };
    
    // Utility Functions
    // -----------------
    
    function _request(method, path, data, cb, raw) {
      function serialize(obj, prefix) {
        var str = [];
        for(var p in obj) {
          var k = prefix ? prefix + "[" + p + "]" : p, v = obj[p];
          str.push(typeof v == "object" ? 
            serialize(v, k) :
            encodeURIComponent(k) + "=" + encodeURIComponent(v));
        }
        return str.join("&");
      }
      
      function getURL(params) {
        var url = API_URL + path;
        var qmark = (/\?/).test(url);
        if (params) url += (qmark ? "&" : "?") + serialize(params);
        return url + (qmark ? "&" : "?") + (new Date()).getTime();
      }
      
      var xhr = new XMLHttpRequest();
      //if (!raw) {xhr.dataType = "json";}
      xhr.dataType = "json";

      xhr.open(method, getURL(method == 'GET' ? data : null));
      xhr.onreadystatechange = function () {
        if (this.readyState == 4) {
          if (this.status >= 200 && this.status < 300 || this.status === 304) {
            //cb(null, raw ? this.responseText : this.responseText ? JSON.parse(this.responseText) : true);
            cb(null, this.responseText ? JSON.parse(this.responseText) : true);
          } else {
            cb({request: this, error: this.status});
          }
        }
      };
      xhr.setRequestHeader('Accept','application/vnd.github.raw');
      xhr.setRequestHeader('Content-Type','application/json');
      if (
        (options.auth == 'oauth' && options.token) ||
        (options.auth == 'basic' && options.username && options.password)
      ) {
        xhr.setRequestHeader('Authorization',options.auth == 'oauth'
          ? 'token '+ options.token
          : 'Basic ' + Base64.encode(options.username + ':' + options.password)
        );
      }
      data ? xhr.send(JSON.stringify(data)) : xhr.send();
    }
    
    // GitHub API Functions
    // --------------------
    
    function getRef(ref, cb) {
      _request("GET", repoPath + "/git/refs/" + ref, null, function(err, res) {
        if (err) return cb(err);
        cb(null, res.object.sha);
      });
    }
    
    function updateTree(branch, cb) {
      if (branch === currentTree.branch && currentTree.sha) return cb(null, currentTree.sha);
      getRef("heads/"+branch, function(err, sha) {
        currentTree.branch = branch;
        currentTree.sha = sha;
        cb(err, sha);
      });
    }
    
    function postTree(tree, cb) {
      _request("POST", repoPath + "/git/trees", { "tree": tree }, function(err, res) {
        if (err) return cb(err);
        cb(null, res.sha);
      });
    }

    function postBlob(content, cb) {
      content = {
        "content": (typeof(content) === "string") ? content : JSON.stringify(content),
        "encoding": "utf-8"
      };

      _request("POST", repoPath + "/git/blobs", content, function(err, res) {
        if (err) return cb(err);
        cb(null, res.sha);
      });
    }

    function updateRepoTree(baseTree, path, blob, cb) {
      var data = {
        "base_tree": baseTree,
        "tree": [{
          "path": path,
          "mode": "100644",
          "type": "blob",
          "sha": blob
        }]
      };
        
      _request("POST", repoPath + "/git/trees", data, function(err, res) {
        if (err) return cb(err);
        cb(null, res.sha);
      });
    }

    function commit(parent, tree, message, cb) {
      var data = {
        "message": message,
        "author": {
          "name": 'mayconbordin'
        },
        "parents": [
          parent
        ],
        "tree": tree
      };

      _request("POST", repoPath + "/git/commits", data, function(err, res) {
        currentTree.sha = res.sha; // update latest commit
        if (err) return cb(err);
        cb(null, res.sha);
      });
    }

    function updateHead(head, commit, cb) {
      _request("PATCH", repoPath + "/git/refs/heads/" + head, { "sha": commit }, function(err, res) {
        cb(err);
      });
    }

    function write(path, content, message, cb) {
      updateTree(branch, function(err, latestCommit) {
        if (err) return cb(err);
        postBlob(content, function(err, blob) {
          if (err) return cb(err);
          updateRepoTree(latestCommit, path, blob, function(err, tree) {
            if (err) return cb(err);
            commit(latestCommit, tree, message, function(err, commit) {
              if (err) return cb(err);
              updateHead(branch, commit, cb);
            });
          });
        });
      });
    }
    
    function getBlob(sha, cb) {
      _request("GET", repoPath + "/git/blobs/" + sha, null, cb, 'raw');
    }

    function getSha(path, cb) {
      if (path === "") return getRef("heads/"+branch, cb);
      getTree(branch+"?recursive=true", function(err, tree) {
        var file;
        for (i in tree) {
          if (tree[i].path === path) {
            file = tree[i];
            break;
          }
        }
        
        cb(null, file ? file.sha : null);
      });
    }
    
    function getTree(tree, cb) {
      _request("GET", repoPath + "/git/trees/"+tree, null, function(err, res) {
        if (err) return cb(err);
        cb(null, res.tree);
      });
    }
    
    function remove(path, type, cb) {
      updateTree(branch, function(err, latestCommit) {
        getTree(latestCommit+"?recursive=true", function(err, tree) {
          var newTree = [];
          for (i in tree) {
            var item = tree[i];
            if (item.path !== path && item.path.indexOf(path) !== 0) {
              if (item.type === "tree") delete item.sha;
              newTree.push(item);
            }
          }
          
          postTree(newTree, function(err, rootTree) {
            commit(latestCommit, rootTree, "delete "+name+" "+type, function(err, commit) {
              updateHead(branch, commit, function(err) {
                cb(err);
              });
            });
          });
          
        });
      });
    }
    
    // Object Functions
    // ----------------
    
    this.collection = function(name) {
      return new Octobag.Collection(name);
    };
    
    this.collections = function(cb) {
      _request("GET", repoPath + "/contents?ref=" + branch, null, function(err, items) {
        if (err) cb(err);
        var colls = [];
        for (i in items) {
          if (items[i].type == "dir") {
            colls.push(new Octobag.Collection(items[i].name));
          }
        }
        cb(colls);
      });
    };
    
    Octobag.Collection = function(name) {
      this.name = name;
      
      this.put = function(key, value, cb) {
        var path = name + "/" + key;
        write(path, value, "put document "+path, cb);
      };
      
      this.delete = function(key, cb) {
        remove(name + "/" + key, "document", cb);
      };
      
      this.get = function(key, cb) {
        getSha(name + "/" + key, function(err, sha) {
          if (!sha) return cb("not found", null);
          getBlob(sha, function(err, doc) {
            cb(err, doc);
          });
        });
      };
      
      this.list = function(cb) {
        _request("GET", repoPath + "/contents?ref=" + branch, { path: name }, function(err, items) {
          var keys = [];
          for (i in items) {
            keys.push(items[i].name);
          }
          cb(null, keys);
        });
      };
      
      this.count = function(cb) {
        _request("GET", repoPath + "/contents?ref=" + branch, { path: name }, function(err, items) {
          cb(null, items.length);
        });
      };
      
      // Removes the collection
      // ----------------------
      
      this.drop = function(cb) {
        remove(name, "collection", cb);
      };
    };
  };
}).call(this);
