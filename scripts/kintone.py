import sys
import requests
import json

try:

    jsonData = json.loads(sys.stdin.readline())
    reqdata = jsonData['data']

    #Kintone接続先情報
    domain = "AAAAAA"
    app = 123
    record = reqdata[0]
    API_TOKEN  = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
    URL = "https://%s.cybozu.com/k/v1/record.json?app=%s&id=%s"%(domain,app,record)
    headers = {"X-Cybozu-API-Token": API_TOKEN}

    #Kintoneからデータ取得する関数
    def get_kintone(url, api_token):
        resp = requests.get(url, headers=headers)
        return resp

    #データ取得
    data = get_kintone(URL, API_TOKEN).json()
    resp_data = data["record"]

    #mapping
    if reqdata[1] == "日本語":
        mappings = {"error": "", "mappings":[
             { "item": "chart1","sheet": 1,"cluster": 4  ,"type" : "string","value" : resp_data["フィールドコード1"]["value"]}
            ,{ "item": "chart1","sheet": 1,"cluster": 6  ,"type" : "string","value" : resp_data["フィールドコード2"]["value"]}
            ,{ "item": "chart1","sheet": 1,"cluster": 8  ,"type" : "string","value" : resp_data["フィールドコード3"]["value"]}
            ,{ "item": "chart1","sheet": 1,"cluster": 10 ,"type" : "string","value" : resp_data["フィールドコード4"]["value"]}
        ]}
        print(json.dumps(mappings))
    else:
        mappings = {"error": "", "mappings":[
             { "item": "chart1","sheet": 1,"cluster": 4  ,"type" : "string","value" : resp_data["フィールドコード5"]["value"]}
            ,{ "item": "chart1","sheet": 1,"cluster": 6  ,"type" : "string","value" : resp_data["フィールドコード6"]["value"]}
            ,{ "item": "chart1","sheet": 1,"cluster": 8  ,"type" : "string","value" : resp_data["フィールドコード7"]["value"]}
            ,{ "item": "chart1","sheet": 1,"cluster": 10 ,"type" : "string","value" : resp_data["フィールドコード8"]["value"]}
        ]}
        print(json.dumps(mappings))

except Exception as e:
  mappings = {"error": "Pythonでエラー：" + str(e)}
  print(json.dumps(mappings))

