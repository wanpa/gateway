import json
import sys
import math

try:

    jsonData = json.loads(sys.stdin.readline())
    reqdata = jsonData['data']
    
    resdata = math.sqrt(int(reqdata[0]))

    #JSONで返す
    mappings = {"error": "", "mappings": [{ "item": "chart1"    ,"sheet": int(reqdata[1]),"cluster": int(reqdata[2]),"type": "string","value" : str(resdata)}]}
    print(json.dumps(mappings))


except Exception as e:
    mappings = {"error": "Pythonでエラー：" + str(e)}
    print(json.dumps(mappings))
