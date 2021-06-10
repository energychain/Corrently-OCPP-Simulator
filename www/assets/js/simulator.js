$( document ).ready(function() {
  function updateReading() {
    $.getJSON("https://openmeter.discovergy.com/public/v1/last_reading?meterId=gAAAAABgweArYEenb7mZW7CG284ahZtWTHV-CzaT_ck-IvtiLfjZDGujV-XZX0ya91_DHb0S2yV2l58rilHjPm5cEe-kdgY_vcBvvBWy6bx1-Pn42pdl7Wm45bQgSGaRDQdlH2zHP7QB&nonece="+new Date().getTime(),function(data) {
      $('#reading').val(Math.round(data.values.energy/100000));
      $('#timeReading').html(new Date(data.time).toLocaleString());
      sessionStorage.setItem('LastAction', "MeterValues");
      var val = $("#reading").val();
      var MV = JSON.stringify([2, id, "MeterValues", {"connectorId": 1, "transactionId": ssid, "meterValue": [{"timestamp": formatDate(new Date()), "sampledValue": [{"value": val}]}]}]);
      _websocket.send(MV);
    });
  }

  $('#kwh1').click(function() {
      $('#bezug').val(($('#bezug').val()*1) + (1000 *1));
      $('#reading').val(($('#reading').val()*1) + (1000 *1));
  });

  updateReading();

  var c = 0;
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var id = randomId();
  var _websocket = null;
  var connector_locked = false;

  function formatDate(date) {
      var day = String(date.getDate());
      if (day.length <2){
          day = ('0' + day.slice(-2));
      }

      var monthIndex = String(date.getMonth()+1);
      if (monthIndex.length <2){
          monthIndex = ('0' + monthIndex.slice(-2));
      }
      var year = date.getFullYear();
      var h = date.getHours();
      var m = String(date.getMinutes());
      var s = String(date.getSeconds());
      if (h.length <2){
          h = ('0' + h.slice(-2));
      }
      if (m.length <2){
          m = ('0' + m.slice(-2));
      }
      if (s.length <2){
          s = ('0' + s.slice(-2));
      }
      return year + '-' + monthIndex + '-' + day+"T"+h+":"+m+":"+s+"Z";
  }

  function randomId() {
      id = "";
      for (var i = 0; i < 36; i++) {
          id += possible.charAt(Math.floor(Math.random() * possible.length));
      }
      return id;
  }

  function wsConnect() {
      var wsurl = $('select').val();
      var CP = $('#CP').val();

      if (_websocket) {
          $('#red').show();
          _websocket.close(3001);
      } else {
          _websocket = new WebSocket(wsurl + "" + CP, ["ocpp1.6", "ocpp1.5"]);
          _websocket.onopen = function (authorizationData) {

              sessionStorage.setItem('LastAction', "BootNotification");
              $('#yellow').show();
              BootNotification();
              updateReading();
              $('#connect').text('Disconnect').css('background', 'green');

          };

          _websocket.onmessage = function (msg) {
              c++;
              var ddata = (JSON.parse(msg.data));

              if(c==1){
                  var hb_interval = handleData(ddata);
                  sessionStorage.setItem("Configuration",hb_interval);
                  startHB(hb_interval*1000);
              }

              if (ddata[0] === 3) {
                  la = getLastAction();

                  if (la == "startTransaction"){

                      ddata = ddata[2];
                      logMsg("Data exchange successful!");
                      var array = $.map(ddata, function (value, index) {
                          return [value];
                      });
                      var TransactionId = (array[0]);
                      sessionStorage.setItem('TransactionId', TransactionId);

                  }
                  logMsg("Response: " + JSON.stringify(ddata[2]));
              } else if ((JSON.parse(msg.data))[0] === 4) {
                  logMsg("Data exchange failed - JSON is not accepted!");
              } else if ((JSON.parse(msg.data))[0] === 2) {
                  logMsg((JSON.parse(msg.data))[2]);
                  id = (JSON.parse(msg.data))[1];

                  switch (ddata[2]) {
                      case "Reset":
                          //Reset type SOFT, HARD
                          var ResetS = JSON.stringify([3, id, {"status": "Accepted"}]);
                          _websocket.send(ResetS);
                          location.reload();
                          break;
                      case "RemoteStopTransaction":
                          //TransactionID
                          var remStp = JSON.stringify([3, id, {"status": "Accepted"}]);
                          _websocket.send(remStp);

                          var stop_id = (JSON.parse(msg.data)[3].transactionId);

                          stopTransaction(stop_id);
                          $('.indicator').hide();
                          $('#yellow').show();
                          break;
                      case "RemoteStartTransaction":
                          //Need to get idTag, connectorId (map - ddata[3])

                          var remStrt = JSON.stringify([3, id, {"status": "Accepted"}]);
                          _websocket.send(remStrt);
                          startTransaction();

                          break;
                      case "UnlockConnector": /////////ERROR!!!!!!!!
                          //connectorId
                          var UC = JSON.stringify([3, id, {"status": "Accepted"}]);
                          _websocket.send(UC);
                          // connector_locked = false;
                          // $('.indicator').hide();
                          //$('#yellow').show();
                          //logMsg("Connector status changed to: "+connector_locked);
                          break;
                      default:
                          var error = JSON.stringify([4, id]);
                          _websocket.send(error);
                          break;
                  }
              }
          };

          _websocket.onclose = function (evt) {
              $('#connect').text('Connect').css('background', '#369');
              if (evt.code == 3001) {
                  logMsg('ws closed');
                  _websocket = null;
              } else {
                  logMsg('ws connection error: ' + evt.code);
                  $('#console').html("");
                  _websocket = null;
                  wsConnect();
              }
          };

          _websocket.onerror = function (evt) {
              if (_websocket.readyState == 1) {
                  $('#red').show();
                  logMsg('ws normal error: ' + evt.type);
              }
          };
      }
  }

  function logMsg(err) {
      console.log(err);
      $('#console').append('<li>' + err + '</li>');
  }

  function Authorize(){
      sessionStorage.setItem('LastAction', "Authorize");
      var Auth = JSON.stringify([2, id, "Authorize", {"idTag": $("#TAG").val()}]);
      _websocket.send(Auth);
  }

  function startTransaction(){
      sessionStorage.setItem('LastAction', "startTransaction");
      $('.indicator').hide();
      $('#green').show();
      connector_locked = true;
      logMsg("Connector status changed to: " + connector_locked);
      var strtT = JSON.stringify([2, id, "StartTransaction", {
          "connectorId": 2,
          "idTag": $("#TAG").val(),
          "timestamp": formatDate(new Date()),
          "meterStart": $('#reading').val(),
          "reservationId": 0
      }]);
      _websocket.send(strtT);
  }

  function stopTransaction(transaction_id = false){
      sessionStorage.setItem('LastAction', "stopTransaction");
      transaction_id == false ? ssid = sessionStorage.getItem('TransactionId') : ssid = transaction_id;
      $('.indicator').hide();
      connector_locked = false;
      logMsg("Connector status changed to: " + connector_locked);
      $('#yellow').show();
      var stpT = JSON.stringify([2, id, "StopTransaction",{
          "transactionId": ssid,
          "idTag": $("#TAG").val(),
          "timestamp": formatDate(new Date()),
          "meterStop": $('#reading').val()
      }]);
      _websocket.send(stpT);
  }

  function handleData(data, request = false){
      var lastAction = getLastAction();
      if(lastAction = "BootNotification"){
          data = data[2];
          heartbeat_interval = data.interval;
          return heartbeat_interval;
      }else if(lastAction = "StartTransaction"){
          return "StartTransaction";
      }else if (1==2){
          alert("else");
      }
  }

  function getLastAction(){
      var LastAction = sessionStorage.getItem("LastAction");
      return LastAction;
  }

  function BootNotification(){
      var BN = JSON.stringify([2, id, "BootNotification", {
          "chargePointVendor": "AVT-Company",
          "chargePointModel": "AVT-Express",
          "chargePointSerialNumber": "avt.001.13.1",
          "chargeBoxSerialNumber": "avt.001.13.1.01",
          "firmwareVersion": "0.9.87",
          "iccid": "",
          "imsi": "",
          "meterType": "AVT NQC-ACDC",
          "meterSerialNumber": "avt.001.13.1.01"
      }]);

      logMsg('ws connected');

      _websocket.send(BN);
  }

  function startHB(interval){
      logMsg("Setting heartbeat interval to "+interval);
      setInterval(send_heartbeat,interval);
  }

  function send_heartbeat() {
      sessionStorage.setItem('LastAction', "Heartbeat");
      var HB = JSON.stringify([2, id, "Heartbeat", {}]);
      _websocket.send(HB);
  }


    $('.indicator').hide();
    $('#red').show();

    //bind controls
    $('#connect').click(function () {
        $('.indicator').hide();
        $('#console').html("");
        wsConnect();
    });

    $('#send').click(function () {
        Authorize();
    });

    $('#start').click(function () {
        startTransaction();
    });

    $('#stop').click(function () {
        stopTransaction();
    });

    $('#mv').click(function () {
        sessionStorage.setItem('LastAction', "MeterValues");
        var val = $("#reading").val();
        var MV = JSON.stringify([2, id, "MeterValues", {"connectorId": 1, "transactionId": ssid, "meterValue": [{"timestamp": formatDate(new Date()), "sampledValue": [{"value": val}]}]}]);
        _websocket.send(MV);

    });
    $('#heartbeat').click(function () {
        send_heartbeat();
    });

    $('#status').click(function () {
        sessionStorage.setItem('LastAction', "StatusNotification");
        var SN = JSON.stringify([2, id, "StatusNotification", {
            "connectorId": 2,
            "status": "Available",
            "errorCode": "NoError",
            "info": "",
            "timestamp": formatDate(new Date()),
            "vendorId": "",
            "vendorErrorCode": ""
        }]);
        _websocket.send(SN);
    });

    $('#data_transfer').click(function () {
        sessionStorage.setItem('LastAction', "DataTransfer");
        var DT = JSON.stringify([2, id, "DataTransfer", {
            "vendorId": "rus.avt.cp",
            "messageId": "GetChargeInstruction",
            "data": ""
        }]);
        _websocket.send(DT);
    });

    $('#connect').on('change', function () {
        if (_websocket) {
            _websocket.close(3001);
        }
    });
});
