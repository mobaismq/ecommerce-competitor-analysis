"""Offline fixtures only: no Chrome, network, MySQL, or real product data."""
import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import run_desktop_collection as bridge
import run_diantoushi_rpa as runner


class DesktopCollectionTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="desktop-scraper-test-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        runner.write_xlsx(self.root / "product.xlsx", "product", ["商品ID", "商品标题", "店铺名称", "已售", "销售额约"],
                          [["100000000001", "合成测试商品", "测试店铺", "1.2万+", "2.4万"]])

    def test_full_export_contract_and_single_line_output(self):
        runner.write_xlsx(self.root / "sku.xlsx", "sku", ["商品ID", "SKUID", "SKU信息", "价格", "SKU图片"],
                          [["100000000001", "20001", "红色", "19.90", "https://example.invalid/sku.png"]])
        runner.write_xlsx(self.root / "qa.xlsx", "qa", ["问题", "问答"], [["合成问题", "合成回答"]])
        (self.root / "review_comments.json").write_text(json.dumps({"product_id": "100000000001", "rows": [
            {"初评": "合成评价", "追评": "合成追评"}]}), encoding="utf-8")
        (self.root / "product_page_images.json").write_text(json.dumps({"detail_image_mode": "detail_long_image", "images": [
            {"image_type": "main_image", "source_url": "https://example.invalid/main.png"},
            {"image_type": "detail_image", "storage_path": "product_page_images/detail/long.png"}]}), encoding="utf-8")
        output = io.StringIO()
        with patch.object(sys, "argv", ["bridge", "--product-name", "合成测试", "--run-dir", str(self.root),
                                       "--exports-dir", str(self.root), "--clean-only"]), contextlib.redirect_stdout(output):
            self.assertEqual(bridge.main(), 0)
        result = json.loads(output.getvalue().strip().splitlines()[-1])
        self.assertEqual(result["counts"], {"productCount": 1, "skuCount": 1, "qaCount": 1, "reviewCount": 1})
        product = result["products"][0]
        self.assertEqual(product["price"], 19.9)
        self.assertEqual(product["sold"], 12000)
        self.assertEqual(product["salesAmount"], 24000)
        self.assertEqual(product["imageUrl"], "https://example.invalid/main.png")
        self.assertEqual(product["qas"][0]["answer"], "合成回答")
        self.assertIn("合成追评", product["reviews"][0]["content"])
        self.assertEqual(product["sourceData"]["images"]["detail_image_mode"], "detail_long_image")
        self.assertTrue(all(Path(path).is_file() for path in result["files"]))

    def test_missing_sku_and_qa_do_not_fabricate_price_or_feedback(self):
        result = bridge.collect_products(self.root)
        product = result["products"][0]
        self.assertIsNone(product["price"])
        self.assertEqual(product["skus"], [])
        self.assertEqual(product["reviews"], [])
        self.assertEqual(product["qas"], [])

    def test_batch_summary_restores_per_product_directory(self):
        item = self.root / "001-item"
        item.mkdir()
        (self.root / "product.xlsx").rename(item / "product.xlsx")
        (item / "product_summary.json").write_text('{"ok":true}', encoding="utf-8")
        result = bridge.collect_products(self.root)
        self.assertEqual(len(result["products"]), 1)
        self.assertEqual(result["products"][0]["sourceData"]["exportDirectory"], str(item.resolve()))

    def test_no_export_is_an_error(self):
        (self.root / "product.xlsx").unlink()
        with self.assertRaisesRegex(ValueError, "未取得可入库"):
            bridge.collect_products(self.root)


if __name__ == "__main__":
    unittest.main()
