diff --git a/app/src/main/java/com/tehmi/screwcalc/MainActivity.kt b/app/src/main/java/com/tehmi/screwcalc/MainActivity.kt
new file mode 100644
index 0000000000000000000000000000000000000000..1e00d414f4d3c4fa0e0e41cb255e7cb562fa1e65
--- /dev/null
+++ b/app/src/main/java/com/tehmi/screwcalc/MainActivity.kt
@@ -0,0 +1,57 @@
+package com.tehmi.screwcalc
+
+import android.os.Bundle
+import android.widget.Button
+import android.widget.TextView
+import androidx.appcompat.app.AppCompatActivity
+import com.google.android.material.textfield.TextInputEditText
+import java.util.Locale
+import kotlin.math.PI
+
+class MainActivity : AppCompatActivity() {
+
+    override fun onCreate(savedInstanceState: Bundle?) {
+        super.onCreate(savedInstanceState)
+        setContentView(R.layout.activity_main)
+
+        val etDiameter = findViewById<TextInputEditText>(R.id.etDiameter)
+        val etPitch = findViewById<TextInputEditText>(R.id.etPitch)
+        val etRpm = findViewById<TextInputEditText>(R.id.etRpm)
+        val etFill = findViewById<TextInputEditText>(R.id.etFill)
+        val etDensity = findViewById<TextInputEditText>(R.id.etDensity)
+        val tvResult = findViewById<TextView>(R.id.tvResult)
+        val btnCalculate = findViewById<Button>(R.id.btnCalculate)
+
+        btnCalculate.setOnClickListener {
+            val d = etDiameter.text.toString().toDoubleOrNull()
+            val s = etPitch.text.toString().toDoubleOrNull()
+            val n = etRpm.text.toString().toDoubleOrNull()
+            val phi = etFill.text.toString().toDoubleOrNull()
+            val rho = etDensity.text.toString().toDoubleOrNull()
+
+            if (d == null || s == null || n == null || phi == null || rho == null) {
+                tvResult.text = "Ошибка: заполните все поля числами."
+                return@setOnClickListener
+            }
+
+            if (d <= 0.0 || s <= 0.0 || n <= 0.0 || phi <= 0.0 || phi > 1.0 || rho <= 0.0) {
+                tvResult.text = "Ошибка: проверьте диапазоны значений (φ от 0 до 1)."
+                return@setOnClickListener
+            }
+
+            val volumetricQ = (PI * d * d / 4.0) * s * (n / 60.0) * phi
+            val massQKgSec = volumetricQ * rho
+            val massQKgHour = massQKgSec * 3600.0
+
+            tvResult.text = String.format(
+                Locale("ru"),
+                "Объёмная производительность: %.5f м³/с\n" +
+                    "Массовая производительность: %.3f кг/с\n" +
+                    "Массовая производительность: %.1f кг/ч",
+                volumetricQ,
+                massQKgSec,
+                massQKgHour
+            )
+        }
+    }
+}
