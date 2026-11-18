"""Run the Android asset regression tests with Python Playwright."""
import codecs
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from pathlib import Path
import sys
from threading import Thread
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app/src/main/assets"


class AssetHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


class ApplicationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(AssetHandler, directory=ASSETS))
        cls.addClassCleanup(server.server_close)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        cls.addClassCleanup(thread.join)
        cls.addClassCleanup(server.shutdown)
        cls.url = f"http://127.0.0.1:{server.server_port}/"

        playwright = sync_playwright().start()
        cls.addClassCleanup(playwright.stop)
        cls.browser = playwright.chromium.launch()
        cls.addClassCleanup(cls.browser.close)

    def setUp(self):
        self.page = self.browser.new_page(viewport={"width": 390, "height": 844})
        self.addCleanup(self.page.close)
        response = self.page.goto(self.url)
        self.assertEqual(response.status, 200)

    def assert_reference_value(self, actual, expected, location):
        if isinstance(expected, dict):
            self.assertIsInstance(actual, dict, location)
            for key, value in expected.items():
                self.assertIn(key, actual, location)
                self.assert_reference_value(actual[key], value, f"{location}.{key}")
        elif isinstance(expected, list):
            # The Android report adapts the reference warning text.
            return
        elif type(expected) in (float, int):
            self.assertIn(type(actual), (float, int), location)
            self.assertTrue(
                math.isfinite(actual) and abs(actual - expected) <= 1e-10 * max(1, abs(expected)),
                f"{location}: {actual} != {expected}",
            )
        else:
            self.assertIs(type(actual), type(expected), location)
            self.assertEqual(actual, expected, location)

    def test_reference_cases(self):
        cases = json.loads((ROOT / "tests/reference-cases.json").read_text(encoding="utf-8"))
        self.assertTrue(cases)
        results = self.page.evaluate(
            """cases => cases.map(({id, data}) => {
                try {
                    return {result: calculatePanel(id, data)};
                } catch (error) {
                    return {error: String(error)};
                }
            })""",
            cases,
        )
        for i, (case, actual) in enumerate(zip(cases, results, strict=True)):
            with self.subTest(case=i, panel=case["id"]):
                if case.get("error"):
                    self.assertIn("error", actual)
                    self.assertTrue(actual["error"].startswith("Error:"), actual)
                else:
                    self.assertIn("result", actual)
                    self.assert_reference_value(actual["result"], case["result"], f"case {i}")
        print(f"Checked {len(cases)} reference cases")

    def test_engine_report_and_input(self):
        data = self.page.evaluate(
            """() => {
                const inputs = Object.fromEntries(SPEC.panels[0].fields.map(f => [f[0], f[2]]));
                return {...inputs, specific_load: '1', flow: '6000', sections: '3',
                    offline: '1', cleaning: SPEC.cleaning[1], bag_diameter: '200',
                    bag_length: '2', margin: '0'};
            }"""
        )
        result = self.page.evaluate("data => calculatePanel('filter', data)", data)
        self.assertEqual(result["bag_count"], 120)
        report = self.page.evaluate(
            "([data, result]) => reportText('filter', data, result)", [data, result]
        )
        for text in ("120", "ВЫПОЛНЕНО", "EPA/452/B-02-001", "Fnet,min", "ОГРАНИЧЕНИЯ", "кПа"):
            self.assertIn(text, report)
        fields = self.page.evaluate("data => activeFields('filter', data)", data)
        self.assertNotIn("dust", [field[0] for field in fields])

        invalid_inputs = (
            {"flow": "0x10"},
            {"flow": "Infinity"},
            {"flow": "1000000000", "specific_load": ".001", "bag_diameter": "1",
             "bag_length": ".01", "sections": "1000", "offline": "999", "margin": "200"},
        )
        for overrides in invalid_inputs:
            with self.subTest(overrides=overrides):
                error = self.page.evaluate(
                    """data => {
                        try {
                            calculatePanel('filter', data);
                        } catch (error) {
                            return String(error);
                        }
                    }""",
                    data | overrides,
                )
                self.assertTrue(error and error.startswith("Error:"), error)

    def test_mobile_ui(self):
        page = self.page
        errors = []
        page.on("pageerror", errors.append)
        page.reload()
        result = page.locator("#result")
        report = page.locator("#report")
        navigation = page.locator("#navigation")

        def fill(**fields):
            for name, value in fields.items():
                page.locator(f"[name={name}]").fill(value)

        def calculate():
            page.locator('button[type="submit"]').click()
            result.wait_for(state="visible")

        fill(specific_load="1", flow="6000", sections="3", offline="1",
             bag_diameter="200", bag_length="2", margin="0")
        page.locator("[name=cleaning]").select_option("С отключением секций")
        calculate()
        self.assertEqual(page.locator(".metric b").first.text_content(), "120")

        fill(flow="7000")
        self.assertFalse(result.is_visible())
        fill(flow="")
        page.locator('button[type="submit"]').click()
        self.assertTrue(page.locator("#error").is_visible())
        page.reload()
        self.assertEqual(page.locator("[name=specific_load]").input_value(), "1")

        navigation.select_option("fan")
        calculate()
        self.assertIn("кВт", report.text_content())
        page.evaluate("() => window.AndroidReports = {save: (title, text) => { window.savedReport = {title, text}; }}")
        page.locator("#save").click()
        self.assertEqual(page.evaluate("() => window.savedReport.title"), "Вентилятор")

        navigation.select_option("duct")
        fill(darcy="0,02", zeta="2", source="Контроль")
        calculate()

        navigation.select_option("alternative")
        page.locator("[name=method]").select_option("По действующему фильтру")
        self.assertFalse(page.locator("[name=speed]").is_visible())
        fill(reference_flow="7200", reference_area="100", source="Контроль")
        calculate()

        navigation.select_option("dust")
        calculate()
        page.evaluate("() => delete window.AndroidReports")
        with page.expect_download() as pending_download:
            page.locator("#save").click()
        download = pending_download.value
        self.assertTrue(download.suggested_filename.endswith(".txt"))
        content = download.path().read_bytes()
        self.assertTrue(content.startswith(codecs.BOM_UTF8))
        self.assertIn("ТехМИ — Пыль", content.decode("utf-8-sig"))

        navigation.select_option("reference")
        self.assertTrue(page.locator("#literature").is_visible())
        navigation.select_option("filter")
        page.locator("[name=method]").select_option("Коэффициенты БНТУ")
        self.assertFalse(page.locator("[name=specific_load]").is_visible())
        fill(flow="55000")
        calculate()
        self.assertIn("2.56940145862", report.text_content())

        for width in (320, 390, 768):
            with self.subTest(width=width):
                page.set_viewport_size({"width": width, "height": 844})
                self.assertTrue(page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
        self.assertEqual(errors, [])


if __name__ == "__main__":
    if sys.version_info < (3, 14):
        sys.exit("These tests require Python 3.14 or later.")
    unittest.main(verbosity=2)
