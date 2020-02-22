var WordNetFile, fs, path, util;

fs = require('fs');

path = require('path');

util = require('util');

module.exports = WordNetFile = (function() {
  function WordNetFile(dataDir, fileName) {
    this.dataDir = dataDir;
    this.fileName = fileName;
    this.filePath = path.join(this.dataDir, this.fileName);
  }

  WordNetFile.prototype.open = function(callback) {
    var filePath, self;
    self = this;
    if (this.fd) {
      return callback.call(self, null, this.fd);
    }
    filePath = this.filePath;
    return fs.open(filePath, 'r', null, (function(_this) {
      return function(err, fd) {
        if (err != null) {
          return callback.call(self, err, null);
        }
        _this.fd = fd;
        return callback.call(self, err, fd);
      };
    })(this));
  };
  WordNetFile.prototype.appendLineCharAsync = async function(fd, pos, buffPos, buff) {
    try{  
      var length, space, count;
      var i, j, newBuff, ref;
      length = buff.length;
      space = length - buffPos;
      var count;
      const read = util.promisify(fs.read);
      var result = await read(fd, buff, buffPos, space, pos); 
      console.log(result);
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
          return await this.appendLineCharAsync(fd, pos + length, length, newBuff);
        }
        return buff
      }
      }catch(e){
        console.log("error appending line character"+e.message());
        throw new Error(e);
      }
  };

  WordNetFile.prototype.openAsync = async function() {
    var self;
    self = this;
    var filePath;
    filePath = self.filePath;
    return new Promise(function  (resolve, reject) {
      if (self.fd) {
        return resolve(self.fd);
      }
      try {
        const open = util.promisify(fs.open);
        var fdp = open(filePath,'r');
        fdp.then (fd =>{
          self.fd = fd;
          return resolve(self.fd);
        });
    }catch (e){
      console.log("WordNetFile.prototype.open: Exception: "+e.message)
      return reject(e.message);
    }
    });
    
  };


  WordNetFile.prototype.close = function() {
    if (this.fd != null) {
      fs.close(this.fd);
      return delete this.fd;
    }
  };

  WordNetFile.prototype.closeAsync = async function() {
    if (this.fd != null) {
      const close = util.promisify(fs.close);
      await close(this.fd)
      return delete this.fd;
    }
  };

  WordNetFile.prototype.appendLineChar = function(fd, pos, buffPos, buff, callback) {
    var length, self, space;
    self = this;
    length = buff.length;
    space = length - buffPos;
    return fs.read(fd, buff, buffPos, space, pos, function(err, count, buffer) {
      var i, j, newBuff, ref;
      if (err != null) {
        return callback.call(self, err, null);
      }
      for (i = j = 0, ref = count - 1; 0 <= ref ? j <= ref : j >= ref; i = 0 <= ref ? ++j : --j) {
        if (buff[i] === 10) {
          return callback.call(self, null, buff.slice(0, i).toString('ASCII'));
        }
      }
      newBuff = new Buffer(length * 2);
      buff.copy(newBuff, 0, 0, length);
      return self.appendLineChar(fd, pos + length, length, newBuff, callback);
    });
  };


  
  return WordNetFile;

})();
