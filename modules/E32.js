/* Copyright (c) 2016 Gordon Williams, Pur3 Ltd. See the file LICENSE for copying permission. */

function toHex(m) {
  m = E.toString(m);
  var hex = "";
  for (var i in m)
    hex += (m.charCodeAt(i)+256).toString(16).substr(-2);
  return hex;
}

function fromHex(d, startIdx) {
  var msg = "";
  for (var i=startIdx;i<d.length;i+=2)
    msg += String.fromCharCode(parseInt(d.substr(i,2),16));
  return msg;
}

function waiter(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
};

// M0 and M1 in binary
const MODE = {
  normal: 0,
  powerSaving: 1,
  wakeUp: 2,
  sleep: 3
}


/** Connect to a E32.
  First argument is the serial device, second is an
  object containing:

  {
    reset : pin // optional
    debug : true // optional
    M0 : pin // optional
    M1 : pin // optional
    AUX : pin // optional
  }
*/
function E32(serial, options) {
  this.ser = serial;
  this.options = options||{};
  this.at = require("AT").connect(serial);
  this.mode = 'normal';
  if (this.options.debug) this.at.debug();

  var lora = this;
  this.ready().then(function() {
    console.log("E32 is ready");
  });

  this.macOn = true; // are we in LoRaWAN mode or not?
}

E32.prototype.cmd = function(cmd, timeout) {
  var lora = this;
  return new Promise(function(resolve) {
    lora.at.cmd(cmd,timeout,resolve);
  });
};

E32.prototype.ready = function() {
  var lora = this;
  return new Promise(function(resolve) {
    setWatch(resolve, lora.options.AUX, { repeat: false, edge: 'rising'});
  });
};

E32.prototype.setMode = function(name) {
  this.mode = name;
  console.log("Mode change to "+name);
  digitalWrite(this.options.M0, 1);
  digitalWrite(this.options.M1, 1);
  // digitalWrite([this.options.M0,this.options.M1], MODE[name]);
  return waiter(1);
};

// switch to sleep mode, reset and go back to previous mode
E32.prototype.reset = function() {
  if (this.mode === 'sleep') {
    return this.cmd("C4C4C4\r\n",1000);
  }
  else {
    lastMode = this.mode;
    return this.setMode('sleep')
      .then(function() {
        return this.cmd("C4C4C4\r\n",1000)
      })
      .then(function() {
        return this.setMode(lastMode);
      });
  }
};

// switch to sleep mode, get version and go back to previous mode
E32.prototype.getVersion = function() {
  var lora = this;

  function parseVersion(d) {
    console.log("data received: "+d);
    var version = {
      version: d
    };
    return version;
  };
  var resetCmd="C3 C3 C3";

  if (lora.mode === 'sleep') {
    return lora.cmd(resetCmd,1000)
      .then(parseVersion)
  }
  else {
    lastMode = lora.mode;
    lora.setMode('sleep')
      .then(function() {
        return lora.cmd(resetCmd,1000);
      })
      .then(parseVersion)
      .then(function(v) {
        return lora.setMode(lastMode)
          .then(function() {
            // closure to return the promise with version
            return v;
          });
      });
  }
};

// /** Call the callback with the current status as an object.
//  Includes: EUI, VDD, appEUI, devEUI, band, dataRate, rxDelay1 and rxDelay2 */
// E32.prototype.getStatus = function(callback) {
//   var status = {};
//   var at = this.at;

