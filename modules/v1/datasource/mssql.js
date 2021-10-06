/**
 * SQL Server DB操作処理
 */
const fs = require('fs');

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
    // 固定の条件有無
    if (query.where && query.where.length > 0) {
      sql += query.where;
      firstStr += ' and '
    } else {
      firstStr += ' where '
    }

    // バインド変数があれば withoutParams を真にセットし、params は where 条件に使用しない。
    if (!query.withoutParams) {
      // 正規表現は "@@variable" にはマッチせず、"@bind_value" にマッチする
      // ※完全とは言えないものの次善策。
      query.withoutParams = /(^|[^@])@\w+/.test(sql);
      //query.withoutParams = (sql.indexOf("@") > -1);
    }

    // 可変パラメータ
    for (key in reqQuery) {
      systemlogger.debug('key=' + key + '  val=' + reqQuery[key]);

      let sqlParam = query.params.find((param) => {
        return (param.name === key);
      });

      if (sqlParam != undefined) {
        if (!query.withoutParams) {
          sql += firstStr + key + " = @" + key;
          firstStr = ' and ';
        }
      }
    }

    systemlogger.debug(`Generated SQL: ${sql}`);

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

    const Request = require('tedious').Request;
    const TYPES = require('tedious').TYPES;

    let connection = new Connection(config);
    connection.on('connect', async function (err) {
      // If no error, then good to proceed.
      if (err) {
        systemlogger.error("Database error. : \r\n" + err.stack);
        reject(Error(err.message));
      } else {
        try {
          await executeStatement(sql);
        } catch (err) {
          systemlogger.error("Database error. : \r\n" + err.stack);
          if (connection) { // connection assignment worked, need to close
            connection.close();
          }
          reject(Error(err.message));
        }
      }
    });

    /**
     * SQLを実行し結果を返す
     * @param {String} sql - 実行するSELECT文
     * @returns {void}
     */
    async function executeStatement(sql) {
      let request = new Request(sql, function (err) {
        if (err) {
          systemlogger.error("SQL execution error : \r\n" + err.stack);
          reject(Error(err.message));
        }
      });
      // バインド変数作成
      for (key in reqQuery) {
        let sqlParam = query.params.find((param) => {
          return (param.name === key);
        });

        if (sqlParam != undefined) {
          systemlogger.debug('key=' + key + '  val=' + reqQuery[key]);
          if (sqlParam.type === 'string') {
            request.addParameter(key, TYPES.NVarChar, reqQuery[key]);
          }
          else {
            request.addParameter(key, TYPES.Numeric, Number(reqQuery[key]));
          }
        }
        else {
          systemlogger.debug(`undefined query key=${key}`);
        }
      }
      systemlogger.debug(`SQL Parameters: ${JSON.stringify(request.parameters)}`);
      let arr = new Array();
      request.on('row', function (columns) {
        let r = new Object();
        columns.forEach(function (column) {
          let colName = column.metadata.colName.toLowerCase();
          r[colName] = column.value ? column.value : '';
        });
        arr.push(r);
      });

      request.on('requestCompleted', function () {
        systemlogger.debug('requestCompleted');
        connection.close();

        if (arr.length > 0) {
          resolve(arr);
        } else {
          systemlogger.warn('Data not found.');
          resolve([]);
        }
      });
      connection.execSql(request);
    }
  });
};

module.exports = { doQuery };
