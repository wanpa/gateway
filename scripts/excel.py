import sys
import json
import os
import uuid
import shutil
from pandas import DataFrame, Series, ExcelFile




try:

    jsonData = json.loads(sys.stdin.readline())
    reqdata = jsonData['data']

# ========================================
# #読み込ファイル情報
# ========================================

    #元データのファイルpath
    filepath ="ex/"
    #対象ファイル
    exfile = "(demo_sample)工程表.xlsx"
    #テンポラリーディレクトリ
    tempdir = "ex/temp_data/"
    #読み込み先シート
    readsheet = reqdata[0]

    #被らない名前で対象ファイルをコピー
    fileId = uuid.uuid4()
    tempfile = shutil.copy(filepath + exfile,tempdir + fileId.hex + exfile)

# ================================================
# Excelデータ取得
# ================================================
    def isExcelFilePath(filepath: str) -> bool:
        return (filepath.endswith('.xlsx')
            or filepath.endswith('.xls'))

    def getExcelFile(filepath: str) -> ExcelFile:
        if (not os.path.exists(filepath)
            or (not isExcelFilePath(filepath))):
                return None
        return ExcelFile(filepath)

    def getDataFromExcelFile(excelFile: ExcelFile) -> DataFrame:
        return excelFile.parse(
            sheet_name = reqdata[0],
            index_col=None,
            skiprows=1,
            header=None
        )

    dataFrame = getDataFromExcelFile(
        getExcelFile(tempfile)
    )

    # ========================================
    # 指定する部品名の行データを抽出
    # ========================================
    partsid = reqdata[1]

    # 検索するカラムを列番号で指定し対象の行を取得
    search_data = dataFrame[dataFrame[0] == partsid]

    # indexを振りなおす
    i = search_data.reset_index(drop=True)
    resdata = i.at

    # 各データを（列,行）で指定しSONで返す
    mappings = {"error": "", "mappings":[
         { "item": "chart1","sheet": 1,"cluster": 6  ,"type" : "string","value" : str(resdata[0,3])}#数量
        ,{ "item": "chart1","sheet": 1,"cluster": 7  ,"type" : "string","value" : str(resdata[0,1])}#材料
        ,{ "item": "chart1","sheet": 1,"cluster": 8  ,"type" : "string","value" : str(resdata[0,2])}#規格
        ,{ "item": "chart1","sheet": 1,"cluster": 9  ,"type" : "string","value" : str(resdata[0,24])}#備考

        #工程1
        ,{ "item": "chart1","sheet": 1,"cluster": 10 ,"type" : "string","value" : str(resdata[0,4])}#工程
        ,{ "item": "chart1","sheet": 1,"cluster": 11 ,"type" : "string","value" : str(resdata[0,5])}#作業班
        ,{ "item": "chart1","sheet": 1,"cluster": 12 ,"type" : "string","value" : str(resdata[0,6])}#機械
        ,{ "item": "chart1","sheet": 1,"cluster": 13 ,"type" : "string","value" : str(resdata[0,7])}#工数

        #工程2
        ,{ "item": "chart1","sheet": 1,"cluster": 16 ,"type" : "string","value" : str(resdata[0,8])}#工程
        ,{ "item": "chart1","sheet": 1,"cluster": 17 ,"type" : "string","value" : str(resdata[0,9])}#作業班
        ,{ "item": "chart1","sheet": 1,"cluster": 18 ,"type" : "string","value" : str(resdata[0,10])}#機械
        ,{ "item": "chart1","sheet": 1,"cluster": 19 ,"type" : "string","value" : str(resdata[0,11])}#工数

        #工程3
        ,{ "item": "chart1","sheet": 1,"cluster": 22 ,"type" : "string","value" : str(resdata[0,12])}#工程
        ,{ "item": "chart1","sheet": 1,"cluster": 23 ,"type" : "string","value" : str(resdata[0,13])}#作業班
        ,{ "item": "chart1","sheet": 1,"cluster": 24 ,"type" : "string","value" : str(resdata[0,14])}#機械
        ,{ "item": "chart1","sheet": 1,"cluster": 25 ,"type" : "string","value" : str(resdata[0,15])}#工数

        #工程4
        ,{ "item": "chart1","sheet": 1,"cluster": 28 ,"type" : "string","value" : str(resdata[0,16])}#工程
        ,{ "item": "chart1","sheet": 1,"cluster": 29 ,"type" : "string","value" : str(resdata[0,17])}#作業班
        ,{ "item": "chart1","sheet": 1,"cluster": 30 ,"type" : "string","value" : str(resdata[0,18])}#機械
        ,{ "item": "chart1","sheet": 1,"cluster": 31 ,"type" : "string","value" : str(resdata[0,19])}#工数

        #工程5
        ,{ "item": "chart1","sheet": 1,"cluster": 34 ,"type" : "string","value" : str(resdata[0,20])}#工程
        ,{ "item": "chart1","sheet": 1,"cluster": 35 ,"type" : "string","value" : str(resdata[0,21])}#作業班
        ,{ "item": "chart1","sheet": 1,"cluster": 36 ,"type" : "string","value" : str(resdata[0,22])}#機械
        ,{ "item": "chart1","sheet": 1,"cluster": 37 ,"type" : "string","value" : str(resdata[0,23])}#工数

        ]}
    print(json.dumps(mappings))

    #コピーしたファイルを削除
    os.remove(tempfile)

except Exception as e:
    mappings = {"error": "Pythonでエラー：" + str(e)}
    print(json.dumps(mappings))


