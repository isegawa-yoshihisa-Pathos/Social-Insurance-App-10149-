import pandas as pd

# 1. テスト対象の従業員ID（10001〜10008 に拡張）
employee_ids = [10001, 10002, 10003, 10004, 10005, 10006, 10007, 10008]

# 2. 2年間の月リスト（2025-01 から 2026-12 までの24ヶ月）
months = []
for year in [2025, 2026]:
    for month in range(1, 13):
        months.append((year, month))

rows = []

# 3. 時系列の月ごとにループを回してデータを生成
for year, month in months:
    # ─── 支給判定（法律の実態に合わせた狙い撃ち） ───
    # annual-bonus: 3, 6, 9, 12月 (年4回) -> 定時・随時決定の計算（報酬）に影響する区分
    # それ以外(period, incentive, temporary, special, other): 6, 9, 12月 (年3回) -> 通常の賞与区分
    is_annual_month = month in [3, 6, 9, 12]
    is_other_bonus_month = month in [6, 9, 12]
    
    for emp_id in employee_ids:
        # 基本構造（支給のない月はすべて0円で埋める）
        row = {
            "employeeId": emp_id,
            "year-month": f"{year}-{month:02d}", # 給与データと突合しやすいように年月キーを保持
            "annual-bonus": 0,
            "period-bonus": 0,
            "incentive-bonus": 0,
            "temporary-bonus": 0,
            "special-bonus": 0,
            "other-bonus": 0
        }
        
        # ----------------------------------------------------------------------
        # パターンA: 従業員10001〜10007（通常の支給スケジュール）
        # ----------------------------------------------------------------------
        if emp_id != 10008:
            # annual-bonus (年4回ルール)
            if is_annual_month:
                base_amt = 400000 if month in [3, 9] else 500000
                row["annual-bonus"] = base_amt + (emp_id % 5) * 20000
                
            # 通常賞与 (年3回ルール: 6月, 9月, 12月)
            if is_other_bonus_month:
                row["period-bonus"] = 300000 + (emp_id % 3) * 30000
                row["incentive-bonus"] = 50000 + (emp_id % 4) * 15000
                row["temporary-bonus"] = 20000 
                row["special-bonus"] = 150000 + (emp_id % 2) * 50000
                row["other-bonus"] = 10000

        # ----------------------------------------------------------------------
        # パターンB: 【NEW】従業員10008（5月昇給・7月賞与跳ねによる8月月変の検証）
        # ----------------------------------------------------------------------
        else:
            # 10008番は、通常の3回（6, 9, 12月）に加えて「7月」にも臨時ボーナスを支給
            # これにより「年4回以上の賞与支給者」となり、賞与が「報酬」に化けるエッジケースを検証
            if month in [6, 7, 9, 12]:
                row["annual-bonus"] = 450000 # 年4回カウントさせるためにこちらに支給
            
            if month in [6, 9, 12]:
                row["period-bonus"] = 350000
                row["incentive-bonus"] = 60000
                row["special-bonus"] = 150000
            
            # 7月に不意打ちの臨時ボーナス（これで合計年4回目）
            if month == 7:
                row["temporary-bonus"] = 100000 

        rows.append(row)

# 4. DataFrameの作成と列の並び替え
df = pd.DataFrame(rows)

columns_order = [
    "employeeId", 
    "year-month",
    "annual-bonus", 
    "period-bonus", 
    "incentive-bonus", 
    "temporary-bonus", 
    "special-bonus", 
    "other-bonus"
]
df = df[columns_order]

# 5. CSVファイルへの出力
output_filename = "bonus_simulation_2years_updated.csv"
df.to_csv(output_filename, index=False, encoding="utf-8-sig")

print(f"社会保険判定用テスト賞与CSVを正常に出力しました: {output_filename}")
print(f"総行数: {len(df)} 行 (8名 × 24ヶ月)")