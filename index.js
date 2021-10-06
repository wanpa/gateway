/****************************************************
  ConMas Gateway Web API Prototype Application
*****************************************************/
const express       = require('express');
const app           = express();
const fs            = require('fs');
const config        = require('config');
const bodyParser    = require('body-parser');
const responseDelay = 300; //暫定Delay
const log4js        = require('log4js');
const os            = require('os');
const path          = require('path');

// ログ出力設定
log4js.configure('config/log4js.json');
const systemlogger = log4js.getLogger();
const accesslogger = log4js.getLogger('access');

systemlogger.info(`ConMas Gateway (Ver.${require('./package.json').version})`);

let port      = config.port; //デフォルトリッスンポート

// コマンド引数でリッスンポート指定された場合
if (process.argv.length > 2) {
  port = process.argv[2];
}

systemlogger.info('ssl:' + config.ssl);
systemlogger.info('authType:' + config.authType);

if (config.ssl) {
  var https = require('https');
  var options = {
    key:  fs.readFileSync(config.sslkey),
    cert: fs.readFileSync(config.sslcert)
  };
  var server = https.createServer(options,app);
}

process.on('unhandledRejection', function(reason, promise) {
  // ここで出力されるエラーは開発時に除去しておくべき
  systemlogger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', function(err, origin) {
  systemlogger.error(`uncaughtException: ${err.stack}\n` +
  `Exception origin: ${origin}`);
  log4js.shutdown(err => {
    // ログ出力を flush して終了。
    // C++実装レベルでのエラーをキャッチした可能性あり。なので続行不可能。
    // ※Node.js 仕様としてもそれを推奨しているので、詳細は "process" を参照のこと。
    // if (err) throw err; // これはやめておく
    process.exit(1);
  });
});

function authChaeck(req, res) {
  const token = req.headers.authorization.replace(/Bearer\s/, '');
  if (config.authType === 'default') {
    if (token === config.token) {
      systemlogger.debug('Authentication success.');
      return true;
    } else {
      systemlogger.warn(`Authentication error. Got as token: ${token}`);
      setTimeout(() => responseSend(res, -1, "Authentication error."), responseDelay);
      return false;
    }
  }
}

app.use(log4js.connectLogger(accesslogger));
app.disable('x-powered-by');

// ===============================================
// POST時のJSONを受け取れるようにする
// ===============================================
// urlencodedとjsonは別々に初期化する
app.use(bodyParser.urlencoded({
  limit:'50mb',
  extended: true
}));
app.use(bodyParser.json({
  limit:'50mb',
  extended: true
}));

const request = require(`request`);
/**
 * リクエスト送信
 * @param {Object} options
 */
function doRequest(options) {
  return new Promise(function (resolve, reject) {
    request(options, function (error, res, body) {
      if (!error && res.statusCode == 200) {
        resolve(body);
      } else {
        reject(error);
      }
    });
  });
}

/**
 * レスポンス送信
 * @param {Object} res - Response
 * @param {Number} code - return code
 * @param {String} description - result description
 * @param {Array} mappings - information for mappings
 * @param {String} details - 主に Error 詳細
 */
function responseSend (res, code, description, mappings, details){
  let obj = {
    result: {
      code: code,
      description: description
    }
  };
  if (mappings) {
    obj.apply = mappings;
  }
  if (details) {
    obj.details = details;
  }
  // 成功時のマッピングやエラー情報がある場合のみログ出力する
  if (mappings || details) {
    systemlogger.debug(obj2str(obj));
  }
  res.send(obj);
}

/**
 * オブジェクトのJSONインデント表示
 * @param {Object} obj
 * @returns JSON文字列
 */
function obj2str(obj) { return JSON.stringify(obj, null, 2); }

// ===============================================
//  POST: Actionファイル更新処理
// ===============================================
app.post('/api/v1/actions/:action?', function(req, res) {

  try {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    //------------------------------------
    // 認証
    //------------------------------------
    if (!authChaeck(req, res)) return;

    fs.writeFileSync(`./actions/` + req.params.action + '.json', JSON.stringify(req.body, null, 2));

    setTimeout(() => responseSend(res, 0, "Success!!!"), responseDelay);
    systemlogger.debug('Success!!!');

  } catch (err) {
    systemlogger.error("API error. : " + os.EOL + err.stack);
    setTimeout(() => responseSend(res, 100, "API error."), responseDelay);
  }

});

// ===============================================
//  GET: Actionファイル返却処理
// ===============================================
app.get('/api/v1/actions/:action?', async function(req, res) {

  try {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    //------------------------------------
    // 認証
    //------------------------------------
    if (!authChaeck(req, res)) return;

    //------------------------------------
    // アクション特定
    //------------------------------------
    systemlogger.debug(req.params.action);

    // アクション設定ファイル読み込み
    let actconf = JSON.parse(fs.readFileSync(`./actions/` + req.params.action + '.json'))
    systemlogger.debug(obj2str(actconf));

    setTimeout(() => res.json(actconf), responseDelay);

    systemlogger.debug('Success!!!');

  } catch (err) {
    systemlogger.error("API error. : " + os.EOL + err.stack);
    setTimeout(() => responseSend(res, 100, "API error."), responseDelay);
  }

});

var fileType = require('file-type');

// ===============================================
var multer = require('multer');
var uuid = require('node-uuid');
var storage = multer.diskStorage({
  // ファイルの保存先を指定
  destination: function (req, file, cb) {
    // console.log("**************************************");
    // console.log(req.rawHeaders.toString());
    // console.log("**************************************");
    // console.log(req.get('Content-Type'));
    let dirName = req.get('Content-Type').split("boundary=")[1].replace(/"/g, "");
    console.log(dirName);

    let uploadPath = './uploads/'
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath)
    }
    uploadPath = uploadPath + dirName; // + uuid.v4();
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath)
    }
    cb(null, uploadPath)
  },
  // ファイル名を指定(オリジナルのファイル名を指定)
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})
var upload = multer({ storage: storage })
// ===============================================


