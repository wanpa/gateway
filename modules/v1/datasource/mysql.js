/**
 * MySQL DB操作処理
 */
const fs = require('fs');
const mysql = require('mysql');
const util = require('util');

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
  let conn = mysql.createConnection({
    user     : datasource.user,
    password : datasource.password,
    host     : datasource.host,
    port     : datasource.port,
    database : datasource.database
  });

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
        namedParams[key] = reqQuery[key];
        if (!query.withoutParams) {
          sql += firstStr + key + " = :" + key;
          firstStr = ' and ';
        }
      }
    }

    systemlogger.debug(`Generated SQL: ${sql}`);
    systemlogger.debug(`SQL Parameters: ${JSON.stringify(namedParams)}`);

    // ※mysql module のメソッドは callback 形式のメソッドだが、util.promisify で Promise にしてから扱っている。
    // というのは、callback 形式は特にエラー処理が抜けやすく保守が難しいため。
    // mysql2 module だと mysql と同じAPIでPromiseを提供しているそうだが、単に以前から使用しているのでそのままmysqlを使用している。
    util.promisify(conn.connect).bind(conn)()
      .then(_ => {
        systemlogger.debug(`connected as id ${conn.threadId}`);

        const named = require('yesql').mysql;
        sql = named(sql)(namedParams);
        systemlogger.debug(`Converted SQL: ${JSON.stringify(sql)}`);
        return util.promisify(conn.query).bind(conn)(sql);
      })
      .then(function(rows) {
        if (!rows || rows.length < 1) {
          resolve([]);
        } else {
          // 列名が大文字・小文字混在するので、小文字へ変換する
          let arr = [];
          for (let row of rows) {
            let obj = {};
            for (let colname in row) {
              obj[colname.toLowerCase()] = row[colname];
            }
            arr.push(obj);
          }
          resolve(arr);
        }
      })
      .catch(function(err) {
        reject(Error(err.message));
      })
      .finally(_ => {
        if (!conn) return;
        util.promisify(conn.end).bind(conn)()
          .then(_ => {
            systemlogger.debug('Client has disconnected');
          })
          .catch(function (err) {
            systemlogger.error('Error during disconnection', err.stack);
            conn.destroy();
            //reject(Error(err.message));
            return; // 後始末しようがないのでただ返す
          });
      });
    });
};

module.exports = { doQuery };
