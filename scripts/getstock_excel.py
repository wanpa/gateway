import os
import sys
import json
import uuid
import shutil
import openpyxl
import numpy as np

try:

    jsonData = json.loads(sys.stdin.readline())
    reqdata = jsonData['data']

    #----------------------------------------------------------
    # 読み込み先のExcelと検索条件
    #----------------------------------------------------------

    filepath = "stock_ex/"
    tempdir = "stock_ex/temp_data/"

    # excelのbookとshhetを指定 
    mstbook  = "stock_mst.xlsx"
    mstsheet = "Sheet1"
    trnbook  = "stock_trn.xlsx"
    trnsheet = "Sheet1"

    # 検索したい列を指定
    i = 0

    # 検索データ
    reqdata = reqdata[0]

    # excelからデータ取得する関数
    def getfunc(book,sheet,reqdata):
        wb = openpyxl.load_workbook(book)
        ws = wb[sheet]

        # excelの2行目以降のデータを取得
        mstlist = []
        for row in ws.iter_rows(min_row=2):
            values = []
            for c in row:
                values.append(c.value)
            mstlist.append(tuple(values))

        # 検索する部品名
        partsid = reqdata

        # 検索 
        resultparts = []
        for parts in mstlist:
            # 行番号を指定して列から検索
            if parts[i] in partsid:
                resultparts.append(parts)

        resdata = resultparts
        return resdata

    #被らない名前で対象ファイルをコピー
    fileId = uuid.uuid4()
    tempmstbook = shutil.copy(filepath + mstbook,tempdir + fileId.hex + mstbook) 
    temptrnbook = shutil.copy(filepath + trnbook,tempdir + fileId.hex + trnbook) 

    # mstbook(stock_mst.xlsx)からデータ取得
    mstdata = getfunc(tempmstbook,mstsheet,reqdata)

    # trnbook(stock_trn.xlsx）からデータ取得
    trndata = getfunc(temptrnbook,trnsheet,reqdata)

    #-------------------------------------------------------
    # 取得したデータの列を指定して数値を計算する
    #-------------------------------------------------------

    # 列抽出（計算する列をindexで指定） 
    row = ((np.array(trndata))[:,2])

    # 型変換
    rowtype = list(map(lambda x: int(x) ,row))

    # 計算（trnデータの合計値とmstデータの数量の和）
    sumdata = np.sum(rowtype) + mstdata[0][2]
    
    # JSONで返す
    mappings = {"error": "", "mappings": [
        { "item": "chart1"    ,"sheet": 3,"cluster": 2,"type": "string","value" : str(mstdata[0][1])},
        { "item": "chart1"    ,"sheet": 3,"cluster": 3,"type": "string","value" : str(sumdata)},
        ]}
    print(json.dumps(mappings))
    os.remove(tempmstbook)
    os.remove(temptrnbook)

except Exception as e:
    mappings = {"error": "Pythonでエラー：" + str(e)}
    print(json.dumps(mappings))