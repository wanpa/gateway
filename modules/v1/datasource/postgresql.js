/**
 * PostgreSQL DB操作処理
 */
const fs = require('fs');
const { Client } = require('pg');
let client = null;

/**
 * 検索処理 doQuery
 * @param {Object} datasource - connection information
 * @param {Object} query - has basequery(required). basetype, where, params are optional.
 * @param {Object} reqQuery - Request.query
 * @returns {Array} 正常時:Object配列、異常時:Error Object
 */
let doQuery = function(datasource, query, reqQuery, systemlogger) {
  if (!systemlogger) {
    systemlogger = console;
  }
  return new Promise(function (resolve, reject) {
    // SELECT文の条件が無い部分(basequery)
    let sql = '';
    if (query.basetype === 'file') {
      sql = fs.readFileSync(query.basequery, 'utf8');
    } else {
      sql = query.basequery;
    }

    let firstStr = ' ';
    let namedParams = {};

    // 固定の条件有無
    if (query.where && query.where.length > 0) {
      sql += query.where;
      firstStr += ' and '
    } else {
      firstStr += ' where '
    }

    // バインド変数があれば withoutParams を真にセットし、params は where 条件に使用しない。
    if (!query.withoutParams) {
      // 正規表現は "::text" にはマッチせず、":bind_value" にマッチする
      // ※完全とは言えないものの次善策。
      query.withoutParams = /(^|[^:]):\w+/.test(sql);
      //query.withoutParams = (sql.indexOf(":") > -1);
    }

    // 可変パラメータ
    for (key in reqQuery) {
      systemlogger.debug('key=' + key + '  val=' + reqQuery[key]);

      let sqlParam = query.params.find( (param) => {
        return (param.name === key);
      });

      if (sqlParam != undefined) {
        // バインド変数収集
        namedParams[key] = reqQuery[key];
        if (!query.withoutParams) {
          // SQL組立
          sql += firstStr + key + " = :" + key;
          firstStr = ' and ';
        }
      }
    }

    // キャスト
    for (key in namedParams) {
      let bind = query.params.find(e => e.name === key);
      if (bind.type === 'string') {
        // 文字列型のキャスト
        sql = sql.replace(new RegExp(`:${key}\\b`, 'g'), `:${key}::text`);
      } else if (bind.type.startsWith('char')) {
        sql = sql.replace(new RegExp(`:${key}\\b`, 'g'), `:${key}::${bind.type}`);
      }
    }
    systemlogger.debug(`Generated SQL: ${sql}`);
    systemlogger.debug(`SQL Parameters: ${JSON.stringify(namedParams)}`);

    // 実行
    //------------------------------------
    // データ取得
    //------------------------------------
    client = new Client({
      user: datasource.user,
      host: datasource.host,
      database: datasource.database,
      password: datasource.password,
      port: datasource.port,
    });

    // DB接続
    client.connect().then(() => {
      // 検索
      const named = require('yesql').pg;
      return client.query(named(sql)(namedParams));
    }).then((data) => {
      client.end(err => {
        systemlogger.debug('Client has disconnected');
        if (err) {
          systemlogger.error('Error during disconnection', err.stack);
          reject(Error(err.message));
        }
        resolve(data.rows);
      });
    }).catch((err) => {
      systemlogger.error(err.stack);
      reject(Error(err.message));
    }).finally(() => {
      if (client) {
        client.end()
      }
    });
  });
};

module.exports = { doQuery };
