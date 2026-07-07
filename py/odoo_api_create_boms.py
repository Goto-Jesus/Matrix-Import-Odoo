"""
Odoo 19 API Integration Script
Автоматичне створення товарів з атрибутами, специфікацій та операцій
"""

import xmlrpc.client
import pandas as pd
from dotenv import load_dotenv
import os
import sys

# Налаштування кодування для консолі Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Завантаження конфігурації з .env
load_dotenv()

ODOO_URL = os.getenv('ODOO_URL')
ODOO_DB = os.getenv('ODOO_DB')
ODOO_USERNAME = os.getenv('ODOO_USERNAME')
ODOO_API_KEY = os.getenv('ODOO_API_KEY')


def normalize_size(size: str) -> str:
    """
    Нормалізує розмір для порівняння.
    Вирішує: латинська X/x → кирилична х, зайві пробіли, великий регістр.
    """
    s = size.strip()
    s = s.replace('X', 'х').replace('x', 'х').replace('Х', 'х')  # всі варіанти X → х
    s = ' '.join(s.split())   # кілька пробілів → один
    return s


class OdooAPI:
    """Клас для роботи з Odoo API"""

    def __init__(self):
        self.url = ODOO_URL
        self.db = ODOO_DB
        self.username = ODOO_USERNAME
        self.password = ODOO_API_KEY
        self.uid = None
        self.models = None

        # Підключення до Odoo
        self.connect()

    def connect(self):
        """Підключення до Odoo через XML-RPC"""
        try:
            common = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/common')
            self.uid = common.authenticate(self.db, self.username, self.password, {})

            if not self.uid:
                raise Exception("Не вдалося авторизуватись в Odoo")

            self.models = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/object')
            print(f"[OK] Підключено до Odoo (UID: {self.uid})")

        except Exception as e:
            print(f"[ERROR] Помилка підключення до Odoo: {e}")
            sys.exit(1)

    def execute(self, model, method, *args, **kwargs):
        """Виконання методу Odoo API"""
        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, method, args, kwargs
        )

    def search(self, model, domain, fields=None, limit=None):
        """Пошук записів"""
        # Пошук ID
        search_kwargs = {}
        if limit:
            search_kwargs['limit'] = limit

        ids = self.models.execute_kw(
            self.db, self.uid, self.password,
            model, 'search', [domain], search_kwargs
        )

        # Якщо потрібно прочитати поля
        if ids and fields:
            records = self.models.execute_kw(
                self.db, self.uid, self.password,
                model, 'read', [ids], {'fields': fields}
            )
            return records

        return ids

    def create(self, model, values):
        """Створення запису"""
        result = self.execute(model, 'create', [values])
        # Якщо результат - список, повертаємо перший елемент
        if isinstance(result, list) and len(result) > 0:
            return result[0]
        return result

    def write(self, model, record_id, values):
        """Оновлення запису"""
        return self.execute(model, 'write', [record_id], values)

    def get_or_create_attribute(self, attr_name):
        """Отримати або створити атрибут товару"""
        # Перевіряємо чи існує атрибут
        existing = self.search(
            'product.attribute',
            [('name', '=', attr_name)],
            fields=['id', 'name']
        )

        if existing:
            print(f"  Атрибут '{attr_name}' вже існує (ID: {existing[0]['id']})")
            return existing[0]['id']

        # Створюємо новий атрибут
        attr_id = self.create('product.attribute', {
            'name': attr_name,
            'create_variant': 'always',
        })
        print(f"  [+] Створено атрибут '{attr_name}' (ID: {attr_id})")
        return attr_id

    def get_or_create_attribute_value(self, attr_id, value_name):
        """Отримати або створити значення атрибуту"""
        # Перевіряємо чи існує значення
        existing = self.search(
            'product.attribute.value',
            [('attribute_id', '=', attr_id), ('name', '=', value_name)],
            fields=['id', 'name']
        )

        if existing:
            return existing[0]['id']

        # Створюємо нове значення
        value_id = self.create('product.attribute.value', {
            'attribute_id': attr_id,
            'name': value_name,
        })
        print(f"    [+] Створено значення '{value_name}' (ID: {value_id})")
        return value_id

    def get_or_create_workcenter(self, name):
        """Отримати або створити робочий центр"""
        existing = self.search(
            'mrp.workcenter',
            [('name', '=', name)],
            fields=['id', 'name']
        )

        if existing:
            return existing[0]['id']

        workcenter_id = self.create('mrp.workcenter', {
            'name': name,
            'code': 'Ц3лд0',
            'time_efficiency': 100,
        })
        print(f"  [+] Створено робочий центр '{name}' (ID: {workcenter_id})")
        return workcenter_id

    def create_product_template_with_variants(self, product_name, attribute_name, attribute_values):
        """
        Створити товар з атрибутами (шаблон + варіанти)

        Args:
            product_name: Назва товару (наприклад, "🧩[Ламінат - лист]")
            attribute_name: Назва атрибуту (наприклад, "Ламінат Розмір")
            attribute_values: Список значень атрибуту (наприклад, ["550х220", "680х220", ...])
        """
        print(f"\n{'='*60}")
        print(f"Створення товару: {product_name}")
        print(f"{'='*60}")

        # 1. Отримуємо або створюємо атрибут
        attr_id = self.get_or_create_attribute(attribute_name)

        # 2. Створюємо значення атрибутів
        value_ids = []
        for value in attribute_values:
            value_id = self.get_or_create_attribute_value(attr_id, value)
            value_ids.append(value_id)

        # 3. Створюємо товар (product.template)
        print(f"\n  Створення шаблону товару...")
        product_tmpl_id = self.create('product.template', {
            'name': product_name,
            'type': 'product',
            'detailed_type': 'product',
            'uom_id': 1,  # Units
            'uom_po_id': 1,
            'attribute_line_ids': [(0, 0, {
                'attribute_id': attr_id,
                'value_ids': [(6, 0, value_ids)],
            })],
        })

        print(f"  [+] Створено товар '{product_name}' (ID: {product_tmpl_id})")

        # 4. Отримуємо створені варіанти
        variants = self.search(
            'product.product',
            [('product_tmpl_id', '=', product_tmpl_id)],
            fields=['id', 'display_name', 'product_template_attribute_value_ids']
        )

        print(f"  [+] Автоматично створено {len(variants)} варіантів")

        return product_tmpl_id, variants

    def create_bom_with_operations(self, product_variant_id, product_tmpl_id, reference, components, operations):
        """
        Створити специфікацію (BOM) з компонентами та операціями

        Args:
            product_variant_id: ID варіанту товару
            product_tmpl_id: ID шаблону товару
            reference: Код/референс (наприклад, "550х220")
            components: Список компонентів [{product_id, qty, uom_id}, ...]
            operations: Список операцій [{name, workcenter_id, price_rate}, ...]
        """

        # Створюємо BOM
        bom_id = self.create('mrp.bom', {
            'product_id': product_variant_id,
            'product_tmpl_id': product_tmpl_id,
            'code': reference,
            'product_qty': 1.0,
            'type': 'normal',
        })

        print(f"    [+] Створено BOM (ID: {bom_id}, Reference: {reference})")

        # Додаємо операції
        operation_ids = []
        for idx, op in enumerate(operations):
            operation_id = self.create('mrp.routing.workcenter', {
                'name': op['name'],
                'bom_id': bom_id,
                'workcenter_id': op['workcenter_id'],
                'sequence': idx + 1,
                'x_studio_piece_rate_2': op.get('price_rate', 0),
            })
            operation_ids.append(operation_id)
            print(f"      [+] Операція: {op['name']} (Price Rate: {op.get('price_rate', 0)})")

        # Додаємо компоненти (BOM Lines)
        for idx, comp in enumerate(components):
            self.create('mrp.bom.line', {
                'bom_id': bom_id,
                'product_id': comp['product_id'],
                'product_qty': comp['qty'],
                'product_uom_id': comp['uom_id'],
                'sequence': idx + 1,
                'operation_id': comp.get('operation_id', False),
            })

            # Отримуємо назву товару для виводу
            product = self.search('product.product', [('id', '=', comp['product_id'])], fields=['display_name'])
            product_name = product[0]['display_name'] if product else f"ID:{comp['product_id']}"
            print(f"      [+] Компонент: {product_name} - {comp['qty']} {self._get_uom_name(comp['uom_id'])}")

        return bom_id

    def find_product_variant_by_color(self, product_name, color_value):
        """
        Знайти варіант товару за назвою шаблону та значенням кольору

        Args:
            product_name: Назва товару-шаблону (наприклад, "[Ламінат]")
            color_value: Значення кольору (наприклад, "Білий")

        Returns:
            ID варіанту товару або None
        """
        try:
            # Шукаємо шаблон товару
            template = self.search(
                'product.template',
                [('name', '=', product_name)],
                fields=['id', 'name'],
                limit=1
            )

            if not template:
                print(f"    [WARNING] Шаблон товару '{product_name}' не знайдено")
                return None, None

            tmpl_id = template[0]['id']

            # Отримуємо всі варіанти
            variants = self.search(
                'product.product',
                [('product_tmpl_id', '=', tmpl_id)],
                fields=['id', 'display_name', 'product_template_attribute_value_ids']
            )

            # Шукаємо варіант з точним збігом кольору
            for variant in variants:
                if variant['product_template_attribute_value_ids']:
                    ptav_ids = variant['product_template_attribute_value_ids']

                    # Читаємо атрибути через правильний виклик API
                    ptav_data = self.models.execute_kw(
                        self.db, self.uid, self.password,
                        'product.template.attribute.value', 'read',
                        [ptav_ids], {'fields': ['name', 'attribute_id']}
                    )

                    for ptav in ptav_data:
                        # Перевіряємо чи це точно потрібний колір (без префіксів типу "ДК")
                        ptav_name = ptav['name'].strip()
                        # Перевіряємо точний збіг або збіг у дужках "(Білий)"
                        if ptav_name == color_value or ptav_name == f"({color_value})":
                            return variant['id'], variant['display_name']

            print(f"    [WARNING] Варіант з кольором '{color_value}' не знайдено для '{product_name}'")
            return None, None

        except Exception as e:
            print(f"    [ERROR] Помилка пошуку варіанту: {e}")
            return None, None

    def ensure_variant_exists(self, product_tmpl_id, attr_line_id, attr_id, clean_size):
        """
        Якщо варіант для розміру clean_size не існує —
        створює значення атрибуту і додає до шаблону.
        Odoo автоматично генерує варіант після цього.
        Повертає ID нового варіанту або None.
        """
        print(f"    [!] Варіант '{clean_size}' не знайдено — створюємо...")

        # 1. Створюємо або знаходимо значення атрибуту
        value_id = self.get_or_create_attribute_value(attr_id, clean_size)

        # 2. Додаємо значення до рядку атрибуту шаблону (команда (4, id) = додати до m2m)
        self.write('product.template.attribute.line', attr_line_id, {
            'value_ids': [(4, value_id)]
        })
        print(f"    [+] Значення '{clean_size}' додано до шаблону")

        # 3. Знаходимо щойно створений варіант
        variants = self.search(
            'product.product',
            [('product_tmpl_id', '=', product_tmpl_id)],
            fields=['id', 'display_name', 'product_template_attribute_value_ids']
        )

        for variant in variants:
            ptav_ids = variant.get('product_template_attribute_value_ids', [])
            if not ptav_ids:
                continue
            ptav_data = self.models.execute_kw(
                self.db, self.uid, self.password,
                'product.template.attribute.value', 'read',
                [ptav_ids], {'fields': ['name']}
            )
            for ptav in ptav_data:
                if normalize_size(ptav['name']) == normalize_size(clean_size):
                    print(f"    [+] Знайдено новий варіант (ID: {variant['id']})")
                    return variant['id']

        print(f"    [ERROR] Не вдалося знайти варіант після створення '{clean_size}'")
        return None

    def _get_uom_name(self, uom_id):
        """Отримати назву одиниці виміру"""
        uom_map = {
            1: 'Units',
            8: 'm',
            10: 'm²',
        }
        return uom_map.get(uom_id, f'UOM:{uom_id}')


