import sys
import json
import openpyxl
import datetime

try:

    jsonData = json.loads(sys.stdin.readline())
    pdata = jsonData['data']

    trnbook  = "stock_ex/stock_trn.xlsx"
    sheet = "Sheet1"

    wb = openpyxl.load_workbook(trnbook)
    ws = wb[sheet]

    # リストに現在日時を挿入
    writedata = pdata + [datetime.datetime.now()]

    ws.append(writedata)
    wb.save(trnbook)

    #JSONで返す
    mappings = {"error": "", "mappings": [{ "item": "chart1","sheet": 3,"cluster": 10,"type": "string","value" : "登録完了"}]}
    print(json.dumps(mappings))

except Exception as e:
  mappings = {"error": "Pythonでエラー：" + str(e)}
  print(json.dumps(mappings))