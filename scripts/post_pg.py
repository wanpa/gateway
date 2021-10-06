import numpy
import importlib
import json
import csv
import sys
import psycopg2
from psycopg2.extras import DictCursor

try:

    jsonData = json.loads(sys.stdin.readline())
    pdata = jsonData['data']

    # postgreSQL
    server = 'localhost' 
    database = 'gwdb_stock' 
    username = 'postgres' 
    password = 'cimtops' 
    port = '5432'
    
    query = "INSERT INTO stock_trn  VALUES ('%s','%s','%s',true)"%(pdata[0],pdata[1],pdata[2])

    with psycopg2.connect('postgresql://'+username+':'+password+'@'+server+':'+port+'/'+database) as conn:
        with conn.cursor() as cur:
            # insert
            cur.execute(query)
            conn.commit()
    cur.close()
    conn.close()

    #JSONで返す
    mappings = {"error": "", "mappings": [{ "item": "chart1","sheet": 1,"cluster": 10,"type": "string","value" : "登録完了"}]}
    print(json.dumps(mappings))

except Exception as e:
  mappings = {"error": "Pythonでエラー：" + str(e)}
  print(json.dumps(mappings))