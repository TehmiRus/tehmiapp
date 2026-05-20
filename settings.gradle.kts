diff --git a/settings.gradle.kts b/settings.gradle.kts
new file mode 100644
index 0000000000000000000000000000000000000000..1df5e5e12894d17e706d84ef9467b357a0360d74
--- /dev/null
+++ b/settings.gradle.kts
@@ -0,0 +1,18 @@
+pluginManagement {
+    repositories {
+        google()
+        mavenCentral()
+        gradlePluginPortal()
+    }
+}
+
+dependencyResolutionManagement {
+    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
+    repositories {
+        google()
+        mavenCentral()
+    }
+}
+
+rootProject.name = "ScrewPerformanceCalc"
+include(":app")
