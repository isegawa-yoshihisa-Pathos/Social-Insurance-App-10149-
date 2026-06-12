import pandas as pd
import numpy as np
import os

# 1. 項目に 'paymentBaseDays' を追加
cols = [
    'employeeId', 'paymentBaseDays', 'basicSalary', 'retroactivePay', 'overtime-allowance',
    'commuting-allowance', 'housing-allowance', 'family-allowance',
    'child-allowance', 'holiday-allowance', 'night-allowance',
    'executive-allowance', 'other-allowance'
]

# 2025-01 から 2026-12 までの24ヶ月分
months = []
for year in [2025, 2026]:
    for month in range(1, 13):
        months.append((year, month))

generated_files = []

# 2. ロジック検証用に、意図的に「支払基礎日数が足りない月」を発生させる関数
def calculate_days(emp_id, y, m):
    # 基本はフルタイムの標準的な営業日数（19〜22日）
    if m == 2:
        base = 19
    elif m in [4, 5, 12]:
        base = 20
    elif m in [1, 9, 11]:
        base = 19
    else:
        base = 22
        
    # --- 💡 ロジック検証用のエッジケースを意図的に仕込む ---
    
    # 【テストケース1】定時決定（算定）の除外ロジック検証用
    # 社員10001の「2025年5月」を15日に設定。
    # ⇒ 4・5・6月の算定期間のうち5月が17日未満になるため、4月と6月の2ヶ月平均で算定されるべきケース
    if emp_id == 10001 and y == 2025 and m == 5:
        return 15
    
    # 【テストケース2】随時決定（月変）の上昇時除外検証用
    # 社員10002は4月に基本給が大幅アップ（18.5万→23万）するが、「2025年6月」を14日に設定。
    # ⇒ 変動月（4月）から3ヶ月連続で17日以上という条件を破るため、月変不成立（対象外）になるべきケース
    if emp_id == 10002 and y == 2025 and m == 6:
        return 14
        
    # 【テストケース3】随時決定（月変）の下降時除外検証用
    # 社員10004は10月に基本給がダウン（24万→19万）するが、2ヶ月目の「2025年11月」を16日に設定。
    # ⇒ 期間途中で日数が足りなくなるため、こちらも月変不成立になるべきケース
    if emp_id == 10004 and y == 2025 and m == 11:
        return 16
        
    # 【テストケース4】極端な欠勤・休職の検証用
    # 社員10006の「2026年4月」を12日に設定。
    if emp_id == 10006 and y == 2026 and m == 4:
        return 12
        
    return base

for year, month in months:
    data = []
    
    # Employee 10001: 定時決定 (Teiji Kettei) Standard
    ot_10001 = 15000 if (year == 2025 and month == 1) else (12000 + (month % 3) * 3000)
    days_10001 = calculate_days(10001, year, month)
    data.append([
        10001, days_10001, 320000, 45000 if (year == 2025 and month == 1) else 0,
        ot_10001, 20000, 0, 0, 0, 0, 0, 0, 0
    ])
    
    # Employee 10002: 随時決定 (Geppen) Upward Revision
    if year == 2025:
        basic_10002 = 185000 if month in [1, 2, 3] else 230000
    else:
        basic_10002 = 230000 if month in [1, 2, 3] else 270000
    ot_10002 = 8800 if (year == 2025 and month == 1) else 10000
    days_10002 = calculate_days(10002, year, month)
    data.append([
        10002, days_10002, basic_10002, 35000 if (year == 2025 and month == 1) else 0,
        ot_10002, 5000, 0, 0, 0, 0, 0, 0, 0
    ])
    
    # Employee 10003: 年間平均 (Nenkan Heikin) Seasonal Variation
    if month in [4, 5, 6]:
        ot_10003 = 180000
    else:
        ot_10003 = 25000 if (year == 2025 and month == 1) else 15000
    days_10003 = calculate_days(10003, year, month)
    data.append([
        10003, days_10003, 550000, 120000 if (year == 2025 and month == 1) else 0,
        ot_10003, 45000, 35000, 0, 0, 0, 0, 0, 0
    ])
    
    # Employee 10004: 随時決定 (Geppen) Downward Revision
    if year == 2025 and month in range(1, 10):
        basic_10004 = 240000
    else:
        basic_10004 = 190000
    ot_10004 = 0
    days_10004 = calculate_days(10004, year, month)
    data.append([
        10004, days_10004, basic_10004, 12500 if (year == 2025 and month == 1) else 0,
        ot_10004, 10000, 0, 0, 0, 0, 0, 0, 0
    ])
    
    # Employee 10005: 随時決定 (Geppen) Allowance Change
    house_10005 = 0 if (year == 2025 and month in range(1, 7)) else 30000
    ot_10005 = 12000 if (year == 2025 and month == 1) else 10000
    days_10005 = calculate_days(10005, year, month)
    data.append([
        10005, days_10005, 290000, 30000 if (year == 2025 and month == 1) else 0,
        ot_10005, 5000, house_10005, 0, 0, 0, 0, 0, 0
    ])
    
    # Employee 10006: 定時決定 (Teiji Kettei) Small Base Salary Increase (< 2 ranks)
    if year == 2025:
        basic_10006 = 210000 if month in [1, 2, 3] else 215000
    else:
        basic_10006 = 215000 if month in [1, 2, 3] else 220000
    ot_10006 = 5000
    days_10006 = calculate_days(10006, year, month)
    data.append([
        10006, days_10006, basic_10006, 15000 if (year == 2025 and month == 1) else 0,
        ot_10006, 0, 0, 0, 0, 0, 0, 0, 0
    ])

    # 🔥 【NEW】Employee 10007: 固定賃金上昇、しかし総報酬（等級）低下のケース
    # 2025年4月に基本給が 280,000 -> 295,000 にアップ（固定的賃金の変動＝プラス）
    # しかし1〜3月まで月10万円あった残業代が、4〜6月に0円に激減。
    # 結果として総額が減り「2等級以上下がる」が、固定賃金は上がっているため「月変不成立」となるべき。
    if year == 2025:
        basic_10007 = 280000 if month in [1, 2, 3] else 295000
        ot_10007 = 100000 if month in [1, 2, 3] else 0
    else:
        basic_10007 = 295000
        ot_10007 = 10000
    days_10007 = calculate_days(10007, year, month)
    data.append([
        10007, days_10007, basic_10007, 0,
        ot_10007, 15000, 0, 0, 0, 0, 0, 0, 0
    ])

    # 🔥 【NEW】Employee 10008: 5月昇給による8月月変（定時決定スキップのケース）
    # 2025年5月に基本給が 300,000 -> 380,000 に大幅アップ。
    # 5・6・7月の3ヶ月間で2等級以上上昇するため、「8月随時決定（月変）」の対象。
    # この場合、当年9月の「定時決定（算定）」の対象から除外（スキップ）されなければならない。
    if year == 2025:
        basic_10008 = 300000 if month in range(1, 5) else 380000
    else:
        basic_10008 = 380000
    ot_10008 = 15000
    days_10008 = calculate_days(10008, year, month)
    data.append([
        10008, days_10008, basic_10008, 0,
        ot_10008, 20000, 0, 0, 0, 0, 0, 0, 0
    ])
    
    # 3. ファイル名を yyyy-mm.csv 形式で保存
    month_df = pd.DataFrame(data, columns=cols)
    file_name = f"{year}-{month:02d}.csv"
    month_df.to_csv(file_name, index=False)
    generated_files.append(file_name)

print(f"Successfully generated {len(generated_files)} files from {generated_files[0]} to {generated_files[-1]}.")