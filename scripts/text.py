import json
import sys
import math
import datetime
from japanera import Japanera, EraDate 
import locale

"""
月・曜日を日本語にしたい場合はロケールを変更してください
"""
#locale.setlocale(locale.LC_ALL, 'en_US.utf8')
#locale.setlocale(locale.LC_ALL, 'ja_JP.utf8')

# text_main_function
def function_text(type,val,arg):

    """
    valueの型は、適宜変更してご利用ください
    """

    if type == 'date':
        result_date = function_date(val,arg)
        return result_date

    elif type == 'zero_pad':
        result_text_type = str(val).rjust(5,'0')
            
    elif type == 'comma':
        result_text_type = '{:,}'.format(float(val))

    elif type == 'per':
        result_text_type = '{:.0%}'.format(float(val))

    elif type == 'digit':
        result_text_type = '{:.5}'.format(float(val))

    elif type == 'digit_decimal':
        result_text_type = '{:.5f}'.format(float(val))

    elif type == 'digit_embedded':
        result_text_type = '{:*>20}'.format(str(val))
    return result_text_type

# date_function
def function_date(date,format):

    # year month day
    date_formatted = datetime.datetime.strptime(date, "%Y/%m/%d")
    result_date = date_formatted

    def_format = {'yyyy':'%Y', 'yy':'%y', 'm':'%m', 'mm':'%m', 'mmm':'%B', 'mmmm':'%b', 'd':'%d', 'dd':'%d', 'ddd':'%A', 'dddd':'%a'}

    if format in def_format:
        conv_val =  result_date.strftime(def_format[format])
        if format == 'd' or format == "m":
            conv_val = conv_val.lstrip("0")
    else:
        def_format_era = {'e':'%-o', 'ee':'%-o', 'gg':'%-E', 'ggg':'%-E'}
        era_date = EraDate(result_date.year, result_date.month, result_date.day)
        conv_val = era_date.strftime(def_format_era[format])
        if format == 'e':
            conv_val = conv_val.lstrip("0")
        elif format == 'ggg':
            conv_val = conv_val[0]
    return conv_val


try:
    jsonData = json.loads(sys.stdin.readline())
    reqdata = jsonData['data']

    result_data = function_text(reqdata[0],reqdata[1],reqdata[2])

    if reqdata[2].isdigit() or len(reqdata) !=5 :
        reqdata.insert(2,'')

    #JSONで返す
    mappings = {"error": "", "mappings": [{ "item": "chart1"    ,"sheet": int(reqdata[3]),"cluster": int(reqdata[4]),"type": "string","value" : str(result_data)}]}
    print(json.dumps(mappings))

except Exception as e:
    mappings = {"error": "Pythonでエラー：" + str(e)}
    print(json.dumps(mappings))
