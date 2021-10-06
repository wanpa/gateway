import sys
import json
import pyodbc

try:
    
    jsonData = json.loads(sys.stdin.readline())
    pdata = jsonData['data']

    # SQL Server
    server = 'localhost' 
    database = 'gwdb_stock' 
    username = 'sa' 
    password = 'cimtops' 

    # query
    query = "INSERT INTO stock_trn  VALUES ('%s','%s','%s','1', CURRENT_TIMESTAMP)"%(pdata[0],pdata[1],pdata[2])

    with pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};SERVER='+server+';DATABASE='+database+';UID='+username+';PWD='+ password) as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            conn.commit()

    # JSONで返す
    mappings = {"error": "", "mappings": [{ "item": "chart1"    ,"sheet": 2,"cluster": 10,"type": "string","value" : "登録完了"}]}
    print(json.dumps(mappings))

except Exception as e:
  mappings = {"error": "Pythonでエラー：" + str(e)}
  print(json.dumps(mappings))