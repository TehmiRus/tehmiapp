diff --git a/build.gradle.kts b/build.gradle.kts
new file mode 100644
index 0000000000000000000000000000000000000000..017d90996969ec2fc080d15d578bd7ec1230ccf8
--- /dev/null
+++ b/build.gradle.kts
@@ -0,0 +1,4 @@
+plugins {
+    id("com.android.application") version "8.5.2" apply false
+    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
+}
