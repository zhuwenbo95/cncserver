/*jslint node: true */
"use strict";

/**
 * @file Abstraction module for all IPC related code for CNC Server!
 *
 */

module.exports = function(cncserver) {
  var ipc = require('node-ipc');       // Inter Process Comms for runner.
  var runnerInitCallback = null;       // Placeholder for init set callback.
  cncserver.ipc = {
    runnerSocket: {} // The IPC socket for communicating to the runner
  };

  // IPC server config.
  ipc.config.id = 'cncserver';
  ipc.config.retry = 1500;

  /**
   * Send a message to the runner.
   *
   * @param  {string} command
   *   The string identifier for the command in dot notation.
   * @param  {object/string} data
   *   Data to be sent message receiver on client.
   * @param  {object} socket
   *   The IPC socket to send to, defaults to initial connect socket.
   *
   * @return {null}
   */
  cncserver.ipc.sendMessage = function(command, data, socket) {
    if (typeof socket === 'undefined') {
      socket = cncserver.ipc.runnerSocket;
    }

    var packet = {
      command: command,
      data: data
    };

    ipc.server.emit(socket, 'app.message', packet);
  };


  /**
   * Initialize and start the IPC server
   *
   * @param  {Function} callback
   *   Function called when the runner is connected and ready.
   *
   * @return {null}
   */
  cncserver.ipc.initServer = function(callback) {
    runnerInitCallback = callback;

    // Initialize and start the IPC Server...
    ipc.serve(function(){
      ipc.server.on('app.message', ipcGotMessage);
    });

    ipc.server.start();
    console.log('Starting IPC server, waiting for runner client to start...');
  };

  /**
   * IPC Message callback event parser/handler.
   *
   * @param  {object} packet
   *   The entire message object directly from the event.
   * @param  {object} socket
   *   The originating IPC client socket object.
   *
   * @return {null}
   */
  function ipcGotMessage(packet, socket) {
    var serialCallbacks = cncserver.serial.callbacks;
    var data = packet.data;

    switch(packet.command) {
      case "runner.ready":
        cncserver.ipc.runnerSocket = socket;
        // TODO: Send config data packet.

        if (runnerInitCallback) runnerInitCallback();
        break;
      case "serial.connected":
        console.log(
          'Serial connection open at ' +
          cncserver.botConf.get('controller').baudRate + 'bps'
        );
        cncserver.pen.simulation = 0;

        if (serialCallbacks.connect) serialCallbacks.connect(data);
        if (serialCallbacks.success) serialCallbacks.success(data);
        break;
      case "serial.disconnected":
        if (serialCallbacks.disconnect) serialCallbacks.disconnect(data);
        break;
      case "serial.error":
        if (packet.type === 'connect') {
          console.log(
            "Serial port failed to connect. Is it busy or in use? Error #10"
          );
          console.log('SerialPort says:', packet.message);
          if (serialCallbacks.complete) serialCallbacks.complete(data);
        } else {
          // TODO: Add better error message here, or figure out when this
          // happens.
          console.log("Serial failed to send data. Error #44");
        }

        if (serialCallbacks.error) serialCallbacks.error(data);
       break;
      case "serial.data":
        if (data.trim() !== cncserver.botConf.get('controller').ack) {
          console.error('Message From Controller: ' + data);

          // Assume error was on startup, and resend setup.
          cncserver.serial.localTrigger('botInit');
        }
        break;
      case "buffer.itemdone":
        // Increment an item off the buffer.
        cncserver.buffer.removeItem(data);
        break;
      case "buffer.empty":
        // TODO: Is this needed?
        break;
      case "buffer.running":
        cncserver.buffer.running = data;
        break;
    }
  }

};
