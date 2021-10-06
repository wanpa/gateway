import sys
import qrcode
import uuid
import json
import base64
import os

try:

  img = qrcode.make(sys.stdin.readline())

  fileId = uuid.uuid4()
  img.save(fileId.hex + '.png')


  #画像ファイルをbase64文字列にencode
  file = open(fileId.hex + '.png', 'rb').read()
  enc_file = base64.b64encode( file ).decode('utf-8')
  os.remove(fileId.hex + '.png')

  #JSONで返す
  mappings = {"error": "", "mappings": [{ "item": "chart1"    ,"sheet": 1,"cluster": 49,"type": "string","value" : enc_file}]}
  print(json.dumps(mappings))

except Exception as e:
  mappings = {"error": "Pythonでエラー：" + str(e)}
  print(json.dumps(mappings))