def main():
    """Основна функція"""

    print("\n" + "="*60)
    print("ODOO 19 - Автоматичне створення товарів та специфікацій")
    print("="*60)

    # Параметр: чи потрібно створювати товар (False якщо товар вже існує)
    CREATE_PRODUCT = False  # Змініть на True якщо потрібно створити новий товар

    # Підключення до Odoo
    odoo = OdooAPI()

    # Читання даних з Excel
    print("\n[1] Читання даних з Excel...")
    laminate_df = pd.read_excel(r'C:\Users\User\Desktop\Ламінат.xlsx')
    laminate_df.columns = ['size', 'area_m2', 'cutting_price', 'edge_price', 'edge_length', 'unused', 'notes']
    print(f"    Завантажено {len(laminate_df)} записів")

    # Отримуємо список всіх розмірів
    sizes = laminate_df['size'].str.replace('БК', '').str.replace('бк', '').str.strip().unique().tolist()
    print(f"    Унікальних розмірів: {len(sizes)}")

    # [2] Створення або отримання товару "🧩[Ламінат - лист]"
    if CREATE_PRODUCT:
        print("\n[2] Створення товару з варіантами...")
        product_tmpl_id, variants = odoo.create_product_template_with_variants(
            product_name="🧩[Ламінат - лист]",
            attribute_name="Ламінат Розмір",
            attribute_values=sizes
        )
    else:
        print("\n[2] Пошук існуючого товару та його варіантів...")
        template = odoo.search(
            'product.template',
            [('name', '=', '🧩[Ламінат - лист]')],
            fields=['id', 'name'],
            limit=1
        )

        if not template:
            print("    [ERROR] Товар '🧩[Ламінат - лист]' не знайдено!")
            print("    Створіть товар або встановіть CREATE_PRODUCT = True")
            return

        product_tmpl_id = template[0]['id']
        print(f"    [OK] Знайдено товар '🧩[Ламінат - лист]' (ID: {product_tmpl_id})")

        variants = odoo.search(
            'product.product',
            [('product_tmpl_id', '=', product_tmpl_id)],
            fields=['id', 'display_name', 'product_template_attribute_value_ids']
        )
        print(f"    [OK] Знайдено {len(variants)} варіантів")

    # Отримуємо рядок атрибуту шаблону (потрібен для ensure_variant_exists)
    attr_lines = odoo.search(
        'product.template.attribute.line',
        [('product_tmpl_id', '=', product_tmpl_id)],
        fields=['id', 'attribute_id', 'value_ids']
    )
    if not attr_lines:
        print("    [ERROR] Рядок атрибуту шаблону не знайдено!")
        return

    attr_line_id = attr_lines[0]['id']
    attr_id = attr_lines[0]['attribute_id'][0]  # [id, name] → беремо id
    print(f"    [OK] Атрибут шаблону (attr_line_id: {attr_line_id}, attr_id: {attr_id})")

    # Будуємо подвійний мапінг: точна назва + нормалізована → variant_id
    variant_map = {}       # ключ: точна назва з Odoo
    variant_map_norm = {}  # ключ: нормалізована назва (для нечіткого пошуку)

    for variant in variants:
        ptav_ids = variant['product_template_attribute_value_ids']
        if ptav_ids:
            ptav = odoo.search(
                'product.template.attribute.value',
                [('id', 'in', ptav_ids)],
                fields=['name']
            )
            if ptav:
                size_value = ptav[0]['name']
                variant_map[size_value] = variant['id']
                variant_map_norm[normalize_size(size_value)] = variant['id']

    print(f"\n    Мапінг варіантів: {len(variant_map)} розмірів")

    # [3] Отримання ID базових товарів
    print("\n[3] Пошук базових товарів з варіантами...")

    # [Ламінат] (Білий)
    laminate_white_id, laminate_white_name = odoo.find_product_variant_by_color('[Ламінат]', 'Білий')

    if not laminate_white_id:
        print("    [ERROR] Не знайдено варіант '[Ламінат]' з кольором 'Білий'")
        print("    Створіть цей товар вручну в Odoo або виконайте відповідний скрипт")
        return

    print(f"    [OK] Знайдено '{laminate_white_name}' (ID: {laminate_white_id})")

    # [Кромка] (Білий)
    edge_white_id, edge_white_name = odoo.find_product_variant_by_color('[Кромка]', 'Білий')

    if not edge_white_id:
        print("    [WARNING] Не знайдено варіант '[Кромка]' з кольором 'Білий'")
        edge_white_id = None
    else:
        print(f"    [OK] Знайдено '{edge_white_name}' (ID: {edge_white_id})")

    # [4] Отримання робочого центру
    print("\n[4] Пошук/створення робочого центру...")
    workcenter_id = odoo.get_or_create_workcenter("Цех №3-0 ЛДСП (нарізка листів ламінату)")

    # [5] Створення специфікацій для кожного варіанту
    print("\n[5] Створення специфікацій (BOMs)...")
    print("="*60)

    bom_created = 0
    bom_skipped = 0
    skipped_records = []  # Список пропущених записів

    for idx, row in laminate_df.iterrows():
        size = str(row['size']).strip()
        area_m2 = row['area_m2']
        cutting_price = row['cutting_price']
        edge_price = row['edge_price']
        edge_length = row['edge_length']

        # Очищення цін від текстових символів (грн, гривень, тощо)
        def clean_price(value):
            """Очистити ціну від текстових символів"""
            if pd.isna(value):
                return None
            # Конвертуємо в рядок та видаляємо все крім цифр, крапки та мінуса
            value_str = str(value).strip()
            # Видаляємо "грн", "гривень" та інші текстові частини
            value_str = value_str.replace('грн', '').replace('гривень', '').replace('₴', '').strip()
            try:
                return float(value_str)
            except (ValueError, TypeError):
                return None

        cutting_price = clean_price(cutting_price)
        edge_price = clean_price(edge_price)
        edge_length = clean_price(edge_length) if pd.notna(edge_length) else edge_length

        # Перевірка на "БК" (БК)
        is_without_edge = 'БК' in size.upper() or 'бк' in size.lower()

        # Для пошуку варіанту очищаємо розмір від "БК"
        clean_size_for_search = size.replace('БК', '').replace('бк', '').strip()

        # Знаходимо відповідний варіант товару — 3 рівні
        # 1. Точний збіг
        variant_id = variant_map.get(clean_size_for_search)

        # 2. Нормалізований збіг (виправляє X/х, пробіли, регістр)
        if not variant_id:
            norm_key = normalize_size(clean_size_for_search)
            variant_id = variant_map_norm.get(norm_key)
            if variant_id:
                print(f"  [~] '{clean_size_for_search}' знайдено через нормалізацію")

        # 3. Варіант не існує → створюємо
        if not variant_id:
            variant_id = odoo.ensure_variant_exists(
                product_tmpl_id, attr_line_id, attr_id, clean_size_for_search
            )
            if variant_id:
                # Додаємо новий варіант до обох мап
                variant_map[clean_size_for_search] = variant_id
                variant_map_norm[normalize_size(clean_size_for_search)] = variant_id

        if not variant_id:
            skip_reason = f"Не вдалося створити варіант для '{clean_size_for_search}'"
            print(f"  [SKIP] {skip_reason}")
            skipped_records.append({
                'size': size,
                'clean_size': clean_size_for_search,
                'reason': skip_reason,
                'area_m2': area_m2,
                'cutting_price': cutting_price,
                'edge_price': edge_price,
                'edge_length': edge_length
            })
            bom_skipped += 1
            continue

        # Перевірка чи вже існує BOM з таким референсом
        existing_bom = odoo.search(
            'mrp.bom',
            [('code', '=', size), ('product_id', '=', variant_id)],
            fields=['id', 'code'],
            limit=1
        )

        if existing_bom:
            print(f"\n  Варіант: {size} (Variant ID: {variant_id})")
            print(f"    [EXISTS] BOM вже існує (ID: {existing_bom[0]['id']}, Reference: {existing_bom[0]['code']})")
            bom_skipped += 1
            skipped_records.append({
                'size': size,
                'clean_size': clean_size_for_search,
                'reason': f"BOM вже існує (ID: {existing_bom[0]['id']})",
                'area_m2': area_m2,
                'cutting_price': cutting_price,
                'edge_price': edge_price,
                'edge_length': edge_length
            })
            continue

        # Для референсу використовуємо повний розмір (з "БК" якщо є)
        print(f"\n  Варіант: {size} (Variant ID: {variant_id})")

        # Підготовка компонентів
        components = []
        operations = []

        # Операція 1: Порізка ламінату
        operation_cutting = {
            'name': f"(Цех №3-0) Ламінта {size}",
            'workcenter_id': workcenter_id,
            'price_rate': cutting_price,
        }
        operations.append(operation_cutting)

        # Компонент 1: [Ламінат] (Білий)
        components.append({
            'product_id': laminate_white_id,
            'qty': area_m2,
            'uom_id': 10,  # m² (square meter)
        })

        # Якщо НЕ "БК" і є дані про кромку, додаємо кромку
        if not is_without_edge and pd.notna(edge_price) and pd.notna(edge_length) and edge_white_id:
            # Операція 2: Поклейка кромки
            operation_edge = {
                'name': f"(Цех №3-0) Кромка для Ламінату ({size})",
                'workcenter_id': workcenter_id,
                'price_rate': edge_price,
            }
            operations.append(operation_edge)

            # Компонент 2: [Кромка] (Білий)
            components.append({
                'product_id': edge_white_id,
                'qty': edge_length,
                'uom_id': 8,  # m (meter)
            })

        # Створення BOM (використовуємо повний розмір з "БК" для референсу)
        try:
            bom_id = odoo.create_bom_with_operations(
                product_variant_id=variant_id,
                product_tmpl_id=product_tmpl_id,
                reference=size,  # Повний розмір з "БК"
                components=components,
                operations=operations
            )
            bom_created += 1
        except Exception as e:
            error_msg = str(e)
            skip_reason = f"Помилка створення BOM: {error_msg[:200]}"
            print(f"    [ERROR] {skip_reason}")
            skipped_records.append({
                'size': size,
                'clean_size': clean_size_for_search,
                'reason': skip_reason,
                'area_m2': area_m2,
                'cutting_price': cutting_price,
                'edge_price': edge_price,
                'edge_length': edge_length
            })
            bom_skipped += 1

    # Підсумок
    print("\n" + "="*60)
    print("ПІДСУМОК")
    print("="*60)
    print(f"Створено BOMs: {bom_created}")
    print(f"Пропущено: {bom_skipped}")
    print(f"Всього оброблено: {len(laminate_df)}")
    print("="*60)

    # Виведення детальної інформації про пропущені записи
    if skipped_records:
        print("\n" + "="*60)
        print("ПРОПУЩЕНІ ЗАПИСИ (для ручного додавання)")
        print("="*60)
        for idx, record in enumerate(skipped_records, 1):
            print(f"\n{idx}. Розмір: {record['size']}")
            print(f"   Очищений розмір: {record['clean_size']}")
            print(f"   Причина: {record['reason']}")
            print(f"   Площа (м²): {record['area_m2']}")
            print(f"   Ціна порізки: {record['cutting_price']}")
            print(f"   Ціна кромки: {record['edge_price']}")
            print(f"   Довжина кромки: {record['edge_length']}")
        print("\n" + "="*60)

        # Збереження у файл для зручності
        import json
        with open('skipped_boms.json', 'w', encoding='utf-8') as f:
            json.dump(skipped_records, f, ensure_ascii=False, indent=2, default=str)
        print("\nПропущені записи збережено у файл: skipped_boms.json")
        print("="*60)


if __name__ == "__main__":
    main()
