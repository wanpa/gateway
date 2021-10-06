import sys
import matplotlib.pyplot as plt
import uuid
import json
import base64
import os

try:
  jsonData = json.loads(sys.stdin.readline())
  query = jsonData['query']
  post = jsonData['post']
  path = jsonData['path']

  # file = open(path + post["clusters"][3]["value"], 'rb').read()
  # enc_file1 = base64.b64encode( file ).decode('utf-8')
  # file.close()

  # file = open(path + post["clusters"][4]["value"], 'rb').read()
  # enc_file2 = base64.b64encode( file ).decode('utf-8')
  # file.close()
  file = open(path + "/" + post["clusters"][3]["value"], 'rb').read()
  enc_file1 = base64.b64encode( file ).decode('utf-8')

  file = open(path + "/" + post["clusters"][4]["value"], 'rb').read()
  enc_file2 = base64.b64encode( file ).decode('utf-8')

  file = open(path + "/" + post["clusters"][5]["value"], 'rb').read()
  enc_file3 = base64.b64encode( file ).decode('utf-8')
  # file.close()
  # enc_file3 = path + "/" + post["clusters"][5]["value"]

  mappings = {"error": "", "mappings": [
    { "item": "chart1","sheet": 1,"cluster":  7,"type": "string","value":query["param1"]},
    { "item": "chart1","sheet": 1,"cluster":  8,"type": "string","value":query["param2"]},
    { "item": "chart1","sheet": 1,"cluster":  9,"type": "string","value":post["clusters"][0]["value"]},
    { "item": "chart1","sheet": 1,"cluster": 10,"type": "string","value":post["clusters"][1]["value"]},
    { "item": "chart1","sheet": 1,"cluster": 11,"type": "string","value":post["clusters"][2]["value"]},
    { "item": "chart1","sheet": 1,"cluster": 12,"type": "string","value":enc_file1},
    { "item": "chart1","sheet": 1,"cluster": 13,"type": "string","value":enc_file2},
    { "item": "chart1","sheet": 1,"cluster": 14,"type": "string","value":enc_file3}
    ]}
  print(json.dumps(mappings))

except Exception as e:
  #標準出力JSONで返す（エラー）
  mappings = {"error": "Pythonでエラー：" + str(e)}
  print(json.dumps(mappings))