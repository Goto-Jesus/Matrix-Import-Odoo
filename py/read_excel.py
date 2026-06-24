import pandas as pd
import json

# Читання файлу з ламінатом
laminate_df = pd.read_excel(r'C:\Users\User\Desktop\Ламінат.xlsx')

# Читання файлу з товарами
product_df = pd.read_excel(r'C:\Users\User\Desktop\Товар (product.template).xlsx')

# Читання файлу зі специфікаціями
bom_df = pd.read_excel(r'C:\Users\User\Desktop\Специфікація (mrp.bom) (1).xlsx')

# Збереження в JSON для аналізу
with open('laminate_data.json', 'w', encoding='utf-8') as f:
    json.dump(laminate_df.to_dict('records'), f, ensure_ascii=False, indent=2)

with open('product_data.json', 'w', encoding='utf-8') as f:
    json.dump(product_df.head(20).to_dict('records'), f, ensure_ascii=False, indent=2)

with open('bom_data.json', 'w', encoding='utf-8') as f:
    json.dump(bom_df.head(20).to_dict('records'), f, ensure_ascii=False, indent=2)

print("Files converted to JSON successfully!")
print(f"\nLaminate rows: {len(laminate_df)}")
print(f"Product rows: {len(product_df)}")
print(f"BOM rows: {len(bom_df)}")

print("\nLaminate columns:", laminate_df.columns.tolist())
print("\nProduct columns:", product_df.columns.tolist())
print("\nBOM columns:", bom_df.columns.tolist())
