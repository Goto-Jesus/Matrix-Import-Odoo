"""
Скрипт для перевірки одиниць виміру (UoM) в Odoo
"""

import xmlrpc.client
from dotenv import load_dotenv
import os
import sys

# Налаштування кодування для консолі Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Завантаження конфігурації
load_dotenv()

ODOO_URL = os.getenv('ODOO_URL')
ODOO_DB = os.getenv('ODOO_DB')
ODOO_USERNAME = os.getenv('ODOO_USERNAME')
ODOO_API_KEY = os.getenv('ODOO_API_KEY')

print("="*60)
print("Перевірка одиниць виміру (UoM) в Odoo")
print("="*60)

# Підключення
common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {})

if not uid:
    print("[ERROR] Не вдалося авторизуватись!")
    exit(1)

print(f"\n[OK] Підключено до Odoo (UID: {uid})")

models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

# Пошук одиниць виміру
print("\n[1] Пошук одиниць виміру...")

# Шукаємо m² (квадратні метри)
uom_m2 = models.execute_kw(
    ODOO_DB, uid, ODOO_API_KEY,
    'uom.uom', 'search_read',
    [[('name', 'ilike', 'm²')]],
    {'fields': ['id', 'name']}
)

print("\n  Знайдено одиниці для m² (квадратні метри):")
for uom in uom_m2:
    print(f"    ID: {uom['id']} | Назва: {uom['name']}")

# Шукаємо m (метри)
uom_m = models.execute_kw(
    ODOO_DB, uid, ODOO_API_KEY,
    'uom.uom', 'search_read',
    [[('name', 'in', ['m', 'м', 'метр', 'meter'])]],
    {'fields': ['id', 'name']}
)

print("\n  Знайдено одиниці для m (метри):")
for uom in uom_m:
    print(f"    ID: {uom['id']} | Назва: {uom['name']}")

# Показуємо всі доступні одиниці виміру
print("\n[2] Всі доступні одиниці виміру:")
all_uom = models.execute_kw(
    ODOO_DB, uid, ODOO_API_KEY,
    'uom.uom', 'search_read',
    [[]],
    {'fields': ['id', 'name'], 'limit': 50}
)

for uom in all_uom:
    print(f"  ID: {uom['id']:3d} | Назва: {uom['name']}")

print("\n" + "="*60)
print("Використовуй правильні ID для скрипта!")
print("="*60)
