import sys
import json
import numpy
import psycopg2
from psycopg2.extras import DictCursor

try:

    jsonData = json.loads(sys.stdin.readline())
    reqdata = jsonData['data']

    # postgreSQL
    server = 'localhost' 
    database = 'gwdb_stock' 
    username = 'postgres' 
    password = 'cimtops' 
    port = '5432'

    # query
    Getmstquery = "SELECT stock_standard,stock_qua FROM stock_mst where parts_name ='%s'"%(reqdata[0],)
    Gettrnquery = "SELECT stock_qua FROM stock_trn where parts_name = '%s'"%(reqdata[0],)

    # get(dict)
    with psycopg2.connect('postgresql://'+username+':'+password+'@'+server+':'+port+'/'+database) as conn:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            # get(mst)
            cur.execute(Getmstquery)
            rows_mst = cur.fetchall()[0]

            # get(trn)
            cur.execute(Gettrnquery)
            rows_trn = cur.fetchall()

    cur.close()
    conn.close()

    # トランザクションデータの数量を集計
    trnsum = numpy.sum(rows_trn)

    # マスターとトランザクションの数量の合計
    stock_plan = trnsum + rows_mst[1]

    # JSONで返す
    mappings = {"error": "", "mappings": [
        { "item": "chart1"    ,"sheet": 1,"cluster": 2,"type": "string","value" : str(rows_mst[0])},
        { "item": "chart1"    ,"sheet": 1,"cluster": 3,"type": "string","value" : str(stock_plan)},
        ]}
    print(json.dumps(mappings))

except Exception as e:
  mappings = {"error": "Pythonでエラー：" + str(e)}
  print(json.dumps(mappings))