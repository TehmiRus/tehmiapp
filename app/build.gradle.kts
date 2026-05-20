diff --git a/app/build.gradle.kts b/app/build.gradle.kts
new file mode 100644
index 0000000000000000000000000000000000000000..b0029c96ee59da6f207e1cdab9845378b397c024
--- /dev/null
+++ b/app/build.gradle.kts
@@ -0,0 +1,42 @@
+plugins {
+    id("com.android.application")
+    id("org.jetbrains.kotlin.android")
+}
+
+android {
+    namespace = "com.tehmi.screwcalc"
+    compileSdk = 34
+
+    defaultConfig {
+        applicationId = "com.tehmi.screwcalc"
+        minSdk = 24
+        targetSdk = 34
+        versionCode = 1
+        versionName = "1.0"
+    }
+
+    buildTypes {
+        release {
+            isMinifyEnabled = false
+            proguardFiles(
+                getDefaultProguardFile("proguard-android-optimize.txt"),
+                "proguard-rules.pro"
+            )
+        }
+    }
+
+    compileOptions {
+        sourceCompatibility = JavaVersion.VERSION_17
+        targetCompatibility = JavaVersion.VERSION_17
+    }
+    kotlinOptions {
+        jvmTarget = "17"
+    }
+}
+
+dependencies {
+    implementation("androidx.core:core-ktx:1.13.1")
+    implementation("androidx.appcompat:appcompat:1.7.0")
+    implementation("com.google.android.material:material:1.12.0")
+    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
+}
