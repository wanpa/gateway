import sys
import json
import numpy
import pyodbc

try:
    
    jsonData = json.loads(sys.stdin.readline())
    reqdata = jsonData['data']

    # SQL Server
    server = 'localhost' 
    database = 'gwdb_stock' 
    username = 'sa' 
    password = 'cimtops' 

    # query
    Getmstquery = "SELECT stock_standard,stock_qua FROM stock_mst where parts_name ='%s'"%(reqdata[0],)
    Gettrnquery = "SELECT stock_qua FROM stock_trn where parts_name = '%s'"%(reqdata[0],)

    with pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};SERVER='+server+';DATABASE='+database+';UID='+username+';PWD='+ password) as conn:
        with conn.cursor() as cur:
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
    stockplan = trnsum + rows_mst[1]

    # JSONで返す
    mappings = {"error": "", "mappings": [
        { "item": "chart1"    ,"sheet": 2,"cluster": 2,"type": "string","value" : str(rows_mst[0])},
        { "item": "chart1"    ,"sheet": 2,"cluster": 3,"type": "string","value" : str(stockplan)},
        ]}
    print(json.dumps(mappings))

except Exception as e:
  mappings = {"error": "Pythonでエラー：" + str(e)}
  print(json.dumps(mappings))