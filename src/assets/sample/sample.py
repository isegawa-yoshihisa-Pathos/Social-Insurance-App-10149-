import pandas as pd
import numpy as np
import os

# Define the template columns based on the original file
cols = [
    'employeeId', 'basicSalary', 'retroactivePay', 'overtime-allowance',
    'commuting-allowance', 'housing-allowance', 'family-allowance',
    'child-allowance', 'holiday-allowance', 'night-allowance',
    'executive-allowance', 'other-allowance'
]

# Create data for 24 months (2025-01 to 2026-12)
months = []
for year in [2025, 2026]:
    for month in range(1, 13):
        months.append((year, month))

# Dictionary to hold the data frames for each month
generated_files = []

for year, month in months:
    data = []
    
    # Employee 10001: 定時決定 (Teiji Kettei) Standard
    # Stable basic salary, normal overtime variation
    ot_10001 = 15000 if (year == 2025 and month == 1) else (12000 + (month % 3) * 3000)
    data.append([
        10001, 320000, 45000 if (year == 2025 and month == 1) else 0,
        ot_10001, 20000, 0, 0, 0, 0, 0, 0, 0
    ])
    
    # Employee 10002: 随時決定 (Geppen) Upward Revision
    # April 2025: 185k -> 230k, April 2026: 230k -> 270k
    if year == 2025:
        basic_10002 = 185000 if month in [1, 2, 3] else 230000
    else:
        basic_10002 = 230000 if month in [1, 2, 3] else 270000
    ot_10002 = 8800 if (year == 2025 and month == 1) else 10000
    data.append([
        10002, basic_10002, 35000 if (year == 2025 and month == 1) else 0,
        ot_10002, 5000, 0, 0, 0, 0, 0, 0, 0
    ])
    
    # Employee 10003: 年間平均 (Nenkan Heikin) Seasonal Variation
    # Apr-Jun has very high overtime, others low
    if month in [4, 5, 6]:
        ot_10003 = 180000
    else:
        ot_10003 = 25000 if (year == 2025 and month == 1) else 15000
    data.append([
        10003, 550000, 120000 if (year == 2025 and month == 1) else 0,
        ot_10003, 45000, 35000, 0, 0, 0, 0, 0, 0
    ])
    
    # Employee 10004: 随時決定 (Geppen) Downward Revision
    # Oct 2025: 240k -> 190k
    if year == 2025 and month in range(1, 10):
        basic_10004 = 240000
    else:
        basic_10004 = 190000
    ot_10004 = 0
    data.append([
        10004, basic_10004, 12500 if (year == 2025 and month == 1) else 0,
        ot_10004, 10000, 0, 0, 0, 0, 0, 0, 0
    ])
    
    # Employee 10005: 随時決定 (Geppen) Allowance Change
    # July 2025: Housing allowance 0 -> 30000
    house_10005 = 0 if (year == 2025 and month in range(1, 7)) else 30000
    ot_10005 = 12000 if (year == 2025 and month == 1) else 10000
    data.append([
        10005, 290000, 30000 if (year == 2025 and month == 1) else 0,
        ot_10005, 5000, house_10005, 0, 0, 0, 0, 0, 0
    ])
    
    # Employee 10006: 定時決定 (Teiji Kettei) Small Base Salary Increase (< 2 ranks)
    # April 2025: 210k -> 215k, April 2026: 215k -> 220k
    if year == 2025:
        basic_10006 = 210000 if month in [1, 2, 3] else 215000
    else:
        basic_10006 = 215000 if month in [1, 2, 3] else 220000
    ot_10006 = 5000
    data.append([
        10006, basic_10006, 15000 if (year == 2025 and month == 1) else 0,
        ot_10006, 0, 0, 0, 0, 0, 0, 0, 0
    ])
    
    # Create DataFrame and save
    month_df = pd.DataFrame(data, columns=cols)
    file_name = f"salary_{year}_{month:02d}.csv"
    month_df.to_csv(file_name, index=False)
    generated_files.append(file_name)

print(f"Successfully generated {len(generated_files)} files from {generated_files[0]} to {generated_files[-1]}.")
# Print a sample from a month where changes happen, e.g., 2025_04
df_apr = pd.read_csv("salary_2025_04.csv")
print("\n--- Sample: April 2025 ---")
print(df_apr[['employeeId', 'basicSalary', 'overtime-allowance', 'housing-allowance']])