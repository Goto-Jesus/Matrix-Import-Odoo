"""
Тестовий скрипт для перевірки підключення до Odoo API
"""

import xmlrpc.client
from dotenv import load_dotenv
import os

# Завантаження конфігурації
load_dotenv()

ODOO_URL = os.getenv('ODOO_URL')
ODOO_DB = os.getenv('ODOO_DB')
ODOO_USERNAME = os.getenv('ODOO_USERNAME')
ODOO_API_KEY = os.getenv('ODOO_API_KEY')

print("="*60)
print("ODOO API - Тест підключення")
print("="*60)

# Перевірка наявності конфігурації
print("\n[1] Перевірка конфігурації...")
if not all([ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY]):
    print("  [ERROR] Не всі параметри налаштовані в .env файлі!")
    print(f"  ODOO_URL: {'✓' if ODOO_URL else '✗'}")
    print(f"  ODOO_DB: {'✓' if ODOO_DB else '✗'}")
    print(f"  ODOO_USERNAME: {'✓' if ODOO_USERNAME else '✗'}")
    print(f"  ODOO_API_KEY: {'✓' if ODOO_API_KEY else '✗'}")
    exit(1)

print(f"  URL: {ODOO_URL}")
print(f"  DB: {ODOO_DB}")
print(f"  Username: {ODOO_USERNAME}")
print(f"  API Key: {'*' * 20}")

# Підключення
print("\n[2] Підключення до Odoo...")
try:
    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {})

    if not uid:
        print("  [ERROR] Не вдалося авторизуватись!")
        print("  Перевірте правильність даних в .env файлі")
        exit(1)

    print(f"  [OK] Успішно підключено! (UID: {uid})")

except Exception as e:
    print(f"  [ERROR] Помилка підключення: {e}")
    exit(1)

# Перевірка доступу до моделей
print("\n[3] Перевірка доступу до моделей...")
models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

try:
    # Перевірка доступу до product.template
    product_count = models.execute_kw(
        ODOO_DB, uid, ODOO_API_KEY,
        'product.template', 'search_count', [[]]
    )
    print(f"  [OK] product.template: {product_count} записів")

    # Перевірка доступу до mrp.bom
    bom_count = models.execute_kw(
        ODOO_DB, uid, ODOO_API_KEY,
        'mrp.bom', 'search_count', [[]]
    )
    print(f"  [OK] mrp.bom: {bom_count} записів")

    # Перевірка доступу до product.attribute
    attr_count = models.execute_kw(
        ODOO_DB, uid, ODOO_API_KEY,
        'product.attribute', 'search_count', [[]]
    )
    print(f"  [OK] product.attribute: {attr_count} записів")

except Exception as e:
    print(f"  [ERROR] Помилка доступу до моделей: {e}")
    exit(1)

# Пошук базових товарів
print("\n[4] Пошук базових товарів з варіантами...")

def find_product_variant_by_color(models, db, uid, api_key, product_name, color_value):
    """Знайти варіант товару за назвою та кольором"""
    try:
        # Шукаємо шаблон товару
        template = models.execute_kw(
            db, uid, api_key,
            'product.template', 'search_read',
            [[('name', '=', product_name)]],
            {'fields': ['id', 'name'], 'limit': 1}
        )

        if not template:
            return None

        tmpl_id = template[0]['id']

        # Отримуємо всі варіанти
        variants = models.execute_kw(
            db, uid, api_key,
            'product.product', 'search_read',
            [[('product_tmpl_id', '=', tmpl_id)]],
            {'fields': ['id', 'display_name', 'product_template_attribute_value_ids']}
        )

        # Шукаємо варіант з потрібним кольором
        for variant in variants:
            if variant['product_template_attribute_value_ids']:
                ptav_ids = variant['product_template_attribute_value_ids']
                ptav_data = models.execute_kw(
                    db, uid, api_key,
                    'product.template.attribute.value', 'read',
                    [ptav_ids],
                    {'fields': ['name']}
                )

                for ptav in ptav_data:
                    if color_value.lower() in ptav['name'].lower():
                        return variant

        return None

    except Exception as e:
        print(f"  [ERROR] Помилка пошуку варіанту: {e}")
        return None

try:
    # Пошук [Ламінат] (Білий)
    laminate = find_product_variant_by_color(
        models, ODOO_DB, uid, ODOO_API_KEY,
        '[Ламінат]', 'Білий'
    )

    if laminate:
        print(f"  [OK] Знайдено '[Ламінат] (Білий)' (ID: {laminate['id']}, Назва: {laminate['display_name']})")
    else:
        print("  [WARNING] Не знайдено варіант '[Ламінат]' з кольором 'Білий'")

    # Пошук [Кромка] (Білий)
    edge = find_product_variant_by_color(
        models, ODOO_DB, uid, ODOO_API_KEY,
        '[Кромка]', 'Білий'
    )

    if edge:
        print(f"  [OK] Знайдено '[Кромка] (Білий)' (ID: {edge['id']}, Назва: {edge['display_name']})")
    else:
        print("  [WARNING] Не знайдено варіант '[Кромка]' з кольором 'Білий'")

except Exception as e:
    print(f"  [ERROR] Помилка пошуку товарів: {e}")

print("\n" + "="*60)
print("Тест завершено успішно!")
print("Тепер ви можете запустити основний скрипт:")
print("  py odoo_api_create_boms.py")
print("="*60)