// ===============================================
//  POST: Upload
// ===============================================
//app.post('/api/v1/upload/:action?', function(req, res) {
//app.post('/api/v1/upload/:action?', upload.array('file'), function(req, res) {
app.post('/api/v1/upload/:action?', upload.array('file'), async function(req, res) {

  try {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    //------------------------------------
    // 認証
    //------------------------------------
    if (!authChaeck(req, res)) return;

    //------------------------------------
    // アクション特定
    //------------------------------------
    systemlogger.debug(req.params.action);

    let actconf;    //アクション設定
    let datasource; //データソース種別

    try {
      // アクション設定ファイル読み込み
      actconf = JSON.parse(fs.readFileSync(`./actions/` + req.params.action + '.json'))
      systemlogger.debug(obj2str(actconf));

      datasource = config.datasource.find( (ds) => {
        return (ds.name === actconf.datasource);
      });
    } catch (err) {
      // Action file error.
      systemlogger.error("Action file error. : " + os.EOL + err.stack);
      setTimeout(() => responseSend(res, 200, "Action file error."), responseDelay);
      return;
    }

    // ===============================================
    // console.log(req.headers.toString());
    // console.log(req.files);
    // ===============================================
    //  ファイルタイプチェック
    // ===============================================
    if (config.uploadFileTypes != undefined){
      console.log("File-type check!!!");
      let binList = config.uploadFileTypes.binary.split(';');
      let txtList = config.uploadFileTypes.text.split(';');

      for (let i = 0; i < req.files.length; i++) {
        console.log(req.files[i]);
        let extList;
        let extName;
        let ftype = await fileType.fromFile(req.files[i].path);
        console.log(ftype);
        if (ftype == undefined) {
          extName = path.extname(req.files[i].path).replace('.','');
          extList = txtList;
        } else {
          extName = ftype.ext;
          extList = binList;
        }
        console.log("@" + extName + "@" + extName.length);
        if (!(extList.some(ext => ext == extName) && extName.length > 0)) {
          systemlogger.error(`File-type error. extName: ${extName}`);
          setTimeout(() => responseSend(res, 500, "File-type error."), responseDelay);
          return;
        }
      }
    }

    // let data = JSON.parse(req.body["data"]);
    // console.log(data);

    // ===============================================

    systemlogger.debug('Datasource Type : ' + datasource.type);

    if (datasource.type === 'python') {
      // ===============================================
      // データソース（Python script call）
      // ===============================================

      let params = {"query": req.query, "post":JSON.parse(req.body["data"]), "path": './uploads/' + req.get('Content-Type').split("boundary=")[1].replace(/"/g, "")};
      // for (key in req.query) {
      //   console.log(key);
      //   console.log(req.query[key]);
      //   //let data = {};
      //   params.data.push(req.query[key]);
      // }

      try {
        systemlogger.debug(obj2str(params));
        // console.log(JSON.stringify(params));
        var {PythonShell} = require('python-shell');
        if (config.pythonShell.encoding) {
          process.env.PYTHONIOENCODING = config.pythonShell.encoding // Windows のための冗長な設定。こうしないと encoding 指定が反映されない。
        }
        var pyshell = new PythonShell(actconf.script, config.pythonShell || undefined);
        var imageData;
        pyshell.send(JSON.stringify(params));
        pyshell.on('message', function (message) {
          let result = JSON.parse(message);
          if (result.error.length > 0) {
            systemlogger.error(`Error!!!${os.EOL}${message}`);
            setTimeout(() => responseSend(res, 500, result.error, null, message), responseDelay);
          } else {
            setTimeout(() => responseSend(res, 0, "Success!!!", result.mappings), responseDelay);
            systemlogger.debug('Success!!!');
          }
        });
        pyshell.on("error", function (err) {
          systemlogger.error(`Error!!!${os.EOL}error.traceback: ${err.traceback}`);
          setTimeout(() => responseSend(res, 500, `Script execution error.${os.EOL}error.traceback: ${err.traceback}`), responseDelay);
          return;
        });
      } catch (err) {
        systemlogger.error(`Script error. : ${os.EOL}${err.stack}`);
        setTimeout(() => responseSend(res, 500, "Script error."), responseDelay);
        return;
      }
    } else if (datasource.type === 'static') {
      // ===============================================
      // データソース（Static）
      // ===============================================
      systemlogger.debug(obj2str(actconf.data));
      setTimeout(() => res.json(actconf.data), responseDelay);

    } else if (datasource.type === 'iotdswebapi') {
      // ===============================================
      // データソース（IoT Data Share）
      // ===============================================
      systemlogger.debug("IoT Data Share putvalues API Start. : " + os.EOL);
      //
      let params = {"query": req.query, "post":JSON.parse(req.body["data"]), "path": './uploads/' + req.get('Content-Type').split("boundary=")[1].replace(/"/g, "")};

      try {
        systemlogger.debug(obj2str(params));
        //アクションファイル内の%をコントローラー名、クラスター値を置換
        actconf.params.forEach( prm => {
          if(prm.controller == '%'){
            //systemlogger.debug("prm.controller:" + prm.controller + "\r\n");
            //systemlogger.debug("query.controller:" + params.query.controller + "\r\n");
            prm.controller = prm.controller.replace('%', params.query.controller);
          }
          if(prm.value == '%'){
            params.post.clusters.forEach(val =>{
              //シートNoとクラスターIdが一致した場合に値を変更
              if((Number(prm.sheet) == Number(val.sheetNo)) && (Number(prm.cluster) == Number(val.clusterId))){
                //systemlogger.debug("prm.sheet:" + prm.sheet + "\r\n");
                //systemlogger.debug("prm.cluster:" + prm.cluster + "\r\n");
                //systemlogger.debug("val.sheetNo:" + val.sheetNo + "\r\n");
                //systemlogger.debug("val.clusterId:" + val.clusterId + "\r\n");
                prm.value = Number(prm.value.replace('%', Number(val.value)));
              }
            });
          }
        });
        //
        const requestOptions = {
          url: datasource.url,
          method: datasource.method,
          headers: datasource.headers,
          json: actconf.params
        };

        systemlogger.debug(obj2str(requestOptions));

        let response;
        try {
          response = await doRequest(requestOptions);
        } catch (err) {
          systemlogger.error("IoT Datashare request error. : " + os.EOL + err.stack);
          setTimeout(() => responseSend(res, 500, "IoT Datashare request error."), responseDelay);
          return;
        }
        //------------------------------------
        // 返却データ生成
        //------------------------------------
        // 抽出データをマッピングしてデータ生成
        //systemlogger.debug(actconf.mappings);
        systemlogger.debug(obj2str(actconf.params));
        systemlogger.debug(obj2str(response));
        //書込み失敗の処理
        let target = response.items.find(item => {
          return (item.success === false);
        });
        if (target != undefined) {
          systemlogger.error(`putvalues Error:${os.EOL}${obj2str(response)}`);
          setTimeout(() => responseSend(res, 500, "putvalues Error : \r\n" + JSON.stringify(response)), responseDelay);
          return;
        }
        // 現在時刻をセット
        require('date-utils');
        let now = new Date();
        systemlogger.debug(now);

        setTimeout(() => responseSend(res, 0, ""), responseDelay);
        systemlogger.debug('Success!!!');
        //
        return;
      } catch (err) {
        systemlogger.error("IoT Data Share putvalues API error. : " + os.EOL + err.stack);
        setTimeout(() => responseSend(res, 500, "IoT Data Share putvalues API error."), responseDelay);
        return;
      }
      //
    }
  } catch (err) {
    systemlogger.error("API error. : " + os.EOL + err.stack);
    setTimeout(() => responseSend(res, 100, "API error."), responseDelay);
  }

});

app.get('/api/v1/getselect/:action?', async function(req, res) {

  try {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    //------------------------------------
    // 認証
    //------------------------------------
    if (!authChaeck(req, res)) return;

    //------------------------------------
    // アクション特定
    //------------------------------------
    systemlogger.debug(req.params.action);

    let actconf;    //アクション設定
    let datasource; //データソース種別

    try {
      // アクション設定ファイル読み込み
      actconf = JSON.parse(fs.readFileSync(`./actions/` + req.params.action + '.json'))
      systemlogger.debug(obj2str(actconf));

      datasource = config.datasource.find( (ds) => {
        return (ds.name === actconf.datasource);
      });
    } catch (err) {
      // Action file error.
      systemlogger.error("Action file error. : " + os.EOL + err.stack);
      setTimeout(() => responseSend(res, 200, "Action file error."), responseDelay);
      return;
    }

    systemlogger.debug('Datasource Type : ' + datasource.type);
    if (datasource.type === 'static') {
      // ===============================================
      // データソース（Static）
      // ===============================================
      systemlogger.debug(obj2str(actconf.data));
      setTimeout(() => res.json(actconf.data), responseDelay);

    } else if (datasource.type === 'postgreSQL' || datasource.type === 'postgresSQL') {
      /*
      ・SELECT文実行結果はselectListの_resultプロパティに持つ。
      ・mappings 配列の各要素に selectItems プロパティを追加する
      ・value と item の値を比較することで、selected プロパティを真にセットする。
      */

      // ===============================================
      // データソース（PostgreSQL）
      // ===============================================
      if (actconf.selectList) {
        const { doQuery } = require('./modules/v1/datasource/postgresql');
        for (let act of actconf.selectList) {
          try {
            // クエリ実行
            act._result = await doQuery(datasource, act, req.query, systemlogger);
          } catch (err) {
            systemlogger.error(`Database error.${os.EOL}${err.stack}`);
            setTimeout(() => responseSend(res, 500, "Database error.", null, err.stack), responseDelay);
            return;
          }
        }
      } else {
        systemlogger.error('Action file error.: selectList property not found');
        setTimeout(() => responseSend(res, 200, 'Action file error.', null, 'selectList property not found'), responseDelay);
        return;
      }

      //------------------------------------
      // 返却データ生成
      //------------------------------------
      // 抽出データをマッピングしてデータ生成
      // systemlogger.debug(obj2str(actconf.mappings));

      // mappings の要素の selectItems に対し選択肢として使用する値を割り当てる
      for (let mapping of actconf.mappings) {
        if (mapping.type !== "SetItemsToSelect") {
          continue;
        }
        // selectList が同名の要素を持っているか
        let elm = actconf.selectList.find(e => e.name === mapping.item);

        // Deep copyが必要。そうでないと、selectList 内の同一クエリを参照するものが同じ配列参照を持つことになる。
        // 結果、selected = true の場所が最後の処理で上書きされてしまう。
        //mapping.selectItems = elm ? elm._result : [];
        mapping.selectItems = elm ? JSON.parse(JSON.stringify(elm._result)) : [];
        mapping.selectItems.forEach(e => e.selected = false);

        // デフォルト値のセット
        let def = mapping.selectItems.find(e => e.item === mapping.value);
        if (def) {
          def.selected = true;
        }
      }

      systemlogger.debug(obj2str(actconf.mappings));
      setTimeout(() => responseSend(res, 0, "Success!!!", actconf.mappings), responseDelay);
      systemlogger.debug('Success!!!');

    } else if (datasource.type === 'mssql') {
      // ===============================================
      // データソース（MSSQL）
      // ===============================================
      if (actconf.selectList) {
        const { doQuery } = require('./modules/v1/datasource/mssql');
        for (let act of actconf.selectList) {
          try {
            // クエリ実行
            act._result = await doQuery(datasource, act, req.query, systemlogger);
          } catch (err) {
            systemlogger.error(`Database error: ${err.stack}`);
            setTimeout(() => responseSend(res, 500, "Database error.", null, err.stack), responseDelay);
            return;
          }
        }
      } else {
        systemlogger.error('Action file error.: selectList property not found');
        setTimeout(() => responseSend(res, 200, 'Action file error.', null, 'selectList property not found'), responseDelay);
        return;
      }

      //------------------------------------
      // 返却データ生成
      //------------------------------------
      // 抽出データをマッピングしてデータ生成
      // systemlogger.debug(obj2str(actconf.mappings));

      // mappings の要素の selectItems に対し選択肢として使用する値を割り当てる
      for (let mapping of actconf.mappings) {
        if (mapping.type !== "SetItemsToSelect") {
          continue;
        }
        // selectList が同名の要素を持っているか
        let elm = actconf.selectList.find(e => e.name === mapping.item);

        // Deep copyが必要。そうでないと、selectList 内の同一クエリを参照するものが同じ配列参照を持つことになる。
        // 結果、selected = true の場所が最後の処理で上書きされてしまう。
        //mapping.selectItems = elm ? elm._result : [];
        mapping.selectItems = elm ? JSON.parse(JSON.stringify(elm._result)) : [];
        mapping.selectItems.forEach(e => e.selected = false);

        // デフォルト値のセット
        let def = mapping.selectItems.find(e => e.item === mapping.value);
        if (def) {
          def.selected = true;
        }
      }

      systemlogger.debug(obj2str(actconf.mappings));
      setTimeout(() => responseSend(res, 0, "Success!!!", actconf.mappings), responseDelay);
      systemlogger.debug('Success!!!');

    } else if (datasource.type === 'oracle') {
      // ===============================================
      // データソース（Oracle）
      // ===============================================
      if (actconf.selectList) {
        const { doQuery } = require('./modules/v1/datasource/oracle');
        for (let act of actconf.selectList) {
          try {
            // クエリ実行
            act._result = await doQuery(datasource, act, actconf.mappings, req.query, systemlogger);
          } catch (err) {
            systemlogger.error(`Database error: ${err.stack}`);
            setTimeout(() => responseSend(res, 500, "Database error.", null, err.stack), responseDelay);
            return;
          }
        }
      } else {
        systemlogger.error('Action file error.: selectList property not found');
        setTimeout(() => responseSend(res, 200, 'Action file error.', null, 'selectList property not found'), responseDelay);
        return;
      }

      //------------------------------------
      // 返却データ生成
      //------------------------------------
      // 抽出データをマッピングしてデータ生成
      // systemlogger.debug(obj2str(actconf.mappings));

      // mappings の要素の selectItems に対し選択肢として使用する値を割り当てる
      for (let mapping of actconf.mappings) {
        if (mapping.type !== "SetItemsToSelect") {
          continue;
        }
        // selectList が同名の要素を持っているか
        let elm = actconf.selectList.find(e => e.name === mapping.item);

        // Deep copyが必要。そうでないと、selectList 内の同一クエリを参照するものが同じ配列参照を持つことになる。
        // 結果、selected = true の場所が最後の処理で上書きされてしまう。
        //mapping.selectItems = elm ? elm._result : [];
        mapping.selectItems = elm ? JSON.parse(JSON.stringify(elm._result)) : [];
        mapping.selectItems.forEach(e => e.selected = false);

        // デフォルト値のセット
        let def = mapping.selectItems.find(e => e.item === mapping.value);
        if (def) {
          def.selected = true;
        }
      }

      systemlogger.debug(obj2str(actconf.mappings));
      setTimeout(() => responseSend(res, 0, "Success!!!", actconf.mappings), responseDelay);
      systemlogger.debug('Success!!!');

    } else if (datasource.type === 'mysql') {
      // ===============================================
      // データソース（MySQL）
      // ===============================================
      if (actconf.selectList) {
        const { doQuery } = require('./modules/v1/datasource/mysql');
        for (let act of actconf.selectList) {
          try {
            // クエリ実行
            act._result = await doQuery(datasource, act, req.query, systemlogger);
          } catch (err) {
            systemlogger.error(`Database error: ${err.stack}`);
            setTimeout(() => responseSend(res, 500, "Database error.", null, err.stack), responseDelay);
            return;
          }
        }
      } else {
        systemlogger.error('Action file error.: selectList property not found');
        setTimeout(() => responseSend(res, 200, 'Action file error.', null, 'selectList property not found'), responseDelay);
        return;
      }

      //------------------------------------
      // 返却データ生成
      //------------------------------------
      // 抽出データをマッピングしてデータ生成
      // systemlogger.debug(obj2str(actconf.mappings));

      // mappings の要素の selectItems に対し選択肢として使用する値を割り当てる
      for (let mapping of actconf.mappings) {
        if (mapping.type !== "SetItemsToSelect") {
          continue;
        }
        // selectList が同名の要素を持っているか
        let elm = actconf.selectList.find(e => e.name === mapping.item);

        // Deep copyが必要。そうでないと、selectList 内の同一クエリを参照するものが同じ配列参照を持つことになる。
        // 結果、selected = true の場所が最後の処理で上書きされてしまう。
        //mapping.selectItems = elm ? elm._result : [];
        mapping.selectItems = elm ? JSON.parse(JSON.stringify(elm._result)) : [];
        mapping.selectItems.forEach(e => e.selected = false);

        // デフォルト値のセット
        let def = mapping.selectItems.find(e => e.item === mapping.value);
        if (def) {
          def.selected = true;
        }
      }

      systemlogger.debug(obj2str(actconf.mappings));
      setTimeout(() => responseSend(res, 0, "Success!!!", actconf.mappings), responseDelay);
      systemlogger.debug('Success!!!');

    } else {
      systemlogger.error('Datasource type error. [' + datasource.type + ']');
      res.send({
        result: {
          code: 400,
          description: "Datasource type error."
        }
      });
    }
  } catch (err) {
    systemlogger.error("API error. : \r\n" + err.stack);
    res.send({
      result: {
        code: 100,
        description: "API error."
      }
    });
  }

});

// ===============================================
// GET:/api/v1/getvalue/:action?
// ===============================================
app.get('/api/v1/getvalue/:action?', async function(req, res) {

  try {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    //------------------------------------
    // 認証
    //------------------------------------
    if (!authChaeck(req, res)) return;

    //------------------------------------
    // アクション特定
    //------------------------------------
    systemlogger.debug(req.params.action);

    let actconf;    //アクション設定
    let datasource; //データソース種別

    try {
      // アクション設定ファイル読み込み
      actconf = JSON.parse(fs.readFileSync(`./actions/` + req.params.action + '.json'))
      systemlogger.debug(obj2str(actconf));

      datasource = config.datasource.find( (ds) => {
        return (ds.name === actconf.datasource);
      });
    } catch (err) {
      // Action file error.
      systemlogger.error("Action file error. : \r\n" + err.stack);
      res.send({
        result: {
          code: 200,
          description: "Action file error."
        }
      });
      return;
    }

    systemlogger.debug(datasource);
    if (datasource == undefined) {
      systemlogger.error('Datasource name error. [' + datasource + ']');
      res.send({
        result: {
          code: 300,
          description: "Datasource name error."
        }
      });
      return;
    }

    systemlogger.debug('Datasource Type : ' + datasource.type);

    if (datasource.type === 'static') {
      // ===============================================
      // データソース（Static）
      // ===============================================
      systemlogger.debug(obj2str(actconf.data));
      setTimeout(() => res.json(actconf.data), responseDelay);

    } else if (datasource.type === 'postgreSQL' || datasource.type === 'postgresSQL') {
      // ===============================================
      // データソース（PostgreSQL）
      // ===============================================
      // データ取得SQL生成
      // 設定から基本SQLを取得
      let sql = actconf.basequery;
      if (actconf.basetype === 'file') {
        sql = fs.readFileSync(actconf.basequery, 'utf8');
      }

      let firstStr = ' ';
      let paramCnt = 1;
      let namedParams = {};

      // 固定の条件有無
      if (actconf.where && actconf.where.length > 0) {
        sql += actconf.where;
        firstStr += ' and '
      } else {
        firstStr += ' where '
      }

      // バインド変数があれば withoutParams を真にセットし、params は where 条件に使用しない。
      if (!actconf.withoutParams) {
        // 正規表現は "::text" にはマッチせず、":bind_value" にマッチする
        // ※完全とは言えないものの次善策。
        actconf.withoutParams = /(^|[^:]):\w+/.test(sql);
        //actconf.withoutParams = (sql.indexOf(":") > -1);
      }

      // 可変パラメータ
      for (key in req.query) {
        systemlogger.debug('key=' + key + '  val=' + req.query[key]);

        let sqlParam = actconf.params.find( (param) => {
          return (param.name === key);
        });

        if (sqlParam != undefined) {
          // バインド変数収集
          namedParams[key] = req.query[key];
          if (!actconf.withoutParams) {
            // SQL組立
            sql += firstStr + key + " = :" + key;
            firstStr = ' and ';
          }
        }
      }

      // キャスト
      for (key in namedParams) {
        let bind = actconf.params.find(e => e.name === key);
        if (bind.type === 'string') {
          // 文字列型のキャスト
          sql = sql.replace(new RegExp(`:${key}\\b`, 'g'), `:${key}::text`);
        } else if (bind.type.startsWith('char')) {
          sql = sql.replace(new RegExp(`:${key}\\b`, 'g'), `:${key}::${bind.type}`);
        }
      }
      systemlogger.debug(`Generated SQL: ${sql}`);

      //------------------------------------
      // データ取得
      //------------------------------------
      // DB接続
      const { Client } = require('pg');
      const client = new Client({
        user: datasource.user,
        host: datasource.host,
        database: datasource.database,
        password: datasource.password,
        port: datasource.port,
      });
      client.connect();
      let data;
      try {
        // 検索
        const named = require('yesql').pg;
        data = await client.query(named(sql)(namedParams));
      } catch (err) {
        systemlogger.error("Database error. : " + os.EOL + err.stack);
        setTimeout(() => responseSend(res, 500, "Database error."), responseDelay);
        return;
      }

      // systemlogger.debug(data);
      // systemlogger.debug(data.rows);

      client.end();

      if (data.rows.length < 1) {
        res.send({
          result: {
            code: 1,
            description: "Data not found."
          }
        });
        systemlogger.warn('Data not found.');
        return;
      }

      //------------------------------------
      // 返却データ生成
      //------------------------------------
      // 抽出データをマッピングしてデータ生成
      // systemlogger.debug(obj2str(actconf.mappings));
      actconf.mappings.forEach(mapping => {
        if (mapping.type === 'image') {
          let pgbytea = require('postgres-bytea');
          pgbytea = data.rows[0][mapping.item];
          let base64str = pgbytea.toString('base64');
          mapping.value = base64str;
        }
        else {
          mapping.value = String(data.rows[0][mapping.item]);
        }
      });

      systemlogger.debug(obj2str(actconf.mappings));
      setTimeout(() => responseSend(res, 0, "Success!!!", actconf.mappings), responseDelay);
      systemlogger.debug('Success!!!');

    } else if (datasource.type === 'mssql') {
      // ===============================================
      // データソース（MSSQL）
      // ===============================================
      // データ取得SQL生成
      // 設定から基本SQLを取得
      let sql = actconf.basequery;
      if (actconf.basetype === 'file') {
        sql = fs.readFileSync(actconf.basequery, 'utf8');
      }

      let firstStr = ' ';
      let paramCnt = 1;

      const Connection = require('tedious').Connection;
      const config = {
        server: datasource.host,
        authentication: {
          type: 'default',
          options: {
            userName: datasource.user,
            password: datasource.password
          }
        },
        options: {
          trustServerCertificate: datasource.trustServerCertificate,
          encrypt: datasource.encrypt,
          database: datasource.database
        }
      };
      if (datasource.instanceName) {
        // インスタンス名
        config.options.instanceName = datasource.instanceName;
      }
      if (datasource.port) {
        // ポート指定
        config.options.port = datasource.port;
      }
      systemlogger.debug(obj2str(config));

      const Request = require('tedious').Request;
      const TYPES = require('tedious').TYPES;

      // 固定の条件有無
      if (actconf.where && actconf.where.length > 0) {
        sql += actconf.where;
        firstStr += ' and '
      } else {
        firstStr += ' where '
      }

      // バインド変数があれば withoutParams を真にセットし、params は where 条件に使用しない。
      if (!actconf.withoutParams) {
        // 正規表現は "@@variable" にはマッチせず、"@bind_value" にマッチする
        // ※完全とは言えないものの次善策。
        actconf.withoutParams = /(^|[^@])@\w+/.test(sql);
        //actconf.withoutParams = (sql.indexOf("@") > -1);
      }

      // 可変パラメータ
      for (key in req.query) {
        systemlogger.debug('key=' + key + '  val=' + req.query[key]);

        let sqlParam = actconf.params.find( (param) => {
          return (param.name === key);
        });

        if (sqlParam != undefined) {
          if (!actconf.withoutParams) {
            sql += firstStr + key + " = @" + key;
            firstStr = ' and ';
          }
        }
      }

      systemlogger.debug(`Generated SQL: ${sql}`);
      //systemlogger.debug(`SQL Parameters: ${sqlParam}`);

      let sqlErr = false;
      let connection = new Connection(config);
      connection.on('connect', async function (err) {
        // If no error, then good to proceed.
        if (err) {
          systemlogger.error("Database error. : \r\n" + err.stack);
          res.send({
            result: {
              code: 500,
              description: "Database error."
            }
          });
          return;
        } else {
          systemlogger.debug('Connected');
          try {
            await executeStatement();
          } catch (err) {
            systemlogger.error("Database error. : \r\n" + err.stack);
            sqlErr = true;
            if (connection) { // connection assignment worked, need to close
              connection.close();
            }
            return;
          }
        }
      });

      async function executeStatement() {
        let request = new Request(sql, function (err) {
          if (err) {
            systemlogger.error("Database error. : \r\n" + err.stack);
            sqlErr = true;
            return;
          }
        });
        for (key in req.query) {
          let sqlParam = actconf.params.find((param) => {
            return (param.name === key);
          });

          if (sqlParam != undefined) {
            systemlogger.debug('key=' + key + '  val=' + req.query[key]);
            if (sqlParam.type === 'string') {
              request.addParameter(key, TYPES.NVarChar, req.query[key]);
            }
            else {
              request.addParameter(key, TYPES.Numeric, Number(req.query[key]));
            }
          }
          else {
            systemlogger.debug('undefined');
          }
        }

        let i = 0;
        request.on('row', function (columns) {
          if (i < 1) {
            columns.forEach(function (column) {
              let item = actconf.mappings.find((mapping) => {
                return (mapping.item === column.metadata.colName);
              });
              if (item) {
                let coltype = column.metadata.type.name.toLowerCase();
                if (column.value === null) {
                  item.value = '';
                } else if (item.type === 'image' && (coltype === 'varbinary' || coltype === 'binary' || coltype === 'image')) {
                  item.value = Buffer.from(column.value).toString('base64');
                } else {
                  item.value = String(column.value);
                }
              }
            });
          }
          i++;
        });

        request.on('requestCompleted', function () {
          systemlogger.debug('requestCompleted');
          connection.close();
          if (sqlErr) {
            res.send({
              result: {
                code: 500,
                description: "Database error."
              }
            });
          } else if (i > 0) {
            systemlogger.debug(obj2str(actconf.mappings));
            setTimeout(() => responseSend(res, 0, "Success!!!", actconf.mappings), responseDelay);
            systemlogger.debug('Success!!!');
          } else {
            res.send({
              result: {
                code: 1,
                description: "Data not found."
              }
            });
            systemlogger.warn('Data not found.');
            return;
          }

        });
        connection.execSql(request);
      }
    } else if (datasource.type === 'oracle') {
      // ===============================================
      // データソース（Oracle）
      // ===============================================
      // データ取得SQL生成
      // 設定から基本SQLを取得
      const oracledb = require('oracledb')

      let sql = actconf.basequery;
      if (actconf.basetype === 'file') {
        sql = fs.readFileSync(actconf.basequery, 'utf8');
      }

      let firstStr = ' ';
      let paramCnt = 1;
      let sqlParamValues = {};

      // 固定の条件有無
      if (actconf.where && actconf.where.length > 0) {
        sql += actconf.where;
        firstStr += ' and '
      } else {
        firstStr += ' where '
      }

      // バインド変数があれば withoutParams を真にセットし、params は where 条件に使用しない。
      if (!actconf.withoutParams) {
        // 正規表現は "::text" にはマッチせず、":bind_value" にマッチする
        // ※完全とは言えないものの次善策。
        actconf.withoutParams = /(^|[^:]):\w+/.test(sql);
        //actconf.withoutParams = (sql.indexOf(":") > -1);
      }

      // 可変パラメータ
      for (key in req.query) {
        systemlogger.debug('key=' + key + '  val=' + req.query[key]);

        let sqlParam = actconf.params.find( (param) => {
          return (param.name === key);
        });

        if (sqlParam != undefined) {
          sqlParamValues[key] = { val: req.query[key] };
          if (sqlParam.type) {
            if (sqlParam.type === 'char') {
              sqlParamValues[key].dir = oracledb.BIND_IN;
              sqlParamValues[key].type = oracledb.DB_TYPE_CHAR;
            }
          }

          if (!actconf.withoutParams) {
            if (sqlParam.type && sqlParam.type === 'date') {
              sql += firstStr + key + " = TO_DATE(:" + key + ", '" + sqlParam.format + "')";
            } else {
              sql += firstStr + key + " = :" + key;
            }
            firstStr = ' and ';
          }
        }
      }

      systemlogger.debug(`Generated SQL: ${sql}`);
      systemlogger.debug(`SQL Parameters: ${obj2str(sqlParamValues)}`);

      const config = {
        user: datasource.user,
        password: datasource.password,
        connectString: datasource.connectString
      }

      let data;

      try {
        conn = await oracledb.getConnection(config);

        let options = {};
        options.outFormat = oracledb.OBJECT;

        // LOB は fetch 時にフォーマット指定が必要
        options.fetchInfo = {};
        actconf.mappings.forEach(mapping => {
          let type = mapping.type.toLowerCase();
          if (type === "image" || type === "blob") {
            options.fetchInfo[mapping.item.toUpperCase()] = {type: oracledb.BUFFER}; // BLOB型を想定している
          } else if (type === "clob") { // キャラクタ・ラージ・オブジェクト
            options.fetchInfo[mapping.item.toUpperCase()] = {type: oracledb.STRING};
          }
        });

        data = await conn.execute(sql, sqlParamValues, options);

        //console.log(data.rows[0])

      } catch (err) {
        systemlogger.error("Database error. : \r\n" + err.stack);
        res.send({
          result: {
            code: 500,
            description: "Database error."
          }
        });
        return;
      } finally {
        if (conn) { // conn assignment worked, need to close
          await conn.close()
        }
      }

      if (data.rows.length < 1) {
        res.send({
          result: {
            code: 1,
            description: "Data not found."
          }
        });
        systemlogger.warn('Data not found.');
        return;
      }

      //------------------------------------
      // 返却データ生成
      //------------------------------------
      // 抽出データをマッピングしてデータ生成
      // systemlogger.debug(obj2str(actconf.mappings));
      actconf.mappings.forEach(mapping => {
        if (mapping.type === "string" && data.rows[0][mapping.item.toUpperCase()] === null) {
          mapping.value = '';
        } else {
          if (mapping.type === "image") {
            if (data.rows[0][mapping.item.toUpperCase()]) {
              mapping.value = Buffer.from(data.rows[0][mapping.item.toUpperCase()]).toString("base64");
            } else {
              mapping.value = "";
            }
          } else {
            mapping.value = String(data.rows[0][mapping.item.toUpperCase()]);
          }
        }
      });

      systemlogger.debug(obj2str(actconf.mappings));

      setTimeout(() => responseSend(res, 0, "Success!!!", actconf.mappings), responseDelay);

      systemlogger.debug('Success!!!');

    } else if (datasource.type === 'mysql') {
      // ===============================================
      // データソース (MySQL)
      // ===============================================
      // データ取得SQL生成
      // 設定から基本SQLを取得
      let sql = actconf.basequery;
      if (actconf.basetype === 'file') {
        sql = fs.readFileSync(actconf.basequery, 'utf8');
      }

      let firstStr = ' ';
      let namedParams = {};

      // 固定の条件有無
      if (actconf.where && actconf.where.length > 0) {
        sql += actconf.where;
        firstStr += ' and '
      } else {
        firstStr += ' where '
      }

      // バインド変数があれば withoutParams を真にセットし、params は where 条件に使用しない。
      if (!actconf.withoutParams) {
        // 正規表現は "::text" にはマッチせず、":bind_value" にマッチする
        // ※完全とは言えないものの次善策。
        actconf.withoutParams = /(^|[^:]):\w+/.test(sql);
        //actconf.withoutParams = (sql.indexOf(":") > -1);
      }

      // 可変パラメータ
      for (key in req.query) {
        systemlogger.debug('key=' + key + '  val=' + req.query[key]);

        let sqlParam = actconf.params.find( (param) => {
          return (param.name === key);
        });

        if (sqlParam != undefined) {
          namedParams[key] = req.query[key];
          if (!actconf.withoutParams) {
            sql += firstStr + key + " = :" + key;
            firstStr = ' and ';
          }
        }
      }

      var mysql      = require('mysql');
      var conn = mysql.createConnection({
        user     : datasource.user,
        password : datasource.password,
        host     : datasource.host,
        port     : datasource.port,
        database : datasource.database
      });


      let data;

      try {
        conn.connect((err) => {
          if (err) {
            //console.log('error connecting: ' + err.stack);
            systemlogger.error("Database error. : \r\n" + err.stack);
            res.send({
              result: {
                code: 500,
                description: "Database error."
              }
            });
            return;
          }
          console.log('Success');
          doQuery();
        });

        let doQuery = function () {
          const named = require('yesql').mysql;
          systemlogger.debug(`Generated SQL: ${sql}`);
          sql = named(sql)(namedParams);
          systemlogger.debug(`Converted SQL: ${obj2str(sql)}`);
          conn.query(sql,
            (err, results) => {
              if (err) {
                systemlogger.error("Database error. : \r\n" + err.stack);
                res.send({
                  result: {
                    code: 500,
                    description: "Database error."
                  }
                });
                return;
              }
              data = results;
              console.log(data);

              if (!data || data.length < 1) {
                res.send({
                  result: {
                    code: 1,
                    description: "Data not found."
                  }
                });
                systemlogger.warn('Data not found.');
                return;
              } else {
                // 2度レスポンスを返して落ちないよう、データがあるときにのみ実行する
                setTimeout(() => responseSend(res, 0, "Success!!!", actconf.mappings), responseDelay);
              }

              //------------------------------------
              // 返却データ生成
              //------------------------------------
              // 抽出データをマッピングしてデータ生成
              systemlogger.debug(obj2str(actconf.mappings));
              actconf.mappings.forEach(mapping => {
                if (mapping.type === 'image') {
                  // Binary系であればライブラリ内部でBufferにキャストして返してくるので、mapping.type のみで判定している
                  mapping.value = data[0][mapping.item].toString('base64');
                } else {
                  mapping.value = String(data[0][mapping.item]);
                }
              });
            });
        };

        //console.log(data.rows[0])

      } catch (err) {
        systemlogger.error(`Database error: ${err.stack}`);
        setTimeout(() => responseSend(res, 500, "Database error.", null, err.stack), responseDelay);
        return;
      } finally {
        // if (conn) { // conn assignment worked, need to close
        //   conn.close()
        // }
      }


      systemlogger.debug(obj2str(actconf.mappings));

      systemlogger.debug('Success!!!');

    } else if (datasource.type === 'iotdswebapi') {
      // ===============================================
      // データソース（DataShare Web API）
      // ===============================================
      // 自己証明証明書の許可
      if (datasource.self_signed_certificate) {
        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
      }

      const requestOptions = {
        url: datasource.url,
        method: datasource.method,
        headers: datasource.headers,
        json: actconf.params
      };

      systemlogger.debug(obj2str(requestOptions));

      let response;
      try {
        response = await doRequest(requestOptions);
      } catch (err) {
        systemlogger.error("IoT Datashare request error. : " + os.EOL + err.stack);
        setTimeout(() => responseSend(res, 500, "IoT Datashare request error.", null, err.stack), responseDelay);
        return;
      }

      //------------------------------------
      // 返却データ生成
      //------------------------------------
      // 抽出データをマッピングしてデータ生成
      // systemlogger.debug(actconf.mappings);
      systemlogger.debug(obj2str(response));

      response.items.filter( item => {return item.success === true}
      ).forEach(item => {
        let target = actconf.mappings.find(mapping => {
          return (mapping.controller === item.controller && mapping.item === item.item);
        });
        if (target != undefined) target.value = String(item.value);

      });

      // 現在時刻をセット
      require('date-utils');
      let now = new Date();
      systemlogger.debug(now);

      actconf.mappings.filter( mapping => {return (mapping.controller.length < 1 && mapping.item === 'update_time')}
      ).forEach(updateTime => {
        updateTime.value = now.toFormat(updateTime.format);
      });

      systemlogger.debug(obj2str(actconf.mappings));
      setTimeout(() => responseSend(res, 0, "Success!!!", actconf.mappings), responseDelay);
      systemlogger.debug('Success!!!');

    } else if (datasource.type === 'kintone') {
      // ===============================================
      // データソース（DataShare Web API）
      // ===============================================
      // 自己証明証明書の許可
      if (datasource.self_signed_certificate) {
        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
      }

      let exUri = actconf.uri
      for (key in req.query) {
        console.log('key=' + key + '  val=' + req.query[key]);
        exUri = exUri.replace('{'+ key +'}', req.query[key])
      }

      const requestOptions = {
        url: datasource.url + exUri,
        method: datasource.method,
        headers: datasource.headers
      };

      systemlogger.debug(obj2str(requestOptions));

      let response;
      try {
        response = await doRequest(requestOptions);
      } catch (err) {
        systemlogger.error("IoT Datashare request error. : " + os.EOL + err.stack);
        setTimeout(() => responseSend(res, 500, "IoT Datashare request error."), responseDelay);
        return;
      }

      //------------------------------------
      // 返却データ生成
      //------------------------------------
      // 抽出データをマッピングしてデータ生成
      // systemlogger.debug(obj2str(actconf.mappings));
      systemlogger.debug(obj2str(response));

      const record = JSON.parse(response).record;
      for (let item in record) {
        let target = actconf.mappings.find(mapping => {
          return (mapping.item === item);
        });
        if (target != undefined) target.value = String(record[item]["value"]);
      }

      systemlogger.debug(obj2str(actconf.mappings));
      setTimeout(() => responseSend(res, 0, "Success!!!", actconf.mappings), responseDelay);
      systemlogger.debug('Success!!!');

    } else if (datasource.type === 'python') {
      // ===============================================
      // データソース（Python script call）
      // ===============================================

      let params = {"data": []};
      for (key in req.query) {
        console.log(key);
        console.log(req.query[key]);
        //let data = {};
        params.data.push(req.query[key]);
      }

      try {
        systemlogger.debug(obj2str(params));
        var {PythonShell} = require('python-shell');
        if (config.pythonShell.encoding) {
          process.env.PYTHONIOENCODING = config.pythonShell.encoding // Windows のための冗長な設定。こうしないと encoding 指定が反映されない。
        }
        var pyshell = new PythonShell(actconf.script, config.pythonShell || undefined);
        var imageData;
        pyshell.send(JSON.stringify(params));
        pyshell.on('message', function (message) {
          console.log(message);
          let result = JSON.parse(message);
          if (result.error.length > 0) {
            systemlogger.debug('Error!!!');
            setTimeout(() => responseSend(res, 500, result.error), responseDelay);
          } else {
            setTimeout(() => responseSend(res, 0, "Success!!!", JSON.parse(message).mappings), responseDelay);
            systemlogger.debug('Success!!!');
          }
        });
        pyshell.on("error", function (err) {
          console.dir(err);
          systemlogger.error(`Script execution error: ${err.stack}`);
          setTimeout(() => responseSend(res, 500, `Script execution error.${os.EOL}error.traceback: ${err.traceback}`), responseDelay);
          return;
        });
      } catch (err) {
        systemlogger.error("Script error. : " + os.EOL + err.stack);
        setTimeout(() => responseSend(res, 500, "Script error."), responseDelay);
        return;
      }


    } else if (datasource.type === 'chartgen') {
      // ===============================================
      // データソース（Chart Generate）
      // ===============================================
      var chartData = {"data": [
        {"x": req.query['x1'], "y": Number(req.query['y1'])},
        {"x": req.query['x2'], "y": Number(req.query['y2'])},
        {"x": req.query['x3'], "y": Number(req.query['y3'])},
        {"x": req.query['x4'], "y": Number(req.query['y4'])},
        {"x": req.query['x5'], "y": Number(req.query['y5'])}
      ]};
      systemlogger.debug(obj2str(chartData));
      var {PythonShell} = require('python-shell');
      if (config.pythonShell.encoding) {
        process.env.PYTHONIOENCODING = config.pythonShell.encoding // Windows のための冗長な設定。こうしないと encoding 指定が反映されない。
      }
      var pyshell = new PythonShell(actconf.script, config.pythonShell || undefined);
      var imageData;
      pyshell.send(JSON.stringify(chartData));
      pyshell.on('message', function (message) {
        let fs = require('fs');
        fs.readFile(message, 'base64', function(err, data) {
          if (err) {
            return systemlogger.error(err.stack);
          }
          systemlogger.debug(obj2str(data));
          actconf.mappings[0].value = data;
          setTimeout(() => responseSend(res, 0, "Success!!!"), responseDelay);
          systemlogger.debug('Success!!!');
        });
      });
      pyshell.on("error", function (err) {
        console.dir(err);
        systemlogger.debug('Error!!!', err);
        setTimeout(() => responseSend(res, 500, `Script execution error.${os.EOL}error.traceback: ${err.traceback}`), responseDelay);
      });
    } else {
      systemlogger.error('Datasource type error. [' + datasource.type + ']');
      setTimeout(() => responseSend(res, 400, "Datasource type error."), responseDelay);
    }

  } catch (err) {
    systemlogger.error("API error. : \r\n" + err.stack);
    setTimeout(() => responseSend(res, 100, "API error."), responseDelay);
  }
});

app.get('/api/v1/getvalue/:action/:controller?', async function(req, res) {

  try {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    //------------------------------------
    // 認証
    //------------------------------------
    if (!authChaeck(req, res)) return;

    //------------------------------------
    // アクション特定
    //------------------------------------
    systemlogger.debug(req.params.action);

    // アクション設定ファイル読み込み
    let actconf = JSON.parse(fs.readFileSync(`./actions/` + req.params.action + '.json'))
    systemlogger.debug(obj2str(actconf));

    let datasource = config.datasource.find( (ds) => {
      return (ds.name === actconf.datasource);
    });

    // ===============================================
    // データソース（DataShare Web API）
    // ===============================================
    if (datasource.type === 'iotdswebapi') {

      // 自己証明証明書の許可
      if (datasource.self_signed_certificate) {
        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
      }

      // Controller 設定
      actconf.params.forEach( prm => {
        prm.controller = prm.controller.replace('%', req.params.controller);
      });

      actconf.mappings.forEach( map => {
        map.controller = map.controller.replace('%', req.params.controller);
      });

      const requestOptions = {
        url: datasource.url,
        method: datasource.method,
        headers: datasource.headers,
        json: actconf.params
      };

      systemlogger.debug(obj2str(requestOptions));

      let response;
      try {
        response = await doRequest(requestOptions);
      } catch (err) {
        systemlogger.error("IoT Datashare request error. : \r\n" + err.stack);
        setTimeout(() => responseSend(res, 500, "IoT Datashare request error."), responseDelay);
        return;
      }

      //------------------------------------
      // 返却データ生成
      //------------------------------------
      // 抽出データをマッピングしてデータ生成
      // systemlogger.debug(obj2str(actconf.mappings));
      systemlogger.debug(obj2str(response));

      response.items.filter( item => {return item.success === true}
      ).forEach(item => {
        let target = actconf.mappings.find(mapping => {
          return (mapping.controller === item.controller && mapping.item === item.item);
        });
        if (target != undefined) target.value = String(item.value);

      });

      // 現在時刻をセット
      require('date-utils');
      let now = new Date();
      systemlogger.debug(now);

      actconf.mappings.filter( mapping => {return (mapping.controller.length < 1 && mapping.item === 'update_time')}
      ).forEach(updateTime => {
        updateTime.value = now.toFormat(updateTime.format);
      });

      systemlogger.debug(obj2str(actconf.mappings));
      setTimeout(() => responseSend(res, 0, "Success!!!", actconf.mappings), responseDelay);
      systemlogger.debug('Success!!!');

    } else {
      systemlogger.error('Datasource type error. [' + datasource.type + ']');
      setTimeout(() => responseSend(res, 400, "Datasource type error."), responseDelay);
    }

  } catch (err) {
    systemlogger.error("API error. : \r\n" + err.stack);
    setTimeout(() => responseSend(res, 100, "API error."), responseDelay);
  }

});


if (config.ssl) {
  server.listen(port, () => systemlogger.info('Listening on port : ' + port));
} else {
  app.listen(port, () => systemlogger.info('Listening on port : ' + port));
}

