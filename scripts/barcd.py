import sys
import barcode
import uuid
import json
import base64
import os

try:
  #引数を処理
  #
  # ex)
  #  http://localhost:3000/api/v1/getvalue/chart1?x1=A&x2=B&x3=C&x4=D&x5=E&y1=1&y2=2&y3=3&y4=4&y5=2
  #
  #  上記のリクエストの場合、以下のようなJSONで渡される
  #
  # { data:        ← 固定
  #   [
  #     'A',    ← 以下、クエリー引数の値が配列で格納されている
  #     'B',
  #     'C',
  #     'D',
  #     'E',
  #     '1',
  #     '2',
  #     '3',
  #     '4',
  #     '2' 
  #   ] 
  # }

  jsonData = json.loads(sys.stdin.readline())
  chartDatas = jsonData['data']
  y = ''
  y = y + chartDatas[5]
  y = y + chartDatas[6]
  y = y + chartDatas[7]
  y = y + chartDatas[8]
  y = y + chartDatas[9]

  CODE39 = barcode.get_barcode_class('code39')
  from barcode.writer import ImageWriter
  img = CODE39(y, writer=ImageWriter())

  #被らないファイル名で画像を一時保存
  fileId = uuid.uuid4()
  fullname = img.save(fileId.hex)

  #画像ファイルをbase64文字列にencode
  file = open(fullname, 'rb').read()
  enc_file = base64.b64encode( file ).decode('utf-8')
  os.remove(fullname)

  #JSONで返す
  mappings = {"error": "", "mappings": [{ "item": "chart1"    ,"sheet": 1,"cluster": 50,"type": "string","value" : enc_file}]}
  print(json.dumps(mappings))

except Exception as e:
  mappings = {"error": "Pythonでエラー：" + str(e)}
  print(json.dumps(mappings))