//   (new Promise(function(resolve) {
//     at.cmd("sys get hweui\r\n",500,resolve);
//   })).then(function(d) {
//     status.EUI = d;
//     return new Promise(function(resolve) {
//       at.cmd("sys get vdd\r\n",500,resolve);
//     });
//   }).then(function(d) {
//     status.VDD = parseInt(d,10)/1000;
//     return new Promise(function(resolve) {
//       at.cmd("mac get appeui\r\n",500,resolve);
//     });
//   }).then(function(d) {
//     status.appEUI = d;
//     return new Promise(function(resolve) {
//       at.cmd("mac get deveui\r\n",500,resolve);
//     });
//   }).then(function(d) {
//     status.devEUI = d;
//     return new Promise(function(resolve) {
//       at.cmd("mac get band\r\n",500,resolve);
//     });
//   }).then(function(d) {
//     status.band = d;
//     return new Promise(function(resolve) {
//       at.cmd("mac get dr\r\n",500,resolve);
//     });
//   }).then(function(d) {
//     status.dataRate = d;
//     return new Promise(function(resolve) {
//       at.cmd("mac get rxdelay1\r\n",500,resolve);
//     });
//   }).then(function(d) {
//     status.rxDelay1 = d;
//     return new Promise(function(resolve) {
//       at.cmd("mac get rxdelay2\r\n",500,resolve);
//     });
//   }).then(function(d) {
//     status.rxDelay2 = d;
//     return new Promise(function(resolve) {
//       at.cmd("mac get rx2 868\r\n",500,resolve);
//     });
//   }).then(function(d) {
//     status.rxFreq2_868 = d;
//     callback(status);
//   });
// };

// /** configure the LoRaWAN parameters
//  devAddr = 4 byte address for this device as hex - eg. "01234567"
//  nwkSKey = 16 byte network session key as hex - eg. "01234567012345670123456701234567"
//  appSKey = 16 byte application session key as hex - eg. "01234567012345670123456701234567"
// */
// E32.prototype.LoRaWAN = function(devAddr,nwkSKey,appSKey, callback)
// {
//   var at = this.at;
//   (new Promise(function(resolve) {
//     at.cmd("mac set devaddr "+devAddr+"\r\n",500,resolve);
//   })).then(function() {
//     return new Promise(function(resolve) {
//       at.cmd("mac set nwkskey "+nwkSKey+"\r\n",500,resolve);
//     });
//   }).then(function() {
//     return new Promise(function(resolve) {
//       at.cmd("mac set appskey "+appSKey+"\r\n",500,resolve);
//     });
//   }).then(function() {
//     return new Promise(function(resolve) {
//       at.cmd("mac join ABP\r\n",2000,resolve);
//     });
//   }).then(function(d) {
//     callback((d=="ok")?null:((d===undefined?"Timeout":d)));
//   });
// };

// /// Set whether the MAC (LoRaWan) is enabled or disabled
// E32.prototype.setMAC = function(on, callback) {
//   if (this.macOn==on) return callback();
//   this.macOn = on;
//   this.at.cmd("mac "+(on?"resume":"pause")+"\r\n",500,callback);
// };

// /// Transmit a message over the radio (not using LoRaWAN)
// E32.prototype.radioTX = function(msg, callback) {
//   var at = this.at;
//   this.setMAC(false, function() {
//     // convert to hex
//     at.cmd("radio tx "+toHex(msg)+"\r\n",2000,callback);
//   });
// };

// /** Transmit a message (using LoRaWAN). Will call the callback with 'null'
// on success, or the error message on failure.

// In LoRa, messages are received right after data is transmitted - if
// a message was received, the 'message' event will be fired, which
// can be received if you added a handler as follows:

// lora.on('message', function(data) { ... });
//  */
// E32.prototype.loraTX = function(msg, callback) {
//   var at = this.at;
//   this.setMAC(true, function() {
//     // convert to hex
//     at.cmd("mac tx uncnf 1 "+toHex(msg)+"\r\n",2000,function(d) {
//       callback((d=="ok")?null:((d===undefined?"Timeout":d)));
//     });
//   });
// };


// /** Receive a message from the radio (not using LoRaWAN) with the given timeout
// in miliseconds. If the timeout is reached, callback will be called with 'undefined' */
// E32.prototype.radioRX = function(timeout, callback) {
//   var at = this.at;
//   this.setMAC(false, function() {
//     at.cmd("radio set wdt "+timeout+"\r\n", 500, function() {
//       at.cmd("radio rx 0\r\n", timeout+500, function cb(d) {
//         if (d=="ok") return cb;
//         if (d===undefined || d.substr(0,10)!="radio_rx  ") { callback(); return; }
//         callback(fromHex(d,10));
//       });
//     });
//   });
// };

exports = E32;
