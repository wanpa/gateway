/**
 * Oracle DB操作処理
 */
const fs = require('fs');
const oracledb = require('oracledb');

/**
 * 検索処理 doQuery
 * @param {Object} datasource - connection information
 * @param {Object} query - has basequery(required). basetype, where, params are optional.
 * @param {Object} mappings - mapping Object の配列
 * @param {Object} reqQuery - Request.query
 * @returns {Array} 正常時:Object配列、異常時:Error Object
 */
let doQuery = function(datasource, query, mappings, reqQuery, systemlogger) {
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
    let sqlParamValues = {};

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
        sqlParamValues[key] = { val: reqQuery[key] };
        if (sqlParam.type) {
          if (sqlParam.type === 'char') {
            sqlParamValues[key].dir = oracledb.BIND_IN;
            sqlParamValues[key].type = oracledb.DB_TYPE_CHAR;
          }
        }

        if (!query.withoutParams) {
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
    systemlogger.debug(`SQL Parameters: ${JSON.stringify(sqlParamValues)}`);

    const config = {
      user: datasource.user,
      password: datasource.password,
      connectString: datasource.connectString
    };
    return oracledb.getConnection(config)
      .then(function(conn) {
        let options = {};
        options.outFormat = oracledb.OBJECT;

        // LOB は fetch 時にフォーマット指定が必要
        options.fetchInfo = {};
        mappings.forEach(mapping => {
          let type = mapping.type.toLowerCase();
          if (type === "image" || type === "blob") {
            options.fetchInfo[mapping.item.toUpperCase()] = {type: oracledb.BUFFER}; // BLOB型を想定している
          } else if (type === "clob") { // キャラクタ・ラージ・オブジェクト
            options.fetchInfo[mapping.item.toUpperCase()] = {type: oracledb.STRING};
          }
        });
        return conn.execute(sql, sqlParamValues, options);
      }).then(data => {
        if (data.rows.length < 1) {
          resolve([]);
        } else {
          // 列名がすべて大文字になるので、小文字へ変換する (Oracle)
          let arr = [];
          for (let row of data.rows) {
            let obj = {};
            for (let colname in row) {
              obj[colname.toLowerCase()] = row[colname];
            }
            arr.push(obj);
          }
          resolve(arr);
        }
      }).catch (err => {
        reject(Error(err.message));
      });
  });
};

module.exports = { doQuery };
