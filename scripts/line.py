import sys
import matplotlib.pyplot as plt
import uuid
import json
import base64
import os

try:
  #引数を処理
  #code
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
  x = []
  y = []
  x = x + [chartDatas[0]]
  x = x + [chartDatas[1]]
  x = x + [chartDatas[2]]
  x = x + [chartDatas[3]]
  x = x + [chartDatas[4]]
  y = y + [float(chartDatas[5])]
  y = y + [float(chartDatas[6])]
  y = y + [float(chartDatas[7])]
  y = y + [float(chartDatas[8])]
  y = y + [float(chartDatas[9])]

  plt.plot(x, y)

  #被らないファイル名で画像を一時保存
  fileId = uuid.uuid4()
  plt.savefig(fileId.hex + '.png')

  #画像ファイルをbase64文字列にencode
  file = open(fileId.hex + '.png', 'rb').read()
  enc_file = base64.b64encode( file ).decode('utf-8')
  os.remove(fileId.hex + '.png')

  #標準出力JSONで返す（正常）
  # 出力フォーマット
  #
  # {
  #   "error": "",            ←　正常の場合は空文字列／エラー時はメッセージなど文字列を入れる
  #   "mappings": [           ←　ConMasGatewayのアクションファイルの'mappings'形式で返す
  #     {
  #       "item": "temp",     ←　アイテム名（任意）
  #       "sheet": 1,         ←　シートNo
  #       "cluster": 43,      ←　クラスターID
  #       "type": "string",   ←　String固定（数値の場合もString）
  #       "value": "100"      ←　数値の場合も文字列（ダブルクォーテーションで囲む）
  #     },
  #     {
  #       "item": "chart",
  #       "sheet": 1,
  #       "cluster": 44,
  #       "type": "string",
  #       "value": "[base64]" ←　画像はBase64文字列（画像形式はPNG、JPG、TIFFに対応）
  #     }
  # 　　　　・
  # 　　　　・
  # 　　　　・
  # 　　　　・
  # 　　　　・
  # 　　　　・
  #   ]
  # }
  mappings = {"error": "", "mappings": [{ "item": "chart1"    ,"sheet": 1,"cluster": 43,"type": "string","value" : enc_file}]}
  print(json.dumps(mappings))

except Exception as e:
  #標準出力JSONで返す（エラー）
  mappings = {"error": "Pythonでエラー：" + str(e)}
  print(json.dumps(mappings))
