var IndexFile, WordNetFile, fs, util,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

WordNetFile = require('./wordnet_file');

fs = require('fs');

util = require('util');

module.exports = IndexFile = (function(superClass) {
  var _findAt, _findPrevEOL, _getFileSize, _readLine;

  extend(IndexFile, superClass);

  function IndexFile(dataDir, name) {
    IndexFile.__super__.constructor.call(this, dataDir, 'index.' + name);
  }

  _findPrevEOL = function(self, fd, pos, callback) {
    var buff;
    buff = new Buffer(1024);
    if (pos === 0) {
      return callback(null, 0);
    } else {
      var count;
      count = fs.readSync(fd, buff, 0, 1, pos);
      if (count){
        if (buff[0] === 10) {
          return callback(null, pos + 1);
        }else{
          return _findPrevEOL(self, fd, pos - 1, callback);
        }
      }else{
        return callback("Error reading file", count);
      }
    }
  };

  _findPrevEOLAsync = async function(fd, pos) {
      if (pos === 0) {
        return 0;
      } else {
        try{
          const read = util.promisify(fs.read);
          var buff;
          buff = new Buffer(1024);

          var result =  await read(fd, buff, 0, 1, pos); 
          if (result.bytesRead){
            if (result.buffer[0] === 10){
              return pos+1;
            }else{
              return _findPrevEOLAsync(fd, pos - 1);
            }
          }else{
            throw new Error("error finding previous line");
          }
        }catch(e){
          throw new Error("Error finding previous line. e:"+e.message+" fd="+fd);
        }
      }
  };

  _readLine = function(self, fd, pos, callback) {
    var buff;
    buff = new Buffer(1024);
    return _findPrevEOL(self, fd, pos, function(err, pos) {
      if (err != null) {
        return callback(err, pos);
      }
      return self.appendLineChar(fd, pos, 0, buff, callback);
    });
  };

  _appendLineCharAsync = async function(fd, pos, buffPos, buff) {
    try{  
      var length, space, count;
      var i, j, newBuff, ref;
      length = buff.length;
      space = length - buffPos;
      var count;
      const read = util.promisify(fs.read);
      var result = await read(fd, buff, buffPos, space, pos); 
      if (!result.bytesRead){
        throw new Error("EOF");
      }else{
        if (buffPos === 0){
          for (i = j = 0, ref = count - 1; 0 <= ref ? j <= ref : j >= ref; i = 0 <= ref ? ++j : --j) {
            if (buff[i] === 10) {
              var line = result.buffer.slice(0, i).toString('ASCII');
              return line;
            }
          }
          newBuff = new Buffer(length * 2);
          buff.copy(newBuff, 0, 0, length);
          return await _appendLineCharAsync( fd, pos + length, length, newBuff);
        }
        return buff.toString('ASCII');
      }
      }catch(e){
        //console.log("errorr............."+e.message);
        throw new Error(e);
      }
  };
  _readLineAsync = async function(fd, pos) {
      try{
        var buff;
        buff = new Buffer(1024);
        pos = await _findPrevEOLAsync(fd, pos);
        return await _appendLineCharAsync(fd, pos, 0, buff);
      }catch(e){
        throw new Error(e);
      }
  };

  _findAt = function( self, fd, size, pos, lastPos, adjustment, searchKey, callback, lastKey) {
    if (lastPos === pos || pos >= size) {
      return callback(null, null, {
        status: 'miss'
      });
    } else {
      return _readLine(self, fd, pos, function(err, line) {
        var key, tokens;
        if (err != null) {
          return callback(null,err, null);
        }
        tokens = line.split(/\s+/);
        key = tokens[0];
        if (key === searchKey) {
          var rec = {
            status: 'hit',
            key: key,
            'line': line,
            tokens: tokens
          }
          return callback(null,  {
            status: 'hit',
            key: key,
            'line': line,
            tokens: tokens
          });
        } else if (adjustment < 2 || key === lastKey) {
          return callback(null, {
            status: 'miss'
          });
        } else {
          adjustment = Math.ceil(adjustment * 0.5);
          if (key < searchKey) {
            return _findAt(self, fd, size, pos + adjustment, pos, adjustment, searchKey, callback, key);
          } else {
            return _findAt(self, fd, size, pos - adjustment, pos, adjustment, searchKey, callback, key);
          }
        }
      });
    }
  };

  _findAtAsync = async function(fd, size, pos, lastPos, adjustment, searchKey, lastKey) {
    if (lastPos === pos || pos >= size) {
      return {status: 'miss'};
    } else {
      try{
        var line = await _readLineAsync(fd, pos);
        tokens = line.split(/\s+/);
        key = tokens[0];
        if (key === searchKey) {
          var rec = {
            status: 'hit',
            key: key,
            'line': line,
            tokens: tokens
          }
          return rec;
        } else if (adjustment < 2 || key === lastKey) {
          return  {status: 'miss'};
        } else {
          adjustment = Math.ceil(adjustment * 0.5);
          if (key < searchKey) {
            return _findAtAsync(fd, size, pos + adjustment, pos, adjustment, searchKey, key);
          } else {

            return _findAtAsync(fd, size, pos - adjustment, pos, adjustment, searchKey,  key);
          }
        }
      
      }catch(e){
        throw new Error(e);
      }
    }    
    
  };

  _getFileSize = function(path) {
    var stat;
    stat = fs.statSync(path);
    return stat.size;
  };

  IndexFile.prototype.find = function(searchKey, callback) {
    var self;
    self = this;
    return this.open(function(err, fd) {
      var pos, size;
      if (err != null) {
        return callback(err, null);
      }
      size = _getFileSize(this.filePath) - 1;
      pos = Math.ceil(size / 2);
      return _findAt(self, fd, size, pos, null, pos, searchKey, function(err, result) {
        return callback.call(self, err, result);
      });
    });
  };

  IndexFile.prototype.lookupFromFileAsync = async function (word){
    var indexRecord;
    try{
      var record =  await this.findAsync(word);
      var i,  j, k, offsets, ptrs, ref, ref1;
      indexRecord = {};
      if (record.status === 'hit') {
        ptrs = [];
        offsets = [];
        for (i = j = 0, ref = parseInt(record.tokens[3]) - 1; j <= ref; i = j += 1) {
          ptrs.push(record.tokens[i]);
        }
        for (i = k = 0, ref1 = parseInt(record.tokens[2]) - 1; k <= ref1; i = k += 1) {
        offsets.push(parseInt(record.tokens[ptrs.length + 6 + i], 10));
        }
        indexRecord = {
            lemma: record.tokens[0],
            pos: record.tokens[1],
            ptrSymbol: ptrs,
            senseCnt: parseInt(record.tokens[ptrs.length + 4], 10),
            tagsenseCnt: parseInt(record.tokens[ptrs.length + 5], 10),
            synsetOffset: offsets
        };
      }
      return indexRecord;
    }catch(e){
      throw new Error(e);
    }
    
    

  };
  IndexFile.prototype.findAsync = async function (searchKey) {
    
    try{
      var fd = await this.openAsync();
      var pos, size;
      size = _getFileSize(this.filePath) - 1;
      pos = Math.ceil(size / 2);
      result = await _findAtAsync(fd, size, pos, null, pos, searchKey);
      return result;
    }catch(e){
      throw new Error(e);
    }
    
  };

  IndexFile.prototype.lookupFromFile = function(word, callback) {
    try {
      return this.find(word, function(err, record) {
        var i, indexRecord, j, k, offsets, ptrs, ref, ref1;
        if (err != null) {
          return callback.call(this, err, null);
        }
        indexRecord = null;
        if (record.status === 'hit') {
          ptrs = [];
          offsets = [];
          for (i = j = 0, ref = parseInt(record.tokens[3]) - 1; j <= ref; i = j += 1) {
            ptrs.push(record.tokens[i]);
          }
          for (i = k = 0, ref1 = parseInt(record.tokens[2]) - 1; k <= ref1; i = k += 1) {
            offsets.push(parseInt(record.tokens[ptrs.length + 6 + i], 10));
          }
          indexRecord = {
            lemma: record.tokens[0],
            pos: record.tokens[1],
            ptrSymbol: ptrs,
            senseCnt: parseInt(record.tokens[ptrs.length + 4], 10),
            tagsenseCnt: parseInt(record.tokens[ptrs.length + 5], 10),
            synsetOffset: offsets
          };
          
        }
        callback.call(this, null, indexRecord);
        return;
      });
    }catch(e){
      console.log("lookupFromFile: Caught Exception e"+e.message);
    }
  };

 
  IndexFile.prototype.lookup = function(word, callback) {
    return this.lookupFromFile(word, callback);
  };

  return IndexFile;

})(WordNetFile);
