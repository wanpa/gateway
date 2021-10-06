import json
import sys
import math

try:
    jsonData = json.loads(sys.stdin.readline())
    reqdata = jsonData['data']

    resdata = pow(int(reqdata[0]),int(reqdata[1]))

    #JSONで返す
    mappings = {"error": "", "mappings": [{ "item": "chart1"    ,"sheet": int(reqdata[2]),"cluster": int(reqdata[3]),"type": "string","value" : str(resdata)}]}
    print(json.dumps(mappings))

except Exception as e:
    mappings = {"error": "Pythonでエラー：" + str(e)}
    print(json.dumps(mappings))